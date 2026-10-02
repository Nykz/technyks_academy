import { Controller, Get, Header, Injectable, Logger, Module, Req } from '@nestjs/common';
import type { Request } from 'express';
import { chargeCurrencyFor, currencyForCountry } from './currency';

const SOURCE = 'https://open.er-api.com/v6/latest/INR';
const REFRESH_MS = 12 * 60 * 60 * 1000;

export interface FxRates {
  base: 'INR';
  /** 1 INR expressed in each currency, e.g. rates.USD = 0.0117. */
  rates: Record<string, number>;
  updatedAt: string | null;
}

/**
 * Exchange rates for showing and charging prices in a visitor's own
 * currency. Prices are stored in INR. Rates are fetched at most every
 * 12 hours and the last good copy is kept if the source is unavailable.
 */
@Injectable()
export class FxService {
  private readonly logger = new Logger(FxService.name);
  private cache: FxRates = { base: 'INR', rates: { INR: 1 }, updatedAt: null };
  private fetchedAt = 0;
  private pending: Promise<void> | null = null;

  async rates(): Promise<FxRates> {
    if (Date.now() - this.fetchedAt > REFRESH_MS) {
      this.pending ??= this.refresh().finally(() => (this.pending = null));
      await this.pending;
    }
    return this.cache;
  }

  /** 1 INR in `currency`, or null when no rate is available. */
  async rateFor(currency: string): Promise<number | null> {
    if (currency === 'INR') return 1;
    const rate = (await this.rates()).rates[currency];
    return rate > 0 ? rate : null;
  }

  private async refresh() {
    try {
      const response = await fetch(SOURCE, { signal: AbortSignal.timeout(5000) });
      const body: any = await response.json();
      if (body?.result !== 'success' || typeof body.rates !== 'object') {
        throw new Error('unexpected response');
      }
      const rates: Record<string, number> = {};
      for (const [code, value] of Object.entries(body.rates)) {
        if (/^[A-Z]{3}$/.test(code) && Number(value) > 0) rates[code] = Number(value);
      }
      this.cache = { base: 'INR', rates: { ...rates, INR: 1 }, updatedAt: new Date().toISOString() };
      this.fetchedAt = Date.now();
    } catch (error: any) {
      // Try again in 10 minutes rather than on every request.
      this.fetchedAt = Date.now() - REFRESH_MS + 10 * 60 * 1000;
      this.logger.warn(`Exchange rates unavailable: ${error?.message || error}`);
    }
  }
}

/** Country headers some CDNs and proxies add. */
const COUNTRY_HEADERS = [
  'cf-ipcountry',
  'x-country-code',
  'x-hcdn-country',
  'x-geo-country',
  'cloudfront-viewer-country',
  'x-vercel-ip-country',
];
const LOOKUP_CACHE_MS = 12 * 60 * 60 * 1000;
const LOOKUP_CACHE_MAX = 5000;

/** True for addresses that have no country (local, private networks). */
export function isPrivateIp(ip: string) {
  return (
    !ip ||
    ip === '::1' ||
    /^127\./.test(ip) ||
    /^10\./.test(ip) ||
    /^192\.168\./.test(ip) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ||
    /^169\.254\./.test(ip) ||
    /^(fc|fd|fe80)/i.test(ip)
  );
}

/**
 * The visitor's country from their IP address (so a VPN shows that
 * country's currency). Uses a CDN country header when present, otherwise
 * asks country.is, a free open-source lookup that receives only the IP.
 * Results are cached for 12 hours per IP.
 */
@Injectable()
export class CountryService {
  private readonly logger = new Logger(CountryService.name);
  private readonly cache = new Map<string, { country: string | null; at: number }>();

  async countryFor(request: Request): Promise<string | null> {
    for (const header of COUNTRY_HEADERS) {
      const value = String(request.headers[header] || '').trim().toUpperCase();
      if (/^[A-Z]{2}$/.test(value) && value !== 'XX' && value !== 'T1') return value;
    }
    const ip = String(request.ip || '').replace(/^::ffff:/, '');
    if (isPrivateIp(ip)) return null;

    const cached = this.cache.get(ip);
    if (cached && Date.now() - cached.at < LOOKUP_CACHE_MS) return cached.country;

    let country: string | null = null;
    try {
      const response = await fetch(`https://api.country.is/${encodeURIComponent(ip)}`, {
        signal: AbortSignal.timeout(2500),
      });
      if (response.ok) {
        const body: any = await response.json();
        const code = String(body?.country || '').toUpperCase();
        country = /^[A-Z]{2}$/.test(code) ? code : null;
      }
    } catch (error: any) {
      this.logger.warn(`Country lookup failed: ${error?.message || error}`);
      return null; // Don't cache failures.
    }
    if (this.cache.size >= LOOKUP_CACHE_MAX) {
      this.cache.delete(this.cache.keys().next().value as string);
    }
    this.cache.set(ip, { country, at: Date.now() });
    return country;
  }
}

@Controller('fx')
export class FxController {
  constructor(
    private readonly fx: FxService,
    private readonly countries: CountryService,
  ) {}

  @Get()
  rates() {
    return this.fx.rates();
  }

  /**
   * The visitor's country, display currency and the currency they will be
   * charged in, with the INR rates for both. Never cached: it depends on
   * who is asking.
   */
  @Get('visitor')
  @Header('Cache-Control', 'private, no-store')
  async visitor(@Req() request: Request) {
    const country = await this.countries.countryFor(request);
    const currency = currencyForCountry(country);
    if (!currency) return { country, currency: null, chargeCurrency: null, rates: {} };
    const chargeCurrency = chargeCurrencyFor(currency);
    const all = (await this.fx.rates()).rates;
    const rates: Record<string, number> = { INR: 1 };
    for (const code of [currency, chargeCurrency]) if (all[code]) rates[code] = all[code];
    // Without a rate for the local currency, show and charge in rupees.
    if (!rates[currency] || !rates[chargeCurrency]) {
      return { country, currency: 'INR', chargeCurrency: 'INR', rates: { INR: 1 } };
    }
    return { country, currency, chargeCurrency, rates };
  }
}

@Module({
  controllers: [FxController],
  providers: [FxService, CountryService],
  exports: [FxService],
})
export class FxModule {}

import { HttpClient } from '@angular/common/http';
import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/** Region (from the browser language, e.g. en-US -> US) to currency. */
const REGION_CURRENCY: Record<string, string> = {
  US: 'USD', GB: 'GBP', CA: 'CAD', AU: 'AUD', NZ: 'NZD', SG: 'SGD', AE: 'AED',
  SA: 'SAR', QA: 'QAR', KW: 'KWD', OM: 'OMR', BH: 'BHD', JP: 'JPY', CN: 'CNY',
  HK: 'HKD', KR: 'KRW', MY: 'MYR', ID: 'IDR', PH: 'PHP', TH: 'THB', VN: 'VND',
  PK: 'PKR', BD: 'BDT', LK: 'LKR', NP: 'NPR', ZA: 'ZAR', NG: 'NGN', KE: 'KES',
  EG: 'EGP', BR: 'BRL', MX: 'MXN', CH: 'CHF', SE: 'SEK', NO: 'NOK', DK: 'DKK',
  PL: 'PLN', TR: 'TRY', RU: 'RUB', IL: 'ILS',
  DE: 'EUR', FR: 'EUR', ES: 'EUR', IT: 'EUR', NL: 'EUR', BE: 'EUR', AT: 'EUR',
  IE: 'EUR', PT: 'EUR', FI: 'EUR', GR: 'EUR', LU: 'EUR', SK: 'EUR', SI: 'EUR',
  EE: 'EUR', LV: 'EUR', LT: 'EUR', CY: 'EUR', MT: 'EUR', HR: 'EUR',
};
const INDIA_TIME_ZONES = ['Asia/Kolkata', 'Asia/Calcutta'];

/**
 * Decimal places of the currencies checkout can charge in. Keep in step
 * with CHARGE_CURRENCY_DECIMALS in api/src/app/fx/currency.ts; the server
 * decides the final amount.
 */
const CHARGE_DECIMALS: Record<string, number> = {
  INR: 2, USD: 2, EUR: 2, GBP: 2, CAD: 2, AUD: 2, NZD: 2, SGD: 2, AED: 2,
  SAR: 2, QAR: 2, HKD: 2, MYR: 2, IDR: 2, PHP: 2, THB: 2, PKR: 2, BDT: 2,
  LKR: 2, NPR: 2, MVR: 2, ZAR: 2, NGN: 2, KES: 2, GHS: 2, EGP: 2, MAD: 2,
  TZS: 2, MXN: 2, ARS: 2, COP: 2, PEN: 2, CHF: 2, SEK: 2, NOK: 2, DKK: 2,
  CZK: 2, HUF: 2, ILS: 2, KZT: 2,
  JPY: 0, KRW: 0, VND: 0, CLP: 0, UGX: 0,
  KWD: 3, OMR: 3, BHD: 3, JOD: 3,
};

interface VisitorCurrency {
  country: string | null;
  currency: string | null;
  chargeCurrency: string | null;
  rates: Record<string, number>;
}

/**
 * Shows and charges prices in the visitor's own currency. Prices are stored
 * in INR; the server tells us the visitor's country from their IP address
 * (so a VPN shows that country's currency) and the exchange rate. If that
 * fails, the browser's time zone and language are used instead. Before the
 * answer arrives, and on the server, prices show in rupees.
 */
@Injectable({ providedIn: 'root' })
export class LocalPriceService {
  private readonly http = inject(HttpClient);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly rates = signal<Record<string, number>>({ INR: 1 });

  /** The currency prices are shown in, e.g. 'INR' or 'USD'. */
  readonly currency = signal('INR');
  /** The currency checkout charges in (USD where the local one isn't supported). */
  readonly chargeCurrency = signal('INR');
  /** The visitor's country code, when known. */
  readonly country = signal<string | null>(null);
  /** True when prices are shown converted from INR. */
  readonly isConverted = computed(
    () => this.currency() !== 'INR' && !!this.rates()[this.currency()],
  );

  constructor() {
    if (!this.isBrowser) return;
    this.http.get<VisitorCurrency>('/api/fx/visitor').subscribe({
      next: (visitor) => {
        if (visitor?.currency && visitor.chargeCurrency) {
          this.country.set(visitor.country);
          this.rates.set({ INR: 1, ...(visitor.rates || {}) });
          this.currency.set(visitor.currency);
          this.chargeCurrency.set(visitor.chargeCurrency);
        } else {
          this.useBrowserGuess();
        }
      },
      error: () => this.useBrowserGuess(),
    });
  }

  /** Formats an INR price for this visitor. Non-INR amounts are shown as-is. */
  format(amount: number | null | undefined, currency = 'INR'): string {
    const value = Number(amount) || 0;
    if (currency !== 'INR') return money(value, currency);
    const target = this.currency();
    const rate = this.rates()[target];
    if (target === 'INR' || !rate) return money(value, 'INR');
    return money(convert(value, target, rate), target);
  }

  /** What checkout charges for an INR amount, in the charge currency. */
  chargeQuote(amountInr: number | null | undefined): { currency: string; amount: number } {
    const value = Number(amountInr) || 0;
    const currency = this.chargeCurrency();
    const rate = this.rates()[currency];
    if (currency === 'INR' || !rate) return { currency: 'INR', amount: convert(value, 'INR', 1) };
    return { currency, amount: convert(value, currency, rate) };
  }

  /** The checkout amount, formatted, e.g. "$11.99". */
  formatCharge(amountInr: number | null | undefined): string {
    const quote = this.chargeQuote(amountInr);
    return money(quote.amount, quote.currency);
  }

  /** Always in rupees, e.g. for "Billed as ₹999". */
  formatInr(amount: number | null | undefined): string {
    return money(Number(amount) || 0, 'INR');
  }

  private useBrowserGuess() {
    const currency = detectCurrency();
    if (currency === 'INR') return;
    this.http.get<{ rates: Record<string, number> }>('/api/fx').subscribe({
      next: (body) => {
        const all = body?.rates || {};
        const charge = currency in CHARGE_DECIMALS ? currency : 'USD';
        if (!all[currency] || !all[charge]) return;
        this.rates.set({ INR: 1, [currency]: all[currency], [charge]: all[charge] });
        this.currency.set(currency);
        this.chargeCurrency.set(charge);
      },
    });
  }
}

/** INR → currency, rounded exactly like the server (api fx/currency.ts). */
function convert(amountInr: number, currency: string, rate: number) {
  const decimals = currency === 'INR' ? 2 : Math.min(CHARGE_DECIMALS[currency] ?? 2, 2);
  const factor = 10 ** decimals;
  return Math.round(amountInr * rate * factor) / factor;
}

function money(value: number, currency: string) {
  const locale = currency === 'INR' ? 'en-IN' : undefined;
  const whole = currency === 'INR' && Number.isInteger(value);
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: whole ? 0 : undefined,
  }).format(value);
}

/** INR in India (by time zone), otherwise from the browser's region. */
export function detectCurrency(
  timeZone = safe(() => Intl.DateTimeFormat().resolvedOptions().timeZone),
  languages: readonly string[] = safe(() => navigator.languages) || [],
): string {
  if (timeZone && INDIA_TIME_ZONES.includes(timeZone)) return 'INR';
  for (const language of languages) {
    const region = language.split('-')[1]?.toUpperCase();
    if (region === 'IN') return 'INR';
    if (region && REGION_CURRENCY[region]) return REGION_CURRENCY[region];
  }
  return 'USD';
}

function safe<T>(read: () => T): T | undefined {
  try {
    return read();
  } catch {
    return undefined;
  }
}

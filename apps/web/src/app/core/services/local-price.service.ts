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
 * Shows prices in the visitor's currency. Prices are stored and charged in
 * INR; visitors in India always see rupees, everyone else sees the converted
 * amount (display only, rates refreshed by the API every 12 hours). Before
 * rates load, and on the server, prices show in rupees.
 */
@Injectable({ providedIn: 'root' })
export class LocalPriceService {
  private readonly http = inject(HttpClient);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly rates = signal<Record<string, number> | null>(null);

  /** The currency this visitor should see, e.g. 'INR' or 'USD'. */
  readonly currency = signal('INR');
  /** True when prices are shown converted from INR. */
  readonly isConverted = computed(
    () => this.currency() !== 'INR' && !!this.rates()?.[this.currency()],
  );

  constructor() {
    if (!this.isBrowser) return;
    const currency = detectCurrency();
    if (currency === 'INR') return;
    this.currency.set(currency);
    this.http.get<{ rates: Record<string, number> }>('/api/fx').subscribe({
      next: (body) => this.rates.set(body?.rates || null),
      error: () => this.rates.set(null),
    });
  }

  /** Formats an amount for this visitor. Non-INR amounts are shown as-is. */
  format(amount: number | null | undefined, currency = 'INR'): string {
    const value = Number(amount) || 0;
    if (currency !== 'INR') return money(value, currency);
    const target = this.currency();
    const rate = this.rates()?.[target];
    if (target === 'INR' || !rate) return money(value, 'INR');
    return money(value * rate, target);
  }

  /** Always in rupees, e.g. for "Billed as ₹999". */
  formatInr(amount: number | null | undefined): string {
    return money(Number(amount) || 0, 'INR');
  }
}

function money(value: number, currency: string) {
  const locale = currency === 'INR' ? 'en-IN' : undefined;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'INR' ? 0 : undefined,
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

/**
 * Country → currency, and the currencies checkout can charge in.
 *
 * Prices are stored in INR. A visitor sees and pays the converted amount in
 * their own currency (by IP country). Countries whose currency the payment
 * gateway does not support are charged in USD instead.
 */

const EURO_COUNTRIES = [
  'AT', 'BE', 'CY', 'DE', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'IE', 'IT', 'LT',
  'LU', 'LV', 'MT', 'NL', 'PT', 'SI', 'SK', 'AD', 'MC', 'SM', 'VA', 'ME', 'XK',
];

export const COUNTRY_CURRENCY: Record<string, string> = {
  IN: 'INR', US: 'USD', GB: 'GBP', CA: 'CAD', AU: 'AUD', NZ: 'NZD', SG: 'SGD',
  AE: 'AED', SA: 'SAR', QA: 'QAR', KW: 'KWD', OM: 'OMR', BH: 'BHD', JO: 'JOD',
  JP: 'JPY', CN: 'CNY', HK: 'HKD', KR: 'KRW', MY: 'MYR', ID: 'IDR', PH: 'PHP',
  TH: 'THB', VN: 'VND', PK: 'PKR', BD: 'BDT', LK: 'LKR', NP: 'NPR', MV: 'MVR',
  ZA: 'ZAR', NG: 'NGN', KE: 'KES', GH: 'GHS', EG: 'EGP', MA: 'MAD', TZ: 'TZS',
  UG: 'UGX', BR: 'BRL', MX: 'MXN', AR: 'ARS', CL: 'CLP', CO: 'COP', PE: 'PEN',
  CH: 'CHF', SE: 'SEK', NO: 'NOK', DK: 'DKK', PL: 'PLN', CZ: 'CZK', HU: 'HUF',
  RO: 'RON', TR: 'TRY', IL: 'ILS', RU: 'RUB', UA: 'UAH', KZ: 'KZT', TW: 'TWD',
  IS: 'ISK', ...Object.fromEntries(EURO_COUNTRIES.map((code) => [code, 'EUR'])),
};

/**
 * Currencies we charge in, with their decimal places (Razorpay's
 * international currency list). Amounts are sent to the gateway in the
 * smallest unit: cents for 2 decimals, whole units for 0, fils for 3.
 */
export const CHARGE_CURRENCY_DECIMALS: Record<string, number> = {
  INR: 2, USD: 2, EUR: 2, GBP: 2, CAD: 2, AUD: 2, NZD: 2, SGD: 2, AED: 2,
  SAR: 2, QAR: 2, HKD: 2, MYR: 2, IDR: 2, PHP: 2, THB: 2, PKR: 2, BDT: 2,
  LKR: 2, NPR: 2, MVR: 2, ZAR: 2, NGN: 2, KES: 2, GHS: 2, EGP: 2, MAD: 2,
  TZS: 2, MXN: 2, ARS: 2, COP: 2, PEN: 2, CHF: 2, SEK: 2, NOK: 2, DKK: 2,
  CZK: 2, HUF: 2, ILS: 2, KZT: 2,
  JPY: 0, KRW: 0, VND: 0, CLP: 0, UGX: 0,
  KWD: 3, OMR: 3, BHD: 3, JOD: 3,
};

export function currencyForCountry(country: string | null | undefined): string | null {
  return country ? COUNTRY_CURRENCY[country.toUpperCase()] || null : null;
}

/** The currency an order is charged in: the requested one, or USD. */
export function chargeCurrencyFor(requested: string | null | undefined): string {
  const code = String(requested || 'INR').toUpperCase();
  return code in CHARGE_CURRENCY_DECIMALS ? code : 'USD';
}

/**
 * INR → `currency`, rounded to what the currency can be charged in. 3-decimal
 * currencies are rounded to 2 decimals because gateways require the last
 * digit to be 0.
 */
export function convertFromInr(amountInr: number, currency: string, rate: number): number {
  if (currency === 'INR') return round(amountInr, 2);
  const decimals = Math.min(CHARGE_CURRENCY_DECIMALS[currency] ?? 2, 2);
  return round(amountInr * rate, decimals);
}

/** Amount in the gateway's smallest unit, e.g. 10.4 USD → 1040. */
export function toMinorUnits(amount: number, currency: string): number {
  const decimals = CHARGE_CURRENCY_DECIMALS[currency] ?? 2;
  return Math.round(Number(amount) * 10 ** decimals);
}

function round(value: number, decimals: number) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

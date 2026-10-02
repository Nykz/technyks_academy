import { afterEach, describe, expect, it, vi } from 'vitest';
import { chargeCurrencyFor, convertFromInr, currencyForCountry, toMinorUnits } from './currency';
import { CountryService, FxController, isPrivateIp } from './fx.module';
import { PaymentsService } from '../payments/payments.service';

describe('currency helpers', () => {
  it('maps countries to their currency', () => {
    expect(currencyForCountry('US')).toBe('USD');
    expect(currencyForCountry('de')).toBe('EUR');
    expect(currencyForCountry('IN')).toBe('INR');
    expect(currencyForCountry(null)).toBeNull();
  });

  it('charges in supported currencies, otherwise USD', () => {
    expect(chargeCurrencyFor('GBP')).toBe('GBP');
    expect(chargeCurrencyFor('CNY')).toBe('USD');
    expect(chargeCurrencyFor(undefined)).toBe('INR');
  });

  it('converts and rounds to what the currency can be charged in', () => {
    expect(convertFromInr(999, 'USD', 0.0119)).toBe(11.89);
    expect(convertFromInr(999, 'JPY', 1.75)).toBe(1748);
    expect(toMinorUnits(11.89, 'USD')).toBe(1189);
    expect(toMinorUnits(1748, 'JPY')).toBe(1748);
    expect(toMinorUnits(3.45, 'KWD')).toBe(3450); // last digit 0
  });
});

describe('visitor country', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('uses a CDN country header when present', async () => {
    const service = new CountryService();
    expect(await service.countryFor({ headers: { 'cf-ipcountry': 'us' }, ip: '8.8.8.8' } as any)).toBe('US');
  });

  it('looks the IP up once and caches it', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ country: 'GB' }) });
    vi.stubGlobal('fetch', fetchMock);
    const service = new CountryService();
    const request = { headers: {}, ip: '81.2.69.142' } as any;
    expect(await service.countryFor(request)).toBe('GB');
    expect(await service.countryFor(request)).toBe('GB');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('skips private addresses', async () => {
    expect(isPrivateIp('192.168.1.4')).toBe(true);
    expect(isPrivateIp('8.8.8.8')).toBe(false);
    expect(await new CountryService().countryFor({ headers: {}, ip: '127.0.0.1' } as any)).toBeNull();
  });

  it('tells a US visitor to see and pay in dollars', async () => {
    const fx: any = { rates: async () => ({ rates: { INR: 1, USD: 0.012, CNY: 0.085 } }) };
    const controller = new FxController(fx, { countryFor: async () => 'US' } as any);
    expect(await controller.visitor({} as any)).toEqual({
      country: 'US',
      currency: 'USD',
      chargeCurrency: 'USD',
      rates: { INR: 1, USD: 0.012 },
    });
  });

  it('shows yuan but charges dollars where the gateway lacks the currency', async () => {
    const fx: any = { rates: async () => ({ rates: { INR: 1, USD: 0.012, CNY: 0.085 } }) };
    const controller = new FxController(fx, { countryFor: async () => 'CN' } as any);
    const visitor = await controller.visitor({} as any);
    expect(visitor.currency).toBe('CNY');
    expect(visitor.chargeCurrency).toBe('USD');
  });
});

describe('checkout quote', () => {
  const service = (rate: number | null) =>
    new PaymentsService({} as any, {} as any, { get: () => undefined } as any, undefined, {
      rateFor: async (code: string) => (code === 'INR' ? 1 : rate),
    } as any);

  it('charges a US buyer in dollars at the server rate', async () => {
    expect(await service(0.012).quoteInCurrency(999, 'USD')).toEqual({ currency: 'USD', amount: 11.99, minor: 1199 });
  });

  it('falls back to rupees when no rate is available', async () => {
    expect(await service(null).quoteInCurrency(999, 'USD')).toEqual({ currency: 'INR', amount: 999, minor: 99900 });
  });
});

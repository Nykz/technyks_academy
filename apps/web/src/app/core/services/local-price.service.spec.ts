import '@angular/compiler';
import { describe, expect, it } from 'vitest';
import { Injector, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { LocalPriceService, detectCurrency } from './local-price.service';

describe('detectCurrency', () => {
  it('shows rupees to visitors in India, whatever their language', () => {
    expect(detectCurrency('Asia/Kolkata', ['en-US'])).toBe('INR');
    expect(detectCurrency('Asia/Calcutta', ['en-GB'])).toBe('INR');
    expect(detectCurrency('Europe/London', ['hi-IN'])).toBe('INR');
  });

  it("uses the visitor's region elsewhere", () => {
    expect(detectCurrency('America/New_York', ['en-US'])).toBe('USD');
    expect(detectCurrency('Europe/London', ['en-GB'])).toBe('GBP');
    expect(detectCurrency('Europe/Berlin', ['de-DE'])).toBe('EUR');
    expect(detectCurrency('Asia/Dubai', ['ar-AE', 'en'])).toBe('AED');
  });

  it('falls back to US dollars when the region is unknown', () => {
    expect(detectCurrency('Europe/Paris', ['en'])).toBe('USD');
    expect(detectCurrency('', [])).toBe('USD');
  });
});


function serviceWith(get: (url: string) => any) {
  const injector = Injector.create({
    providers: [
      { provide: HttpClient, useValue: { get } },
      { provide: PLATFORM_ID, useValue: 'browser' },
      { provide: LocalPriceService, deps: [] },
    ],
  });
  return injector.get(LocalPriceService);
}

describe('LocalPriceService', () => {
  it('follows the IP country, so an Indian PC on a US VPN sees and pays dollars', () => {
    const prices = serviceWith(() =>
      of({ country: 'US', currency: 'USD', chargeCurrency: 'USD', rates: { INR: 1, USD: 0.012 } }),
    );
    expect(prices.currency()).toBe('USD');
    expect(prices.format(999)).toBe('$11.99');
    expect(prices.chargeQuote(999)).toEqual({ currency: 'USD', amount: 11.99 });
    expect(prices.formatCharge(999)).toBe('$11.99');
  });

  it('keeps rupees for visitors in India', () => {
    const prices = serviceWith(() =>
      of({ country: 'IN', currency: 'INR', chargeCurrency: 'INR', rates: { INR: 1 } }),
    );
    expect(prices.format(999)).toBe('₹999');
    expect(prices.chargeQuote(999)).toEqual({ currency: 'INR', amount: 999 });
  });

  it('shows the local currency but charges dollars where the gateway lacks it', () => {
    const prices = serviceWith(() =>
      of({ country: 'CN', currency: 'CNY', chargeCurrency: 'USD', rates: { INR: 1, CNY: 0.085, USD: 0.012 } }),
    );
    expect(prices.currency()).toBe('CNY');
    expect(prices.chargeQuote(999)).toEqual({ currency: 'USD', amount: 11.99 });
  });

  it('shows rupees if the currency service is unreachable and the PC is set to India', () => {
    const prices = serviceWith(() => throwError(() => new Error('offline')));
    expect(['INR', 'USD', 'GBP', 'EUR']).toContain(prices.chargeQuote(999).currency);
  });
});

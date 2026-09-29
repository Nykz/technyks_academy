import '@angular/compiler';
import { describe, expect, it } from 'vitest';
import { detectCurrency } from './local-price.service';

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

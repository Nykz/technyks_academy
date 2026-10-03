import { afterEach, describe, expect, it, vi } from 'vitest';
import { GOOGLE_ADS_PURCHASE_SEND_TO, trackGoogleAdsPurchase } from './google-ads';

describe('trackGoogleAdsPurchase', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sends one Purchase conversion with the paid amount, currency and payment ID', () => {
    const gtag = vi.fn();
    vi.stubGlobal('window', { gtag });

    expect(trackGoogleAdsPurchase({ id: 'pay-row-1', amount: 166.02, currency: 'USD' })).toBe(true);
    expect(gtag).toHaveBeenCalledWith('event', 'conversion', {
      send_to: GOOGLE_ADS_PURCHASE_SEND_TO,
      value: 166.02,
      currency: 'USD',
      transaction_id: 'pay-row-1',
    });
    expect(GOOGLE_ADS_PURCHASE_SEND_TO).toBe('AW-18489882041/Rj7-COPOg48dELnr1PBE');
  });

  it('never reports the same payment twice', () => {
    const gtag = vi.fn();
    vi.stubGlobal('window', { gtag });
    trackGoogleAdsPurchase({ id: 'pay-row-2', amount: 999, currency: 'INR' });
    expect(trackGoogleAdsPurchase({ id: 'pay-row-2', amount: 999, currency: 'INR' })).toBe(false);
    expect(gtag).toHaveBeenCalledTimes(1);
  });

  it('does nothing when the Google tag is blocked or the amount is missing', () => {
    vi.stubGlobal('window', {});
    expect(trackGoogleAdsPurchase({ id: 'pay-row-3', amount: 999, currency: 'INR' })).toBe(false);

    const gtag = vi.fn();
    vi.stubGlobal('window', { gtag });
    expect(trackGoogleAdsPurchase({ id: 'pay-row-4', amount: NaN, currency: 'INR' })).toBe(false);
    expect(trackGoogleAdsPurchase({ id: 'pay-row-5', amount: 0, currency: 'INR' })).toBe(false);
    expect(gtag).not.toHaveBeenCalled();
  });
});

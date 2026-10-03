import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GOOGLE_ADS_PURCHASE_SEND_TO, trackGoogleAdsPurchase } from './google-ads';

/** The shape POST /api/payments/verify-razorpay returns (the Payment row). */
const verified = (overrides: Record<string, unknown> = {}) => ({
  id: 'pay-row-1',
  userId: 'user-1',
  amount: 166.02,
  currency: 'USD',
  status: 'SUCCESS',
  provider: 'RAZORPAY',
  paymentIntentId: 'order_ABC',
  courseId: 'course-1',
  amountInr: 16000,
  couponCode: null,
  ...overrides,
});

describe('trackGoogleAdsPurchase', () => {
  let gtag: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    gtag = vi.fn();
    vi.stubGlobal('window', { gtag });
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('sends the conversion with amountInr, INR and the payment ID', () => {
    expect(trackGoogleAdsPurchase(verified())).toBe(true);
    expect(gtag).toHaveBeenCalledWith('event', 'conversion', {
      send_to: 'AW-18489882041/Rj7-COPOg48dELnr1PBE',
      value: 16000,
      currency: 'INR',
      transaction_id: 'pay-row-1',
    });
    expect(GOOGLE_ADS_PURCHASE_SEND_TO).toBe('AW-18489882041/Rj7-COPOg48dELnr1PBE');
  });

  it('never sends the buyer currency or amount (a USD buyer is reported in INR)', () => {
    trackGoogleAdsPurchase(verified({ id: 'pay-usd' }));
    const params = gtag.mock.calls[0][2];
    expect(params.currency).toBe('INR');
    expect(params.value).toBe(16000);
    expect(params.value).not.toBe(166.02);
  });

  it('never reports the same payment twice', () => {
    trackGoogleAdsPurchase(verified({ id: 'pay-row-2' }));
    expect(trackGoogleAdsPurchase(verified({ id: 'pay-row-2' }))).toBe(false);
    expect(gtag).toHaveBeenCalledTimes(1);
  });

  it('does not fire unless the payment status is SUCCESS', () => {
    expect(trackGoogleAdsPurchase(verified({ id: 'p1', status: 'PENDING' }))).toBe(false);
    expect(trackGoogleAdsPurchase(verified({ id: 'p2', status: 'FAILED' }))).toBe(false);
    expect(trackGoogleAdsPurchase(null)).toBe(false);
    expect(trackGoogleAdsPurchase(undefined)).toBe(false);
    expect(gtag).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalled();
  });

  it('does not fire without a payment ID', () => {
    expect(trackGoogleAdsPurchase(verified({ id: undefined }))).toBe(false);
    expect(trackGoogleAdsPurchase(verified({ id: '' }))).toBe(false);
    expect(gtag).not.toHaveBeenCalled();
  });

  it('does not fire when amountInr is null, undefined, NaN, 0, negative or not a number', () => {
    for (const [i, amountInr] of [null, undefined, NaN, 0, -5, '999', Infinity].entries()) {
      expect(trackGoogleAdsPurchase(verified({ id: `bad-${i}`, amountInr }))).toBe(false);
    }
    expect(gtag).not.toHaveBeenCalled();
  });

  it('does not fire when the Google tag is not available', () => {
    vi.stubGlobal('window', {});
    expect(trackGoogleAdsPurchase(verified({ id: 'no-tag' }))).toBe(false);
  });
});

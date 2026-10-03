/**
 * Google Ads "Technyks Course Purchase" conversion (goal: Purchase,
 * currency: INR). The Google tag for AW-18489882041 is in index.html.
 */
export const GOOGLE_ADS_PURCHASE_SEND_TO = 'AW-18489882041/Rj7-COPOg48dELnr1PBE';

/** IDs already reported in this tab, so a repeated callback can't count twice. */
const reported = new Set<string>();

/** The fields used from the backend's verified payment record. */
export interface VerifiedPayment {
  /** Our internal payment ID, sent as the transaction ID. */
  id?: string | null;
  /** 'SUCCESS' once the backend has verified the payment. */
  status?: string | null;
  /** The verified amount paid, in rupees. Always reported as INR. */
  amountInr?: number | null;
}

/**
 * Reports a purchase to Google Ads, always in INR. Call it only with the
 * response of POST /api/payments/verify-razorpay, i.e. after the backend has
 * verified the Razorpay payment, marked it SUCCESS and created the
 * enrollment. Does nothing (and logs why) unless the payment is SUCCESS with
 * an ID and a positive amountInr, the Google tag is available, and this
 * payment hasn't been reported already. Returns true when the event was sent.
 */
export function trackGoogleAdsPurchase(payment: VerifiedPayment | null | undefined): boolean {
  if (typeof window === 'undefined') return false;

  if (payment?.status !== 'SUCCESS') {
    console.warn('[Google Ads] Purchase not tracked: payment status is not SUCCESS.', payment?.status);
    return false;
  }
  if (!payment.id) {
    console.warn('[Google Ads] Purchase not tracked: verified payment has no id.');
    return false;
  }
  const amountInr = payment.amountInr;
  if (typeof amountInr !== 'number' || !Number.isFinite(amountInr) || amountInr <= 0) {
    console.warn('[Google Ads] Purchase not tracked: amountInr is not a positive number.', amountInr);
    return false;
  }
  const gtag = (window as Window & { gtag?: (...args: unknown[]) => void }).gtag;
  if (typeof gtag !== 'function') {
    console.warn('[Google Ads] Purchase not tracked: the Google tag (gtag) is not available.');
    return false;
  }
  if (reported.has(payment.id)) return false;
  reported.add(payment.id);

  gtag('event', 'conversion', {
    send_to: GOOGLE_ADS_PURCHASE_SEND_TO,
    value: amountInr,
    currency: 'INR',
    transaction_id: payment.id,
  });
  return true;
}

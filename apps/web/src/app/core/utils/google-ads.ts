/** Google Ads "Purchase" conversion action (tag AW-18489882041 is in index.html). */
export const GOOGLE_ADS_PURCHASE_SEND_TO = 'AW-18489882041/Rj7-COPOg48dELnr1PBE';

/** IDs already reported in this tab, so a repeated callback can't count twice. */
const reported = new Set<string>();

export interface VerifiedPurchase {
  /** Our payment ID, sent as the transaction ID so Google de-duplicates. */
  id: string;
  /** The amount actually paid, after coupons, in `currency`. */
  amount: number;
  currency: string;
}

/**
 * Reports a purchase to Google Ads. Call it only after the server has
 * verified the payment. Does nothing on the server, when the Google tag is
 * blocked (e.g. by an ad blocker), or for a payment already reported.
 * Returns true when the event was sent.
 */
export function trackGoogleAdsPurchase(purchase: VerifiedPurchase): boolean {
  if (typeof window === 'undefined') return false;
  const gtag = (window as any).gtag;
  if (typeof gtag !== 'function') return false;
  const value = Number(purchase.amount);
  if (!purchase.id || !purchase.currency || !Number.isFinite(value) || value <= 0) return false;
  if (reported.has(purchase.id)) return false;
  reported.add(purchase.id);
  gtag('event', 'conversion', {
    send_to: GOOGLE_ADS_PURCHASE_SEND_TO,
    value,
    currency: purchase.currency,
    transaction_id: purchase.id,
  });
  return true;
}

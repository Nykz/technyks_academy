/**
 * Remembers a payment that was started but not yet confirmed, so a reload,
 * closed tab or return from Stripe can ask the server to re-check it with
 * the gateway. This is only a pointer: the server decides whether the
 * payment succeeded.
 */
const KEY = 'technyks-pending-payment';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export interface PendingPayment {
  paymentId: string;
  provider: 'RAZORPAY' | 'STRIPE';
  userId: string;
  startedAt: number;
}

export function savePendingPayment(payment: Omit<PendingPayment, 'startedAt'>) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...payment, startedAt: Date.now() }));
  } catch {
    // Storage blocked: the gateway webhook still completes the payment.
  }
}

/** The pending payment for this user, if recent. */
export function loadPendingPayment(userId: string | undefined | null): PendingPayment | null {
  if (!userId) return null;
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || 'null') as PendingPayment | null;
    if (!value?.paymentId || value.userId !== userId) return null;
    if (!(Date.now() - Number(value.startedAt) < MAX_AGE_MS)) {
      clearPendingPayment();
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

export function clearPendingPayment() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}

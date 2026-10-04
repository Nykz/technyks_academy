import * as crypto from 'crypto';

/** Stripe's API takes form-encoded bodies with bracketed keys (a[b][c]=…). */
export function stripeForm(values: Record<string, unknown>, prefix = ''): string[] {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === null) continue;
    const name = prefix ? `${prefix}[${key}]` : key;
    if (typeof value === 'object') {
      parts.push(...stripeForm(value as Record<string, unknown>, name));
    } else {
      parts.push(`${encodeURIComponent(name)}=${encodeURIComponent(String(value))}`);
    }
  }
  return parts;
}

/**
 * Checks a Stripe webhook's `Stripe-Signature` header (t=…,v1=…): an
 * HMAC-SHA256 of "t.payload" with the endpoint secret, at most
 * `toleranceSeconds` old so a captured request can't be replayed.
 */
export function verifyStripeSignature(
  payload: Buffer | string,
  header: string | undefined,
  secret: string,
  toleranceSeconds = 300,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  if (!header || !secret) return false;
  const fields = header.split(',').map((part) => part.trim().split('='));
  const timestamp = Number(fields.find(([key]) => key === 't')?.[1]);
  const signatures = fields.filter(([key]) => key === 'v1').map(([, value]) => value);
  if (!Number.isFinite(timestamp) || !signatures.length) return false;
  if (Math.abs(nowSeconds - timestamp) > toleranceSeconds) return false;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${Buffer.isBuffer(payload) ? payload.toString('utf8') : payload}`)
    .digest();
  return signatures.some((signature) => {
    if (!/^[a-f0-9]{64}$/i.test(signature || '')) return false;
    return crypto.timingSafeEqual(expected, Buffer.from(signature, 'hex'));
  });
}

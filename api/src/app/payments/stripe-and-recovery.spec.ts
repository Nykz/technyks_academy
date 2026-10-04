import { afterEach, describe, expect, it, vi } from 'vitest';
import * as crypto from 'crypto';
import { BadRequestException } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { stripeForm, verifyStripeSignature } from './stripe';

const config = (values: Record<string, string>) => ({ get: (key: string) => values[key] }) as any;
const KEYS = {
  STRIPE_SECRET_KEY: 'sk_test_fake',
  STRIPE_WEBHOOK_SECRET: 'whsec_fake',
  RAZORPAY_KEY_ID: 'rzp_test_fake',
  RAZORPAY_KEY_SECRET: 'rzp_secret_fake',
  WEB_APP_URL: 'https://technyks.com',
};

/** In-memory service with a course and FX rates; gateway HTTP is faked. */
function setup(extra: Record<string, string> = {}) {
  const prisma: any = {
    isDbConnected: false,
    inMemoryCourses: [
      { id: 'course-1', title: 'Angular Course', price: 999, isFree: false, isPublished: true, currency: 'INR' },
      { id: 'tiny', title: 'Tiny Price Course', price: 1, isFree: false, isPublished: true, currency: 'INR' },
      { id: 'half-rupee', title: 'Half Rupee Course', price: 0.5, isFree: false, isPublished: true, currency: 'INR' },
    ],
    inMemoryEnrollments: [],
    inMemoryPayments: [],
    inMemoryUiTemplatePurchases: [],
    inMemoryMembershipPlans: [],
  };
  const fx: any = { rateFor: async (code: string) => (code === 'INR' ? 1 : code === 'USD' ? 0.012 : null) };
  const service = new PaymentsService(prisma, { incrementUsage: vi.fn() } as any, config({ ...KEYS, ...extra }), undefined, fx);
  return { service, prisma };
}

function fakeFetch(routes: Record<string, (init: any) => unknown>) {
  const calls: { url: string; init: any }[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: any) => {
    calls.push({ url, init });
    const route = Object.keys(routes).find((prefix) => url.startsWith(prefix));
    if (!route) return { ok: false, status: 404, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => routes[route](init) };
  }));
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe('Stripe helpers', () => {
  it('form-encodes nested Stripe parameters', () => {
    expect(stripeForm({ mode: 'payment', line_items: { 0: { price_data: { currency: 'usd', unit_amount: 1199 } } } }).join('&'))
      .toBe('mode=payment&line_items%5B0%5D%5Bprice_data%5D%5Bcurrency%5D=usd&line_items%5B0%5D%5Bprice_data%5D%5Bunit_amount%5D=1199');
  });

  it('accepts only correctly signed, recent webhooks', () => {
    const payload = '{"type":"checkout.session.completed"}';
    const now = 1_800_000_000;
    const sign = (t: number) => `t=${t},v1=${crypto.createHmac('sha256', 'whsec_fake').update(`${t}.${payload}`).digest('hex')}`;
    expect(verifyStripeSignature(payload, sign(now), 'whsec_fake', 300, now)).toBe(true);
    expect(verifyStripeSignature(payload, sign(now), 'wrong-secret', 300, now)).toBe(false);
    expect(verifyStripeSignature(payload + ' ', sign(now), 'whsec_fake', 300, now)).toBe(false); // tampered
    expect(verifyStripeSignature(payload, sign(now - 3600), 'whsec_fake', 300, now)).toBe(false); // replayed
    expect(verifyStripeSignature(payload, undefined, 'whsec_fake', 300, now)).toBe(false);
  });
});

describe('Stripe checkout', () => {
  it('creates a Stripe Checkout session in the buyer currency and a PENDING payment', async () => {
    const { service, prisma } = setup();
    const calls = fakeFetch({
      'https://api.stripe.com/v1/checkout/sessions': () => ({ id: 'cs_test_1', url: 'https://checkout.stripe.com/c/pay/cs_test_1' }),
    });
    const order: any = await service.createCheckoutOrder({ userId: 'u1', courseId: 'course-1', provider: 'STRIPE', currency: 'USD' });

    expect(order).toMatchObject({ provider: 'STRIPE', checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_test_1', currency: 'USD', displayAmount: 11.99 });
    const body = decodeURIComponent(calls[0].init.body);
    expect(calls[0].init.headers.Authorization).toBe('Bearer sk_test_fake');
    expect(body).toContain('line_items[0][price_data][currency]=usd');
    expect(body).toContain('line_items[0][price_data][unit_amount]=1199');
    expect(body).toContain(`client_reference_id=${order.paymentId}`);
    expect(body).toContain('billing_address_collection=required');
    expect(body).toContain('payment_intent_data[description]=Angular Course');
    expect(body).toContain(`success_url=https://technyks.com/checkout?payment_return=${order.paymentId}`);
    expect(prisma.inMemoryPayments[0]).toMatchObject({
      id: order.paymentId, provider: 'STRIPE', status: 'PENDING', paymentIntentId: 'cs_test_1',
      amount: 11.99, currency: 'USD', amountInr: 999, courseId: 'course-1',
    });
  });

  it('verifies the returned session with Stripe before enrolling', async () => {
    const { service, prisma } = setup();
    prisma.inMemoryPayments.push({ id: 'p1', userId: 'u1', provider: 'STRIPE', status: 'PENDING', paymentIntentId: 'cs_1',
      amount: 11.99, currency: 'USD', amountInr: 999, courseId: 'course-1' });
    fakeFetch({ 'https://api.stripe.com/v1/checkout/sessions/cs_1': () => ({
      id: 'cs_1', client_reference_id: 'p1', payment_status: 'paid', status: 'complete', amount_total: 1199, currency: 'usd',
    }) });

    const verified: any = await service.verifyStripePayment('u1', 'p1');
    expect(verified).toMatchObject({ id: 'p1', status: 'SUCCESS', amountInr: 999 });
    expect(prisma.inMemoryEnrollments).toEqual([expect.objectContaining({ userId: 'u1', courseId: 'course-1' })]);
  });

  it('refuses unpaid sessions, wrong amounts and other users', async () => {
    const { service, prisma } = setup();
    prisma.inMemoryPayments.push({ id: 'p2', userId: 'u1', provider: 'STRIPE', status: 'PENDING', paymentIntentId: 'cs_2',
      amount: 11.99, currency: 'USD', courseId: 'course-1' });
    fakeFetch({ 'https://api.stripe.com/v1/checkout/sessions/cs_2': () => ({
      id: 'cs_2', client_reference_id: 'p2', payment_status: 'paid', amount_total: 100, currency: 'usd',
    }) });
    await expect(service.verifyStripePayment('u1', 'p2')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.verifyStripePayment('someone-else', 'p2')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.inMemoryEnrollments).toHaveLength(0);
  });

  it('completes the payment from a signed Stripe webhook', async () => {
    const { service, prisma } = setup();
    prisma.inMemoryPayments.push({ id: 'p3', userId: 'u1', provider: 'STRIPE', status: 'PENDING', paymentIntentId: 'cs_3',
      amount: 11.99, currency: 'USD', courseId: 'course-1' });
    const payload = JSON.stringify({ type: 'checkout.session.completed', data: { object: {
      id: 'cs_3', client_reference_id: 'p3', payment_status: 'paid', amount_total: 1199, currency: 'usd' } } });
    const t = Math.floor(Date.now() / 1000);
    const header = `t=${t},v1=${crypto.createHmac('sha256', 'whsec_fake').update(`${t}.${payload}`).digest('hex')}`;

    await expect(service.handleStripeWebhook(Buffer.from(payload), header)).resolves.toMatchObject({ processed: true });
    expect(prisma.inMemoryPayments[0].status).toBe('SUCCESS');
    await expect(service.handleStripeWebhook(Buffer.from(payload), 't=1,v1=00')).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('payment recovery after a reload or closed tab', () => {
  it('Razorpay: completes the enrollment if the order was captured', async () => {
    const { service, prisma } = setup();
    prisma.inMemoryPayments.push({ id: 'r1', userId: 'u1', provider: 'RAZORPAY', status: 'PENDING', paymentIntentId: 'order_1',
      amount: 999, currency: 'INR', amountInr: 999, courseId: 'course-1' });
    fakeFetch({ 'https://api.razorpay.com/v1/orders/order_1/payments': () => ({ items: [
      { id: 'pay_1', order_id: 'order_1', status: 'captured', amount: 99900, currency: 'INR' },
    ] }) });

    const result: any = await service.reconcilePayment('u1', 'r1');
    expect(result.status).toBe('SUCCESS');
    expect(result.payment).toMatchObject({ id: 'r1', status: 'SUCCESS', amountInr: 999 });
    expect(prisma.inMemoryEnrollments).toHaveLength(1);
  });

  it('Razorpay: tells "never paid" apart from "still processing"', async () => {
    const { service, prisma } = setup();
    prisma.inMemoryPayments.push({ id: 'r2', userId: 'u1', provider: 'RAZORPAY', status: 'PENDING', paymentIntentId: 'order_2',
      amount: 999, currency: 'INR', courseId: 'course-1' });
    fakeFetch({ 'https://api.razorpay.com/v1/orders/order_2/payments': () => ({ items: [] }) });
    expect(await service.reconcilePayment('u1', 'r2')).toEqual({ status: 'UNPAID' });

    fakeFetch({ 'https://api.razorpay.com/v1/orders/order_2/payments': () => ({ items: [
      { id: 'pay_2', order_id: 'order_2', status: 'authorized', amount: 99900, currency: 'INR' },
    ] }) });
    expect(await service.reconcilePayment('u1', 'r2')).toEqual({ status: 'PENDING' });
    expect(prisma.inMemoryEnrollments).toHaveLength(0);
  });

  it('does not let one user reconcile another user\'s payment', async () => {
    const { service, prisma } = setup();
    prisma.inMemoryPayments.push({ id: 'r3', userId: 'u1', provider: 'RAZORPAY', status: 'PENDING', paymentIntentId: 'order_3',
      amount: 999, currency: 'INR' });
    await expect(service.reconcilePayment('intruder', 'r3')).rejects.toThrow('Payment not found.');
  });

  it('reports availability of each gateway from the server keys', () => {
    expect(setup().service.getCheckoutAvailability()).toMatchObject({ razorpay: true, stripe: true });
    expect(setup({ STRIPE_SECRET_KEY: '' }).service.getCheckoutAvailability()).toMatchObject({ stripe: false });
  });
});

describe('gateway minimum amounts', () => {
  it('refuses a Stripe total below US$0.50 with a clear message, without calling Stripe', async () => {
    const { service, prisma } = setup();
    const calls = fakeFetch({});
    await expect(service.createCheckoutOrder({ userId: 'u1', courseId: 'tiny', provider: 'STRIPE', currency: 'USD' }))
      .rejects.toThrow('Card payments must be at least $0.50');
    expect(calls).toHaveLength(0);
    expect(prisma.inMemoryPayments).toHaveLength(0);
  });

  it('refuses a Razorpay total below ₹1', async () => {
    const { service } = setup();
    const calls = fakeFetch({});
    await expect(service.createCheckoutOrder({ userId: 'u1', courseId: 'half-rupee', provider: 'RAZORPAY', currency: 'INR' }))
      .rejects.toThrow('minimum ₹1');
    expect(calls).toHaveLength(0);
  });

  it('lets normal totals through', async () => {
    const { service } = setup();
    fakeFetch({ 'https://api.razorpay.com/v1/orders': () => ({ id: 'order_ok' }) });
    await expect(service.createCheckoutOrder({ userId: 'u1', courseId: 'course-1', provider: 'RAZORPAY', currency: 'INR' }))
      .resolves.toMatchObject({ provider: 'RAZORPAY', razorpayOrderId: 'order_ok' });
  });
});

describe('gateway errors at checkout', () => {
  function failingStripe() {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 400, json: async () => ({ error: { message: 'As per Indian regulations, export transactions require a description.' } }) })));
  }

  it('shows the gateway reason to admins only', async () => {
    const { service } = setup();
    const controller = new PaymentsController(service, {} as any);
    failingStripe();
    const order = { courseId: 'course-1', provider: 'STRIPE' as const, currency: 'USD' };

    await expect(controller.createOrder({ user: { id: 'a1', role: 'ADMIN' } }, order))
      .rejects.toThrow('Admin only: Stripe (400): As per Indian regulations');
    const student = controller.createOrder({ user: { id: 's1', role: 'STUDENT' } }, order);
    await expect(student).rejects.toThrow('Payment provider could not process the request. Please retry.');
    await expect(controller.createOrder({ user: { id: 's1', role: 'STUDENT' } }, order)).rejects.not.toThrow('Admin only');
  });
});

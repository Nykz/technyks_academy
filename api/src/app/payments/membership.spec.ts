import { afterEach, describe, expect, it, vi } from 'vitest';
import { PaymentsService } from './payments.service';
import { EnrollmentsService } from '../enrollments/enrollments.service';
import {
  MembershipAccessService,
  enrollmentAllowed,
  membershipPeriodEnd,
} from '../membership/membership-access.service';

const config = (values: Record<string, string>) => ({ get: (key: string) => values[key] }) as any;
const KEYS = { RAZORPAY_KEY_ID: 'rzp_test_fake', RAZORPAY_KEY_SECRET: 'rzp_secret_fake', WEB_APP_URL: 'https://technyks.com' };

/** In-memory academy: two courses, an all-access plan and a one-course plan. */
function setup() {
  const prisma: any = {
    isDbConnected: false,
    inMemoryCourses: [
      { id: 'c1', slug: 'c1', title: 'Course One', price: 999, isPublished: true, currency: 'INR', modules: [] },
      { id: 'c2', slug: 'c2', title: 'Course Two', price: 999, isPublished: true, currency: 'INR', modules: [] },
      { id: 'draft', slug: 'draft', title: 'Draft', price: 999, isPublished: false, currency: 'INR', modules: [] },
    ],
    inMemoryEnrollments: [],
    inMemoryPayments: [],
    inMemoryUiTemplatePurchases: [],
    inMemorySubscriptions: [],
    inMemoryMembershipPlans: [
      { id: 'annual', slug: 'all-access-annual', name: 'All-Access Annual', price: 11999, currency: 'INR', interval: 'ANNUAL', isActive: true, accessAllCourses: true },
      { id: 'one', slug: 'one-course', name: 'Course One Pass', price: 499, currency: 'INR', interval: 'MONTHLY', isActive: true, accessAllCourses: false, courseIds: ['c1'] },
    ],
    inMemoryCoupons: [],
  };
  const membership = new MembershipAccessService(prisma);
  const fx: any = { rateFor: async (code: string) => (code === 'INR' ? 1 : code === 'USD' ? 0.012 : null) };
  const payments = new PaymentsService(prisma, { incrementUsage: vi.fn() } as any, config(KEYS), undefined, fx, membership);
  const enrollments = new EnrollmentsService(prisma, undefined, membership);
  return { prisma, payments, enrollments, membership };
}

afterEach(() => vi.unstubAllGlobals());

describe('membership periods', () => {
  it('lasts a month or a year', () => {
    const from = new Date('2026-01-15T00:00:00Z');
    expect(membershipPeriodEnd('MONTHLY', from).toISOString()).toBe('2026-02-15T00:00:00.000Z');
    expect(membershipPeriodEnd('ANNUAL', from).toISOString()).toBe('2027-01-15T00:00:00.000Z');
  });

  it('counts membership courses only while the membership is active', () => {
    expect(enrollmentAllowed({ membershipPlanId: null }, new Set())).toBe(true);
    expect(enrollmentAllowed({ membershipPlanId: 'annual' }, new Set(['annual']))).toBe(true);
    expect(enrollmentAllowed({ membershipPlanId: 'annual' }, new Set())).toBe(false);
    expect(enrollmentAllowed(null, new Set(['annual']))).toBe(false);
  });
});

describe('membership checkout', () => {
  it('creates a Razorpay order for the plan price', async () => {
    const { payments, prisma } = setup();
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ id: 'order_1' }) })));
    const order: any = await payments.createCheckoutOrder({ userId: 'u1', planId: 'all-access-annual', provider: 'RAZORPAY', currency: 'INR' });
    expect(order.provider).toBe('RAZORPAY');
    expect(order.amount).toBe(1199900);
    expect(prisma.inMemoryPayments[0]).toMatchObject({ planId: 'annual', status: 'PENDING', amount: 11999 });
  });

  it('sends a cancelled Stripe buyer back to the plan checkout', async () => {
    const { prisma } = setup();
    const membership = new MembershipAccessService(prisma);
    const fx: any = { rateFor: async (code: string) => (code === 'INR' ? 1 : code === 'USD' ? 0.012 : null) };
    const payments = new PaymentsService(prisma, { incrementUsage: vi.fn() } as any,
      config({ ...KEYS, STRIPE_SECRET_KEY: 'sk_test_fake' }), undefined, fx, membership);
    let body = '';
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: any) => {
      body = String(init?.body || '');
      return { ok: true, status: 200, json: async () => ({ id: 'cs_1', url: 'https://checkout.stripe.com/x' }) };
    }));
    await payments.createCheckoutOrder({ userId: 'u1', planId: 'annual', provider: 'STRIPE', currency: 'USD' });
    expect(decodeURIComponent(body)).toContain('/checkout?planSlug=all-access-annual&payment_cancelled=');
  });

  it('activates the membership when the payment is confirmed, once', async () => {
    const { payments, prisma, enrollments } = setup();
    prisma.inMemoryPayments.push({ id: 'p1', userId: 'u1', planId: 'annual', amount: 11999, currency: 'INR', status: 'PENDING' });
    await payments.confirmPaymentSuccess('p1');
    await payments.confirmPaymentSuccess('p1'); // webhook + verify both report it
    expect(prisma.inMemorySubscriptions).toHaveLength(1);
    const end = new Date(prisma.inMemorySubscriptions[0].currentPeriodEnd).getTime();
    expect(end - Date.now()).toBeGreaterThan(360 * 24 * 3600 * 1000);

    // Every published course is unlocked; the draft is not.
    expect((await enrollments.getCourseAccess('u1', 'c1')).enrolled).toBe(true);
    expect((await enrollments.getCourseAccess('u1', 'c2')).enrolled).toBe(true);
    expect((await enrollments.getCourseAccess('u1', 'draft')).enrolled).toBe(false);
    expect((await enrollments.getMyEnrollments('u1')).map((item: any) => item.courseId).sort()).toEqual(['c1', 'c2']);
    expect(await payments.getMyMemberships('u1')).toEqual([
      expect.objectContaining({ planId: 'annual', name: 'All-Access Annual', accessAllCourses: true }),
    ]);
  });

  it('adds a full period when renewing early', async () => {
    const { payments, prisma } = setup();
    prisma.inMemoryPayments.push(
      { id: 'p1', userId: 'u1', planId: 'one', amount: 499, currency: 'INR', status: 'PENDING' },
      { id: 'p2', userId: 'u1', planId: 'one', amount: 499, currency: 'INR', status: 'PENDING' },
    );
    await payments.confirmPaymentSuccess('p1');
    const firstEnd = new Date(prisma.inMemorySubscriptions[0].currentPeriodEnd);
    await payments.confirmPaymentSuccess('p2');
    expect(prisma.inMemorySubscriptions).toHaveLength(1);
    expect(new Date(prisma.inMemorySubscriptions[0].currentPeriodEnd).toISOString())
      .toBe(membershipPeriodEnd('MONTHLY', firstEnd).toISOString());
  });

  it('a one-course plan unlocks only that course', async () => {
    const { payments, prisma, enrollments } = setup();
    prisma.inMemoryPayments.push({ id: 'p1', userId: 'u1', planId: 'one', amount: 499, currency: 'INR', status: 'PENDING' });
    await payments.confirmPaymentSuccess('p1');
    expect((await enrollments.getCourseAccess('u1', 'c1')).enrolled).toBe(true);
    expect((await enrollments.getCourseAccess('u1', 'c2')).enrolled).toBe(false);
  });

  it('access ends with the membership, but bought courses stay', async () => {
    const { payments, prisma, enrollments } = setup();
    prisma.inMemoryPayments.push({ id: 'p1', userId: 'u1', planId: 'annual', amount: 11999, currency: 'INR', status: 'PENDING' });
    await payments.confirmPaymentSuccess('p1');
    await enrollments.getMyEnrollments('u1'); // member opens the dashboard: courses unlocked

    // Bought Course Two on its own as well.
    prisma.inMemoryPayments.push({ id: 'p2', userId: 'u1', courseId: 'c2', amount: 999, currency: 'INR', status: 'PENDING' });
    await payments.confirmPaymentSuccess('p2');
    prisma.inMemoryEnrollments.find((item: any) => item.courseId === 'c2').membershipPlanId = null;

    // The membership runs out.
    prisma.inMemorySubscriptions[0].currentPeriodEnd = new Date(Date.now() - 1000);
    expect((await enrollments.getCourseAccess('u1', 'c1')).enrolled).toBe(false);
    expect((await enrollments.getCourseAccess('u1', 'c2')).enrolled).toBe(true);
    expect((await enrollments.getMyEnrollments('u1')).map((item: any) => item.courseId)).toEqual(['c2']);
    await expect(enrollments.updateProgress('u1', { courseId: 'c1', lessonId: 'x' })).rejects.toThrow();
  });

  it('refuses a plan that is not on sale', async () => {
    const { payments, prisma } = setup();
    prisma.inMemoryMembershipPlans[0].isActive = false;
    await expect(payments.createCheckoutOrder({ userId: 'u1', planId: 'annual' })).rejects.toThrow('not available');
  });
});

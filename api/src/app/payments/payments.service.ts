import { ServiceUnavailableException } from '@nestjs/common';
import { Injectable, BadRequestException, Logger, NotFoundException, OnModuleInit, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CouponsService } from '../coupons/coupons.service';
import { TemplatesService } from '../templates/templates.service';
import { coursePayablePrice } from '../courses/course-price';
import { FxService } from '../fx/fx.module';
import { chargeCurrencyFor, convertFromInr, toMinorUnits } from '../fx/currency';
import { stripeForm, verifyStripeSignature } from './stripe';
import { MembershipAccessService, membershipPeriodEnd } from '../membership/membership-access.service';

type CheckoutProvider = 'RAZORPAY' | 'LEMON_SQUEEZY' | 'STRIPE';

const INITIAL_PLANS = [
  {
    id: 'plan_free',
    name: 'Free Tier',
    slug: 'free',
    description: 'Start learning with previews, community access, and academy updates.',
    price: 0,
    currency: 'INR',
    interval: 'MONTHLY',
    isFree: true,
    isActive: true,
    accessAllCourses: false,
    features: ['Free preview lessons', 'Community access', 'Newsletter updates'],
  },
  {
    id: 'plan_pro_monthly',
    name: 'Pro Monthly',
    slug: 'pro-monthly',
    description: 'A focused membership for engineers building production systems.',
    price: 1499,
    currency: 'INR',
    interval: 'MONTHLY',
    isFree: false,
    isActive: true,
    accessAllCourses: true,
    features: ['All Architecture Tracks', 'Source code downloads', 'Q&A forum priority', 'Discord role'],
  },
  {
    id: 'plan_all_access_annual',
    name: 'All-Access Annual',
    slug: 'all-access-annual',
    description: 'The complete Technyks learning program with every current and future course.',
    price: 11999,
    currency: 'INR',
    interval: 'ANNUAL',
    isFree: false,
    isActive: true,
    accessAllCourses: true,
    features: ['All Architecture Tracks + future tracks', '1-on-1 Architecture review', 'Auto-generated Certificates', 'RBI UPI Autopay e-mandate'],
  },
];

@Injectable()
export class PaymentsService implements OnModuleInit {
  constructor(
    private prisma: PrismaService,
    private couponsService: CouponsService,
    private config: ConfigService = new ConfigService(),
    private templatesService?: TemplatesService,
    private fx?: FxService,
    @Optional() private membership?: MembershipAccessService,
  ) {}

  /**
   * What to charge for an INR price: the visitor's currency (converted at
   * the server's rate) when we can, otherwise rupees.
   */
  async quoteInCurrency(amountInr: number, requested?: string) {
    const currency = chargeCurrencyFor(requested);
    const rate = currency === 'INR' ? 1 : await this.fx?.rateFor(currency);
    if (!rate) {
      return { currency: 'INR', amount: convertFromInr(amountInr, 'INR', 1), minor: toMinorUnits(amountInr, 'INR') };
    }
    const amount = convertFromInr(amountInr, currency, rate);
    return { currency, amount, minor: toMinorUnits(amount, currency) };
  }

  async onModuleInit() {
    await this.seedMembershipPlans();
  }

  async seedMembershipPlans() {
    if (this.prisma.isDbConnected) {
      try {
        const count = await this.prisma.membershipPlan.count();
        if (count === 0) {
          await this.prisma.membershipPlan.createMany({ data: INITIAL_PLANS.map(({ id, ...plan }) => plan) as any });
        }
        return;
      } catch {
        throw new ServiceUnavailableException('Your data could not be loaded or saved. Please retry shortly.');
      }
    }

    if (this.prisma.inMemoryMembershipPlans.length === 0) {
      this.prisma.inMemoryMembershipPlans = INITIAL_PLANS.map(plan => ({
        ...plan,
        courseAccess: [],
      }));
    }
  }

  async getMembershipPlans(includeInactive = false) {
    if (this.prisma.isDbConnected) {
      try {
        return await this.prisma.membershipPlan.findMany({
          where: includeInactive ? undefined : { isActive: true },
          include: { courseAccess: { select: { courseId: true } } },
          orderBy: { price: 'asc' },
        });
      } catch {
        throw new ServiceUnavailableException('Your data could not be loaded or saved. Please retry shortly.');
      }
    }

    return this.prisma.inMemoryMembershipPlans
      .filter((plan) => includeInactive || plan.isActive !== false)
      .sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
  }

  getCheckoutAvailability() {
    return {
      razorpay: Boolean(this.config.get<string>('RAZORPAY_KEY_ID') && this.config.get<string>('RAZORPAY_KEY_SECRET')),
      stripe: Boolean(this.config.get<string>('STRIPE_SECRET_KEY')),
      lemonSqueezy: false,
      memberships: true,
    };
  }

  async createCheckoutOrder(dto: {
    userId: string; courseId?: string; planId?: string; templateProductIds?: string[]; couponCode?: string;
    provider?: CheckoutProvider; currency?: string;
  }) {
    if (dto.templateProductIds?.length) {
      if (dto.courseId || dto.planId) {
        throw new BadRequestException('Course and template purchases must be checked out separately.');
      }
      if (dto.couponCode && dto.templateProductIds.length > 1) {
        throw new BadRequestException('A coupon can only be applied when checking out a single template.');
      }
      return this.createTemplateCheckoutOrder(dto.userId, dto.templateProductIds, dto.provider, dto.couponCode, dto.currency);
    }
    if (dto.planId) {
      if (dto.courseId) throw new BadRequestException('Course and membership purchases must be checked out separately.');
      return this.createMembershipCheckoutOrder({ ...dto, planId: dto.planId });
    }
    if (!dto.courseId) throw new BadRequestException('Choose a course before checking out.');
    const course = await this.findCourse(dto.courseId);
    if (!course || course.isPublished === false) throw new NotFoundException('Course not found.');
    const owned = this.prisma.isDbConnected
      ? await this.prisma.enrollment.findUnique({ where: { userId_courseId: { userId: dto.userId, courseId: course.id } } })
      : this.prisma.inMemoryEnrollments.find(e => e.userId === dto.userId && e.courseId === course.id);
    // Access through a membership is not ownership: members (or past members)
    // can still buy the course to keep it for good.
    const viaMembership = Boolean((owned as any)?.membershipPlanId);
    if (owned && !viaMembership) return { provider: 'FREE', completed: true, alreadyEnrolled: true, amount: 0, currency: course.currency, title: course.title };

    const originalAmount = course.isFree ? 0 : coursePayablePrice(course);
    if (!Number.isFinite(originalAmount) || originalAmount < 0) throw new BadRequestException('Invalid course price.');
    const couponCode = dto.couponCode?.trim().toUpperCase() || null;
    const validate = async (client?: any) => couponCode
      ? this.couponsService.validateCoupon(couponCode, originalAmount, { type: 'COURSE', courseId: course.id }, client)
      : { finalAmount: originalAmount };
    const quote = await validate();
    const amount = Math.round(quote.finalAmount * 100);
    if (amount === 0) {
      const redeem = async (db: any) => {
        // Revalidate and reserve the coupon within the same transaction as ownership.
        await validate(db);
        if (couponCode) {
          const coupon = await db.coupon.findUnique({ where: { code: couponCode } });
          const reserved = await db.coupon.updateMany({
            where: { id: coupon.id, isActive: true,
              ...(coupon.usageLimit == null ? {} : { timesUsed: { lt: coupon.usageLimit } }) },
            data: { timesUsed: { increment: 1 } },
          });
          if (!reserved.count) throw new BadRequestException('This coupon is no longer available.');
        }
        // create (not upsert) means a concurrent repeat rolls back its coupon usage.
        // A membership enrollment is kept (with its progress) and made permanent.
        const enrollment = viaMembership
          ? await db.enrollment.update({ where: { id: (owned as any).id }, data: { membershipPlanId: null } as any })
          : await db.enrollment.create({ data: {
              userId: dto.userId, courseId: course.id, completedLessonIds: [], progressPercent: 0,
            } });
        await db.payment.create({ data: { userId: dto.userId, courseId: course.id, amount: 0,
          currency: course.currency, status: 'SUCCESS', provider: 'RAZORPAY', couponCode } });
        return enrollment;
      };
      if (this.prisma.isDbConnected) {
        try { await this.prisma.$transaction(redeem); }
        catch (error: any) {
          if (error?.code !== 'P2002') throw error;
          const existing = await this.prisma.enrollment.findUnique({ where: { userId_courseId: { userId: dto.userId, courseId: course.id } } });
          if (!existing) throw error;
        }
      } else {
        const memberCopy = this.prisma.inMemoryEnrollments.find(e => e.userId === dto.userId && e.courseId === course.id && e.membershipPlanId);
        if (memberCopy) memberCopy.membershipPlanId = null;
        if (!this.prisma.inMemoryEnrollments.some(e => e.userId === dto.userId && e.courseId === course.id)) {
          if (couponCode) await this.couponsService.incrementUsage(couponCode);
          this.prisma.inMemoryEnrollments.push({ id: crypto.randomUUID(), userId: dto.userId, courseId: course.id, course,
            progressPercent: 0, completedLessonIds: [], createdAt: new Date(), updatedAt: new Date() });
          this.prisma.inMemoryPayments.push({ id: crypto.randomUUID(), userId: dto.userId, courseId: course.id, amount: 0,
            currency: course.currency, status: 'SUCCESS', provider: 'RAZORPAY', couponCode, createdAt: new Date(), updatedAt: new Date() });
        }
      }
      return { provider: 'FREE', completed: true, amount: 0, currency: course.currency, title: course.title };
    }

    return this.startGatewayOrder({
      userId: dto.userId,
      provider: dto.provider,
      title: course.title,
      amountInr: amount / 100,
      requestedCurrency: dto.currency,
      couponCode,
      courseId: course.id,
    });
  }

  private get webAppUrl() {
    return String(this.config.get<string>('WEB_APP_URL') || 'https://technyks.com').replace(/\/$/, '');
  }

  /**
   * Creates the gateway order (Razorpay order or Stripe Checkout session)
   * and the PENDING payment row for a paid checkout. The payment ID is made
   * first so Stripe can send the buyer back to it.
   */
  private async startGatewayOrder(p: {
    userId: string;
    provider?: CheckoutProvider;
    title: string;
    amountInr: number | null;
    requestedCurrency?: string;
    fixedCharge?: { currency: string; amount: number; minor: number };
    couponCode: string | null;
    courseId?: string;
    templateProductIds?: string[];
    planId?: string;
    /** Checkout query that reopens this order if the buyer cancels on Stripe. */
    returnQuery?: string;
  }) {
    if (p.provider === 'LEMON_SQUEEZY') throw new BadRequestException('This payment method is not available. Please choose another.');
    const charge = p.fixedCharge ?? (await this.quoteInCurrency(Number(p.amountInr), p.requestedCurrency));
    await this.assertAboveGatewayMinimum(p.provider === 'STRIPE' ? 'STRIPE' : 'RAZORPAY', charge);
    const paymentId = crypto.randomUUID();
    const base = {
      id: paymentId, userId: p.userId, amount: charge.amount, currency: charge.currency, amountInr: p.amountInr,
      status: 'PENDING', couponCode: p.couponCode,
      ...(p.courseId ? { courseId: p.courseId } : {}),
      ...(p.templateProductIds ? { templateProductIds: p.templateProductIds } : {}),
      ...(p.planId ? { planId: p.planId } : {}),
    };

    if (p.provider === 'STRIPE') {
      const returnTo = p.returnQuery || (p.courseId ? `courseId=${encodeURIComponent(p.courseId)}` : 'templateCart=1');
      const session = await this.stripeRequest('checkout/sessions', {
        mode: 'payment',
        client_reference_id: paymentId,
        // Indian Stripe accounts must collect the buyer's name and billing
        // address for international (export) card payments.
        billing_address_collection: 'required',
        success_url: `${this.webAppUrl}/checkout?payment_return=${paymentId}`,
        cancel_url: `${this.webAppUrl}/checkout?${returnTo}&payment_cancelled=${paymentId}`,
        metadata: { payment_id: paymentId },
        // Indian rules: export (international) payments need a description.
        payment_intent_data: { description: p.title, metadata: { payment_id: paymentId } },
        line_items: {
          0: {
            quantity: 1,
            price_data: { currency: charge.currency.toLowerCase(), unit_amount: charge.minor, product_data: { name: p.title } },
          },
        },
      });
      await this.savePayment({ ...base, provider: 'STRIPE', paymentIntentId: session.id });
      return { provider: 'STRIPE', paymentId, checkoutUrl: session.url, amount: charge.minor, displayAmount: charge.amount,
        currency: charge.currency, title: p.title };
    }

    const order = await this.razorpayRequest('orders', { amount: charge.minor, currency: charge.currency, receipt: paymentId, partial_payment: false });
    await this.savePayment({ ...base, provider: 'RAZORPAY', paymentIntentId: order.id });
    return { provider: 'RAZORPAY', paymentId, razorpayOrderId: order.id,
      razorpayKeyId: this.config.get<string>('RAZORPAY_KEY_ID'), amount: charge.minor, displayAmount: charge.amount,
      currency: charge.currency, title: p.title };
  }

  /**
   * Gateways refuse very small charges (Stripe: about US$0.50 in any
   * currency; Razorpay: ₹1). Check first so the buyer gets a clear message
   * instead of a generic gateway error, e.g. after a big coupon.
   */
  private async assertAboveGatewayMinimum(provider: 'STRIPE' | 'RAZORPAY', charge: { currency: string; amount: number }) {
    const format = (amount: number, currency: string) =>
      new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', { style: 'currency', currency }).format(amount);
    if (provider === 'RAZORPAY') {
      const rate = charge.currency === 'INR' ? 1 : await this.fx?.rateFor(charge.currency);
      if (rate && charge.amount / rate < 1) {
        throw new BadRequestException(
          `The total is too small to pay online (minimum ${format(1, 'INR')}). Use a smaller coupon, or a 100% coupon to enroll for free.`,
        );
      }
      return;
    }
    const usdPerInr = await this.fx?.rateFor('USD');
    const currencyPerInr = charge.currency === 'INR' ? 1 : await this.fx?.rateFor(charge.currency);
    if (!usdPerInr || !currencyPerInr) return; // Can't check; Stripe will decide.
    const usd = (charge.amount / currencyPerInr) * usdPerInr;
    if (usd < 0.5) {
      const minimum = Math.ceil((0.5 / usdPerInr) * currencyPerInr * 100) / 100;
      throw new BadRequestException(
        `Card payments must be at least ${format(minimum, charge.currency)}. Use a smaller coupon, or a 100% coupon to enroll for free.`,
      );
    }
  }

  private async savePayment(data: Record<string, any>) {
    if (this.prisma.isDbConnected) return this.prisma.payment.create({ data: data as any });
    const payment = { ...data, createdAt: new Date(), updatedAt: new Date() };
    this.prisma.inMemoryPayments.push(payment);
    return payment;
  }

  /** Stripe Checkout session paid in full for exactly this payment. */
  private stripeSessionMatches(session: any, payment: any) {
    return Boolean(
      session &&
      session.id === payment.paymentIntentId &&
      session.client_reference_id === payment.id &&
      session.payment_status === 'paid' &&
      session.amount_total === toMinorUnits(Number(payment.amount), payment.currency) &&
      String(session.currency || '').toUpperCase() === payment.currency,
    );
  }

  /** Called when Stripe sends the buyer back: confirms with Stripe, then enrolls. */
  async verifyStripePayment(userId: string, paymentId: string) {
    const payment = await this.findPayment(paymentId);
    if (!payment || payment.userId !== userId || payment.provider !== 'STRIPE') {
      throw new BadRequestException('Payment verification failed.');
    }
    if (payment.status === 'SUCCESS') return { ...payment };
    const session = await this.stripeRequest(`checkout/sessions/${encodeURIComponent(payment.paymentIntentId)}`);
    if (!this.stripeSessionMatches(session, payment)) {
      throw new BadRequestException('Payment is not confirmed yet. Please retry verification or contact support.');
    }
    return this.confirmPaymentSuccess(payment.id);
  }

  /**
   * Re-checks a pending payment with its gateway, e.g. after the buyer
   * reloaded or closed the tab during payment. Completes the enrollment if
   * the gateway shows the full amount was captured.
   */
  async reconcilePayment(userId: string, paymentId: string) {
    const payment = await this.findPayment(paymentId);
    if (!payment || payment.userId !== userId) throw new NotFoundException('Payment not found.');
    if (payment.status === 'SUCCESS') return { status: 'SUCCESS', payment: { ...payment } };
    if (payment.status !== 'PENDING') return { status: payment.status };

    if (payment.provider === 'STRIPE') {
      const session = await this.stripeRequest(`checkout/sessions/${encodeURIComponent(payment.paymentIntentId)}`);
      if (this.stripeSessionMatches(session, payment)) {
        return { status: 'SUCCESS', payment: await this.confirmPaymentSuccess(payment.id) };
      }
      if (session?.status === 'expired') return { status: 'EXPIRED' };
      // 'complete' but not yet paid = a delayed payment method still processing.
      return { status: session?.status === 'complete' ? 'PENDING' : 'UNPAID' };
    }
    if (payment.provider === 'RAZORPAY') {
      const result = await this.razorpayRequest(`orders/${encodeURIComponent(payment.paymentIntentId)}/payments`);
      const captured = (result?.items || []).find((item: any) =>
        item.status === 'captured' && item.order_id === payment.paymentIntentId &&
        item.amount === toMinorUnits(Number(payment.amount), payment.currency) && item.currency === payment.currency);
      if (captured) return { status: 'SUCCESS', payment: await this.confirmPaymentSuccess(payment.id) };
      // 'authorized' = bank approved, capture still in progress.
      const inProgress = (result?.items || []).some((item: any) => ['created', 'authorized'].includes(item.status));
      return { status: inProgress ? 'PENDING' : 'UNPAID' };
    }
    return { status: 'PENDING' };
  }

  /** Stripe webhook: completes payments even if the buyer never returns. */
  async handleStripeWebhook(rawBody: Buffer | undefined, signature: string | undefined) {
    const secret = this.config.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!secret) throw new ServiceUnavailableException('Stripe webhook is not configured.');
    if (!rawBody || !verifyStripeSignature(rawBody, signature, secret)) {
      throw new BadRequestException('Invalid Stripe webhook signature.');
    }
    let event: any;
    try { event = JSON.parse(rawBody.toString('utf8')); }
    catch { throw new BadRequestException('Invalid Stripe webhook payload.'); }
    if (!['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event?.type)) {
      return { received: true, processed: false };
    }
    const session = event?.data?.object;
    if (!session?.id || session.payment_status !== 'paid') return { received: true, processed: false };
    const payment = this.prisma.isDbConnected
      ? await this.prisma.payment.findFirst({ where: { paymentIntentId: session.id } })
      : this.prisma.inMemoryPayments.find((item) => item.paymentIntentId === session.id);
    if (!payment) return { received: true, processed: false };
    if (!this.stripeSessionMatches(session, payment)) {
      throw new BadRequestException('Stripe webhook amount does not match the order.');
    }
    await this.confirmPaymentSuccess(payment.id);
    return { received: true, processed: true };
  }

  verifyRazorpaySignature(orderId: string, paymentId: string, signature: string, secret?: string): boolean {
    const key = secret || this.config.get<string>('RAZORPAY_KEY_SECRET');
    if (!key || !/^[a-f0-9]{64}$/i.test(signature || '')) return false;
    const expected = crypto.createHmac('sha256', key).update(`${orderId}|${paymentId}`).digest();
    return crypto.timingSafeEqual(expected, Buffer.from(signature, 'hex'));
  }

  async verifyPayment(userId: string, dto: { paymentId: string; razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string }) {
    const payment = await this.findPayment(dto.paymentId);
    if (!payment || payment.userId !== userId || payment.provider !== 'RAZORPAY' ||
      payment.paymentIntentId !== dto.razorpayOrderId ||
      !this.verifyRazorpaySignature(payment.paymentIntentId, dto.razorpayPaymentId, dto.razorpaySignature)) {
      throw new BadRequestException('Payment verification failed.');
    }
    // A signature alone does not prove capture or the amount received.
    const received = await this.razorpayRequest(`payments/${encodeURIComponent(dto.razorpayPaymentId)}`);
    if (received.order_id !== payment.paymentIntentId || received.amount !== toMinorUnits(Number(payment.amount), payment.currency) ||
      received.currency !== payment.currency || received.status !== 'captured') {
      throw new BadRequestException('Payment is not confirmed yet. Please retry verification or contact support.');
    }
    return this.confirmPaymentSuccess(payment.id);
  }

  async handleRazorpayWebhook(rawBody: Buffer | undefined, signature: string) {
    const secret = this.config.get<string>('RAZORPAY_WEBHOOK_SECRET');
    if (!secret) throw new ServiceUnavailableException('Payment webhook is not configured.');
    if (!rawBody || !/^[a-f0-9]{64}$/i.test(signature || '')) {
      throw new BadRequestException('Invalid payment webhook.');
    }
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest();
    if (!crypto.timingSafeEqual(expected, Buffer.from(signature, 'hex'))) {
      throw new BadRequestException('Invalid payment webhook signature.');
    }
    let event: any;
    try { event = JSON.parse(rawBody.toString('utf8')); }
    catch { throw new BadRequestException('Invalid payment webhook payload.'); }
    if (!['payment.captured', 'order.paid'].includes(event?.event)) {
      return { status: 'received', processed: false };
    }
    const received = event?.payload?.payment?.entity;
    if (!received?.order_id || received.status !== 'captured') {
      return { status: 'received', processed: false };
    }
    const payment = this.prisma.isDbConnected
      ? await this.prisma.payment.findFirst({ where: { paymentIntentId: received.order_id } })
      : this.prisma.inMemoryPayments.find(item => item.paymentIntentId === received.order_id);
    if (!payment) return { status: 'received', processed: false };
    if (received.amount !== toMinorUnits(Number(payment.amount), payment.currency) || received.currency !== payment.currency) {
      throw new BadRequestException('Payment webhook amount does not match the order.');
    }
    await this.confirmPaymentSuccess(payment.id);
    return { status: 'received', processed: true };
  }

  async confirmPaymentSuccess(paymentId: string, _providerPaymentId?: string) {
    if (this.prisma.isDbConnected) {
      return this.prisma.$transaction(async db => {
        const payment = await db.payment.findUnique({ where: { id: paymentId } });
        if (!payment) throw new NotFoundException('Payment not found.');
        const changed = await db.payment.updateMany({ where: { id: paymentId, status: 'PENDING' }, data: { status: 'SUCCESS' } });
        if (!changed.count && payment.status !== 'SUCCESS') {
          const current = await db.payment.findUnique({ where: { id: paymentId } });
          if (current?.status !== 'SUCCESS') throw new BadRequestException('Payment cannot be completed.');
        }
        if (payment.planId) {
          // Only the first confirmation adds time (verify, webhook and
          // re-check can all report the same payment).
          if (changed.count) {
            const plan = await db.membershipPlan.findUnique({ where: { id: payment.planId } });
            if (!plan) throw new NotFoundException('Membership plan not found.');
            await this.activateMembership(db, payment.userId, plan, payment.id);
            if (payment.couponCode) await db.coupon.updateMany({
              where: { code: payment.couponCode }, data: { timesUsed: { increment: 1 } },
            });
          }
        } else if (payment.courseId) {
          await db.enrollment.upsert({
            where: { userId_courseId: { userId: payment.userId, courseId: payment.courseId } },
            create: { userId: payment.userId, courseId: payment.courseId, progressPercent: 0, completedLessonIds: [] },
            // Bought outright: keep it even after a membership ends.
            update: { membershipPlanId: null } as any,
          });
          // Deleted/renamed/disabled coupons never block a verified paid enrollment.
          if (changed.count && payment.couponCode) await db.coupon.updateMany({
            where: { code: payment.couponCode }, data: { timesUsed: { increment: 1 } },
          });
        } else {
          const productIds = this.templateIds(payment.templateProductIds);
          if (!productIds.length) throw new NotFoundException('Purchased products were not found.');
          const products = await db.uiTemplate.findMany({ where: { id: { in: productIds } } });
          if (products.length !== productIds.length) throw new NotFoundException('Purchased products were not found.');
          const paidPerItem = Number(payment.amount) / productIds.length;
          for (const product of products) {
            await db.uiTemplatePurchase.upsert({
              where: { userId_productId: { userId: payment.userId, productId: product.id } },
              create: { userId: payment.userId, productId: product.id, amount: paidPerItem, currency: payment.currency, paymentId: payment.id },
              update: {},
            });
          }
          // Deleted/renamed/disabled coupons never block a verified paid purchase.
          if (changed.count && payment.couponCode) await db.coupon.updateMany({
            where: { code: payment.couponCode }, data: { timesUsed: { increment: 1 } },
          });
        }
        return { ...payment, status: 'SUCCESS' };
      });
    }
    const payment = await this.findPayment(paymentId);
    if (!payment) throw new NotFoundException('Payment not found.');
    if (!['PENDING', 'SUCCESS'].includes(payment.status)) throw new BadRequestException('Payment cannot be completed.');
    const wasAlreadySuccess = payment.status === 'SUCCESS';
    if (!wasAlreadySuccess && payment.couponCode) await this.couponsService.incrementUsage(payment.couponCode);
    payment.status = 'SUCCESS';
    if (payment.planId) {
      if (!wasAlreadySuccess) {
        const plan = this.prisma.inMemoryMembershipPlans.find((item) => item.id === payment.planId);
        if (!plan) throw new NotFoundException('Membership plan not found.');
        await this.activateMembership(null, payment.userId, plan, payment.id);
      }
      return payment;
    }
    if (payment.courseId && !this.prisma.inMemoryEnrollments.some(e => e.userId === payment.userId && e.courseId === payment.courseId)) {
      this.prisma.inMemoryEnrollments.push({ id: crypto.randomUUID(), userId: payment.userId, courseId: payment.courseId,
        progressPercent: 0, completedLessonIds: [], createdAt: new Date(), updatedAt: new Date() });
    } else if (!payment.courseId) {
      const productIds = this.templateIds(payment.templateProductIds);
      for (const productId of productIds) {
        if (!this.prisma.inMemoryUiTemplatePurchases.some(item => item.userId === payment.userId && item.productId === productId)) {
          this.prisma.inMemoryUiTemplatePurchases.push({ id: crypto.randomUUID(), userId: payment.userId, productId,
            amount: Number(payment.amount) / productIds.length, currency: payment.currency, paymentId: payment.id,
            createdAt: new Date() });
        }
      }
    }
    return payment;
  }

  private async createTemplateCheckoutOrder(
    userId: string,
    requestedIds: string[],
    provider?: CheckoutProvider,
    couponCodeInput?: string,
    requestedCurrency?: string,
  ) {
    if (!this.templatesService) throw new ServiceUnavailableException('Template checkout is not available.');
    const products = await this.templatesService.findCheckoutProducts(requestedIds);
    const ownedIds = new Set(
      this.prisma.isDbConnected
        ? (await this.prisma.uiTemplatePurchase.findMany({
            where: { userId, productId: { in: products.map((item) => item.id) } },
            select: { productId: true },
          })).map((item) => item.productId)
        : this.prisma.inMemoryUiTemplatePurchases
            .filter((item) => item.userId === userId)
            .map((item) => item.productId),
    );
    const payableProducts = products.filter((item) => !ownedIds.has(item.id));
    if (!payableProducts.length) {
      return { provider: 'FREE', completed: true, alreadyPurchased: true, amount: 0, currency: 'INR', title: 'Your UI templates' };
    }
    if (payableProducts.some((item) => !item.filePath && !item.deliveryUrl)) {
      throw new BadRequestException('One selected template is not ready for download yet.');
    }
    const currency = payableProducts[0].currency;
    if (payableProducts.some((item) => item.currency !== currency)) {
      throw new BadRequestException('Products with different currencies cannot share one checkout.');
    }
    const originalAmount = payableProducts.reduce((sum, item) => sum + Number(item.price), 0);
    const productIds = payableProducts.map((item) => item.id);
    const title =
      payableProducts.length === 1
        ? payableProducts[0].title
        : `${payableProducts.length} Technyks UI templates`;

    // A coupon on a template checkout only applies when checking out that single product.
    const couponCode = couponCodeInput?.trim().toUpperCase() || null;
    if (couponCode && payableProducts.length !== 1) {
      throw new BadRequestException('A coupon can only be applied when checking out a single template.');
    }
    const templateProductId = payableProducts.length === 1 ? payableProducts[0].id : undefined;
    const validate = async (client?: any) => couponCode
      ? this.couponsService.validateCoupon(couponCode, originalAmount, { type: 'TEMPLATE', templateProductId }, client)
      : { finalAmount: originalAmount };
    const quote = await validate();
    const amount = Math.round(quote.finalAmount * 100);

    if (amount === 0) {
      const redeem = async (db: any) => {
        await validate(db);
        if (couponCode) {
          const coupon = await db.coupon.findUnique({ where: { code: couponCode } });
          const reserved = await db.coupon.updateMany({
            where: { id: coupon.id, isActive: true,
              ...(coupon.usageLimit == null ? {} : { timesUsed: { lt: coupon.usageLimit } }) },
            data: { timesUsed: { increment: 1 } },
          });
          if (!reserved.count) throw new BadRequestException('This coupon is no longer available.');
        }
        const payment = await db.payment.create({ data: { userId, amount: 0, currency, status: 'SUCCESS', provider: 'RAZORPAY', templateProductIds: productIds, couponCode } });
        for (const product of payableProducts) {
          await db.uiTemplatePurchase.upsert({
            where: { userId_productId: { userId, productId: product.id } },
            create: { userId, productId: product.id, amount: 0, currency, paymentId: payment.id },
            update: {},
          });
        }
      };
      if (this.prisma.isDbConnected) {
        await this.prisma.$transaction(redeem);
      } else {
        if (couponCode) await this.couponsService.incrementUsage(couponCode);
        const paymentId = crypto.randomUUID();
        this.prisma.inMemoryPayments.push({ id: paymentId, userId, amount: 0, currency, status: 'SUCCESS', provider: 'RAZORPAY', templateProductIds: productIds, couponCode, createdAt: new Date(), updatedAt: new Date() });
        for (const productId of productIds) {
          this.prisma.inMemoryUiTemplatePurchases.push({ id: crypto.randomUUID(), userId, productId, amount: 0, currency, paymentId, createdAt: new Date() });
        }
      }
      return { provider: 'FREE', completed: true, amount: 0, currency, title };
    }
    return this.startGatewayOrder({
      userId,
      provider,
      title,
      amountInr: currency === 'INR' ? amount / 100 : null,
      fixedCharge: currency === 'INR'
        ? undefined
        : { currency, amount: amount / 100, minor: toMinorUnits(amount / 100, currency) },
      requestedCurrency,
      couponCode,
      templateProductIds: productIds,
    });
  }

  /** Sells a membership plan: one payment buys one period (a month or a year). */
  private async createMembershipCheckoutOrder(dto: {
    userId: string; planId: string; couponCode?: string; provider?: CheckoutProvider; currency?: string;
  }) {
    const plan: any = await this.findPlan(dto.planId);
    if (!plan || plan.isActive === false) throw new NotFoundException('This membership plan is not available.');
    const originalAmount = plan.isFree ? 0 : Number(plan.price || 0);
    if (!Number.isFinite(originalAmount) || originalAmount < 0) throw new BadRequestException('Invalid membership price.');
    const couponCode = dto.couponCode?.trim().toUpperCase() || null;
    const validate = async (client?: any) => couponCode
      ? this.couponsService.validateCoupon(couponCode, originalAmount, { type: 'MEMBERSHIP', planId: plan.id }, client)
      : { finalAmount: originalAmount };
    const quote = await validate();
    const amount = Math.round(quote.finalAmount * 100);
    const title = `${plan.name} membership`;

    if (amount === 0) {
      if (this.prisma.isDbConnected) {
        await this.prisma.$transaction(async (db: any) => {
          await validate(db);
          if (couponCode) {
            const coupon = await db.coupon.findUnique({ where: { code: couponCode } });
            const reserved = await db.coupon.updateMany({
              where: { id: coupon.id, isActive: true,
                ...(coupon.usageLimit == null ? {} : { timesUsed: { lt: coupon.usageLimit } }) },
              data: { timesUsed: { increment: 1 } },
            });
            if (!reserved.count) throw new BadRequestException('This coupon is no longer available.');
          }
          const payment = await db.payment.create({ data: { userId: dto.userId, planId: plan.id, amount: 0,
            currency: plan.currency || 'INR', status: 'SUCCESS', provider: 'RAZORPAY', couponCode } });
          await this.activateMembership(db, dto.userId, plan, payment.id);
        });
      } else {
        if (couponCode) await this.couponsService.incrementUsage(couponCode);
        const paymentId = crypto.randomUUID();
        this.prisma.inMemoryPayments.push({ id: paymentId, userId: dto.userId, planId: plan.id, amount: 0,
          currency: plan.currency || 'INR', status: 'SUCCESS', provider: 'RAZORPAY', couponCode, createdAt: new Date(), updatedAt: new Date() });
        await this.activateMembership(null, dto.userId, plan, paymentId);
      }
      return { provider: 'FREE', completed: true, amount: 0, currency: plan.currency || 'INR', title, planId: plan.id };
    }

    return this.startGatewayOrder({
      userId: dto.userId,
      provider: dto.provider,
      title,
      amountInr: amount / 100,
      requestedCurrency: dto.currency,
      couponCode,
      planId: plan.id,
      returnQuery: `planSlug=${encodeURIComponent(plan.slug)}`,
    });
  }

  /**
   * Starts a membership, or adds one more period to an active one (renewing
   * early never loses the days already paid for).
   */
  private async activateMembership(db: any, userId: string, plan: any, paymentId: string) {
    const now = new Date();
    if (db) {
      const current = await db.subscription.findFirst({
        where: { userId, planId: plan.id, status: 'ACTIVE', currentPeriodEnd: { gt: now } },
        orderBy: { currentPeriodEnd: 'desc' },
      });
      const subscription = current
        ? await db.subscription.update({
            where: { id: current.id },
            data: { currentPeriodEnd: membershipPeriodEnd(plan.interval, current.currentPeriodEnd) },
          })
        : await db.subscription.create({
            data: { userId, planId: plan.id, status: 'ACTIVE', currentPeriodStart: now,
              currentPeriodEnd: membershipPeriodEnd(plan.interval, now) },
          });
      await db.payment.update({ where: { id: paymentId }, data: { subscriptionId: subscription.id } });
      return subscription;
    }
    const current = this.prisma.inMemorySubscriptions.find((item) =>
      item.userId === userId && item.planId === plan.id && item.status === 'ACTIVE' && new Date(item.currentPeriodEnd) > now);
    if (current) {
      current.currentPeriodEnd = membershipPeriodEnd(plan.interval, new Date(current.currentPeriodEnd));
      return current;
    }
    const subscription = { id: crypto.randomUUID(), userId, planId: plan.id, status: 'ACTIVE', currentPeriodStart: now,
      currentPeriodEnd: membershipPeriodEnd(plan.interval, now), cancelAtPeriodEnd: false, createdAt: now, updatedAt: now };
    this.prisma.inMemorySubscriptions.push(subscription);
    return subscription;
  }

  /** The signed-in user's active memberships (account and thank-you pages). */
  async getMyMemberships(userId: string) {
    const plans = this.membership ? await this.membership.activePlans(userId) : [];
    return plans.map((plan) => ({ planId: plan.planId, name: plan.name, currentPeriodEnd: plan.currentPeriodEnd,
      accessAllCourses: plan.accessAllCourses }));
  }

  private async findPlan(idOrSlug: string) {
    if (this.prisma.isDbConnected) {
      return this.prisma.membershipPlan.findFirst({ where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] } });
    }
    return this.prisma.inMemoryMembershipPlans.find((plan) => plan.id === idOrSlug || plan.slug === idOrSlug) || null;
  }

  private templateIds(value: unknown): string[] {
    if (Array.isArray(value)) return value.map(String).filter(Boolean);
    if (typeof value !== 'string') return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
    } catch {
      return [];
    }
  }

  private async findPayment(id: string) {
    if (this.prisma.isDbConnected) return this.prisma.payment.findUnique({ where: { id } });
    return this.prisma.inMemoryPayments.find(p => p.id === id);
  }

  private async findCourse(id: string) {
    if (this.prisma.isDbConnected) return this.prisma.course.findFirst({ where: { id, isArchived: false } });
    return this.prisma.inMemoryCourses.find(c => c.id === id && !c.isArchived);
  }

  private readonly logger = new Logger(PaymentsService.name);

  /**
   * Admin diagnostic: asks Stripe about this account and tries the same kind
   * of checkout the site creates (US$1.00, cancelled straight away), so the
   * real reason for "could not process the request" is visible.
   */
  async checkStripeSetup() {
    const key = String(this.config.get<string>('STRIPE_SECRET_KEY') || '');
    const problems: string[] = [];
    if (!key) {
      return { configured: false, problems: ['STRIPE_SECRET_KEY is not set on this server (hPanel → Environment variables).'] };
    }
    const mode = key.startsWith('sk_live_') ? 'live' : key.startsWith('sk_test_') ? 'test'
      : key.startsWith('rk_') ? 'restricted key' : key.startsWith('pk_') ? 'publishable key (wrong key)' : 'unknown';
    if (mode.startsWith('publishable')) problems.push('STRIPE_SECRET_KEY holds the publishable key (pk_…). Use the secret key (sk_live_…).');
    if (mode === 'test') problems.push('STRIPE_SECRET_KEY is a test key (sk_test_…): real cards are refused. Use the live secret key.');
    if (!this.config.get<string>('STRIPE_WEBHOOK_SECRET')) {
      problems.push('STRIPE_WEBHOOK_SECRET is not set: payments still work, but a buyer who closes the tab is only enrolled when they come back.');
    }

    let account: any = null;
    try {
      const acct = await this.stripeRequest('account');
      account = {
        country: acct.country,
        defaultCurrency: acct.default_currency,
        chargesEnabled: acct.charges_enabled,
        payoutsEnabled: acct.payouts_enabled,
        detailsSubmitted: acct.details_submitted,
        cardPayments: acct.capabilities?.card_payments || 'unknown',
        disabledReason: acct.requirements?.disabled_reason || null,
        stillNeeded: acct.requirements?.currently_due || [],
      };
      if (!acct.charges_enabled) problems.push('Stripe has not enabled payments on this account yet (charges_enabled = false). Finish activation in the Stripe Dashboard.');
      if (acct.capabilities?.card_payments && acct.capabilities.card_payments !== 'active') {
        problems.push(`Card payments are "${acct.capabilities.card_payments}" on Stripe, not active.`);
      }
      if (account.disabledReason) problems.push(`Stripe paused the account: ${account.disabledReason}.`);
      if (account.stillNeeded.length) problems.push(`Stripe still needs: ${account.stillNeeded.join(', ')}.`);
    } catch (error: any) {
      problems.push(`Stripe did not accept the secret key: ${error?.gatewayDetail || error?.message}`);
    }

    let testCheckout = 'not tried';
    try {
      const session = await this.stripeRequest('checkout/sessions', {
        mode: 'payment',
        billing_address_collection: 'required',
        success_url: `${this.webAppUrl}/checkout`,
        cancel_url: `${this.webAppUrl}/checkout`,
        payment_intent_data: { description: 'Technyks setup check' },
        line_items: { 0: { quantity: 1, price_data: { currency: 'usd', unit_amount: 100, product_data: { name: 'Setup check' } } } },
      });
      testCheckout = 'OK — Stripe accepted a US$1.00 checkout (cancelled immediately, nothing charged)';
      await this.stripeRequest(`checkout/sessions/${encodeURIComponent(session.id)}/expire`, {}).catch(() => undefined);
    } catch (error: any) {
      testCheckout = 'FAILED';
      problems.push(`Stripe refused a US$1.00 checkout: ${error?.gatewayDetail || error?.message}`);
    }
    return { configured: true, mode, account, testCheckout, problems };
  }

  private async stripeRequest(path: string, body?: Record<string, unknown>): Promise<any> {
    const secret = this.config.get<string>('STRIPE_SECRET_KEY');
    if (!secret) throw new ServiceUnavailableException('International payments are not configured yet. Please contact support.');
    const response = await fetch(`https://api.stripe.com/v1/${path}`, {
      method: body ? 'POST' : 'GET',
      headers: {
        Authorization: `Bearer ${secret}`,
        ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
      },
      ...(body ? { body: stripeForm(body).join('&') } : {}),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      const detail = await response.json().catch(() => null);
      const reason = detail?.error?.message || 'no details';
      this.logger.warn(`Stripe ${path} failed (${response.status}): ${reason}`);
      const error = new ServiceUnavailableException('Payment provider could not process the request. Please retry.');
      // Shown to admins only (see PaymentsController), to diagnose setup.
      (error as any).gatewayDetail = `Stripe (${response.status}): ${reason}`;
      throw error;
    }
    return response.json();
  }

  private async razorpayRequest(path: string, body?: unknown): Promise<any> {
    const key = this.config.get<string>('RAZORPAY_KEY_ID');
    const secret = this.config.get<string>('RAZORPAY_KEY_SECRET');
    if (!key || !secret) throw new ServiceUnavailableException('Payments are not configured yet. Please contact support.');
    const response = await fetch(`https://api.razorpay.com/v1/${path}`, {
      method: body ? 'POST' : 'GET',
      headers: { Authorization: `Basic ${Buffer.from(`${key}:${secret}`).toString('base64')}`, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      const detail = await response.json().catch(() => null);
      const reason = detail?.error?.description || detail?.error?.reason || 'no details';
      this.logger.warn(`Razorpay ${path} failed (${response.status}): ${reason}`);
      const error = new ServiceUnavailableException('Payment provider could not process the request. Please retry.');
      (error as any).gatewayDetail = `Razorpay (${response.status}): ${reason}`;
      throw error;
    }
    return response.json();
  }
}

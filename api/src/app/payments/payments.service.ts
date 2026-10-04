import { ServiceUnavailableException } from '@nestjs/common';
import { Injectable, BadRequestException, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CouponsService } from '../coupons/coupons.service';
import { TemplatesService } from '../templates/templates.service';
import { coursePayablePrice } from '../courses/course-price';
import { FxService } from '../fx/fx.module';
import { chargeCurrencyFor, convertFromInr, toMinorUnits } from '../fx/currency';
import { stripeForm, verifyStripeSignature } from './stripe';

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
      memberships: false,
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
    if (!dto.courseId || dto.planId) throw new BadRequestException('Membership checkout is not yet configured. Please contact support.');
    const course = await this.findCourse(dto.courseId);
    if (!course || course.isPublished === false) throw new NotFoundException('Course not found.');
    const owned = this.prisma.isDbConnected
      ? await this.prisma.enrollment.findUnique({ where: { userId_courseId: { userId: dto.userId, courseId: course.id } } })
      : this.prisma.inMemoryEnrollments.find(e => e.userId === dto.userId && e.courseId === course.id);
    if (owned) return { provider: 'FREE', completed: true, alreadyEnrolled: true, amount: 0, currency: course.currency, title: course.title };

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
        const enrollment = await db.enrollment.create({ data: {
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
  }) {
    if (p.provider === 'LEMON_SQUEEZY') throw new BadRequestException('This payment method is not available. Please choose another.');
    const charge = p.fixedCharge ?? (await this.quoteInCurrency(Number(p.amountInr), p.requestedCurrency));
    const paymentId = crypto.randomUUID();
    const base = {
      id: paymentId, userId: p.userId, amount: charge.amount, currency: charge.currency, amountInr: p.amountInr,
      status: 'PENDING', couponCode: p.couponCode,
      ...(p.courseId ? { courseId: p.courseId } : {}),
      ...(p.templateProductIds ? { templateProductIds: p.templateProductIds } : {}),
    };

    if (p.provider === 'STRIPE') {
      const returnTo = p.courseId ? `courseId=${encodeURIComponent(p.courseId)}` : 'templateCart=1';
      const session = await this.stripeRequest('checkout/sessions', {
        mode: 'payment',
        client_reference_id: paymentId,
        success_url: `${this.webAppUrl}/checkout?payment_return=${paymentId}`,
        cancel_url: `${this.webAppUrl}/checkout?${returnTo}&payment_cancelled=${paymentId}`,
        metadata: { payment_id: paymentId },
        payment_intent_data: { metadata: { payment_id: paymentId } },
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
        if (payment.courseId) {
          await db.enrollment.upsert({
            where: { userId_courseId: { userId: payment.userId, courseId: payment.courseId } },
            create: { userId: payment.userId, courseId: payment.courseId, progressPercent: 0, completedLessonIds: [] },
            update: {},
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
      this.logger.warn(`Stripe ${path} failed (${response.status}): ${detail?.error?.message || 'no details'}`);
      throw new ServiceUnavailableException('Payment provider could not process the request. Please retry.');
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
    if (!response.ok) throw new ServiceUnavailableException('Payment provider could not process the request. Please retry.');
    return response.json();
  }
}

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PaymentsService } from './payments.service';
import * as crypto from 'crypto';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let mockPrisma: any;
  let mockCoupons: any;

  beforeEach(() => {
    mockPrisma = {
      isDbConnected: true,
      course: { findUnique: vi.fn() },
      membershipPlan: { findUnique: vi.fn(), count: vi.fn().mockResolvedValue(0), createMany: vi.fn() },
      payment: { create: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn() },
      enrollment: { upsert: vi.fn() },
      coupon: { updateMany: vi.fn() },
      uiTemplate: { findMany: vi.fn() },
      uiTemplatePurchase: { findMany: vi.fn(), upsert: vi.fn() },
    };
    mockPrisma.$transaction = vi.fn(async (callback) => callback(mockPrisma));
    mockCoupons = { validateCoupon: vi.fn() };
    service = new PaymentsService(mockPrisma, mockCoupons, {
      get: (key: string) => key === 'RAZORPAY_WEBHOOK_SECRET' ? 'webhook-secret' : undefined,
    } as any);
  });

  it('should verify valid Razorpay HMAC signatures', () => {
    const orderId = 'order_98765';
    const paymentId = 'pay_12345';
    const secret = 'technyks_rzp_secret_key';

    const validSignature = crypto
      .createHmac('sha256', secret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    const isValid = service.verifyRazorpaySignature(orderId, paymentId, validSignature, secret);
    expect(isValid).toBe(true);
  });

  it('should reject invalid Razorpay signatures', () => {
    const isValid = service.verifyRazorpaySignature('order_98765', 'pay_12345', 'forged_signature', 'secret');
    expect(isValid).toBe(false);
  });

  it('should enroll user in course automatically on payment success', async () => {
    mockPrisma.payment.findUnique.mockResolvedValue({
      id: 'pay_rec_1',
      userId: 'user_1',
      courseId: 'course_1',
      status: 'PENDING',
    });
    mockPrisma.payment.updateMany.mockResolvedValue({ count: 1 });

    await service.confirmPaymentSuccess('pay_rec_1');

    expect(mockPrisma.enrollment.upsert).toHaveBeenCalledWith({
      where: { userId_courseId: { userId: 'user_1', courseId: 'course_1' } },
      create: { userId: 'user_1', courseId: 'course_1', progressPercent: 0, completedLessonIds: [] },
      update: {},
    });
  });

  it('keeps ownership independent from later course price and coupon changes', async () => {
    mockPrisma.payment.findUnique.mockResolvedValue({
      id: 'pay_rec_2', userId: 'user_1', courseId: 'course_1',
      couponCode: 'FREE-LAUNCH', status: 'PENDING',
    });
    mockPrisma.payment.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.coupon.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.confirmPaymentSuccess('pay_rec_2')).resolves.toMatchObject({ status: 'SUCCESS' });

    expect(mockPrisma.course.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.enrollment.upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: {},
      where: { userId_courseId: { userId: 'user_1', courseId: 'course_1' } },
    }));
  });

  it('processes an authentic captured-payment webhook idempotently', async () => {
    vi.stubEnv('RAZORPAY_WEBHOOK_SECRET', 'webhook-secret');
    const payment = { id: 'pay_rec_3', userId: 'user_1', courseId: 'course_1', amount: 999, currency: 'INR', status: 'PENDING' };
    mockPrisma.payment.findFirst.mockResolvedValue(payment);
    mockPrisma.payment.findUnique.mockResolvedValue(payment);
    mockPrisma.payment.updateMany.mockResolvedValue({ count: 1 });
    const rawBody = Buffer.from(JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: {
      order_id: 'order_123', status: 'captured', amount: 99900, currency: 'INR',
    } } } }));
    const signature = crypto.createHmac('sha256', 'webhook-secret').update(rawBody).digest('hex');

    await expect(service.handleRazorpayWebhook(rawBody, signature)).resolves.toEqual({ status: 'received', processed: true });
    expect(mockPrisma.enrollment.upsert).toHaveBeenCalledOnce();
  });

  it('permanently records each free UI template checkout', async () => {
    const templates = {
      findCheckoutProducts: vi.fn().mockResolvedValue([
        { id: 'template-1', title: 'Dashboard Kit', price: 0, currency: 'INR', filePath: 'private/template.zip' },
      ]),
    };
    mockPrisma.uiTemplatePurchase.findMany.mockResolvedValue([]);
    mockPrisma.payment.create.mockResolvedValue({ id: 'payment-template-1' });
    const templateService = new PaymentsService(mockPrisma, mockCoupons, { get: () => undefined } as any, templates as any);

    await expect(templateService.createCheckoutOrder({
      userId: 'student-1', templateProductIds: ['template-1'],
    })).resolves.toMatchObject({ provider: 'FREE', completed: true, amount: 0 });

    expect(mockPrisma.uiTemplatePurchase.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId_productId: { userId: 'student-1', productId: 'template-1' } },
    }));
  });
});

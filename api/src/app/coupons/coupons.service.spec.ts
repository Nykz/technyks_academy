import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CouponsService } from './coupons.service';

describe('CouponsService', () => {
  let service: CouponsService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      coupon: {
        findUnique: vi.fn(),
        update: vi.fn(),
        count: vi.fn().mockResolvedValue(0),
        createMany: vi.fn(),
      },
      inMemoryCoupons: [],
    };
    service = new CouponsService(mockPrisma);
  });

  it('should apply percentage discount correctly', async () => {
    mockPrisma.coupon.findUnique.mockResolvedValue({
      code: 'TECHNYKS50',
      discountPercent: 50,
      courseId: 'course_1',
      isActive: true,
      timesUsed: 0,
      usageLimit: 100,
    });

    const result = await service.validateCoupon('TECHNYKS50', 4000, {
      type: 'COURSE',
      courseId: 'course_1',
    });
    expect(result.calculatedDiscount).toBe(2000);
    expect(result.finalAmount).toBe(2000);
  });

  it('should apply flat amount discount correctly', async () => {
    mockPrisma.coupon.findUnique.mockResolvedValue({
      code: 'FLAT1000',
      discountAmount: 1000,
      courseId: 'course_1',
      isActive: true,
      timesUsed: 0,
      usageLimit: 100,
    });

    const result = await service.validateCoupon('FLAT1000', 4000, {
      type: 'COURSE',
      courseId: 'course_1',
    });
    expect(result.calculatedDiscount).toBe(1000);
    expect(result.finalAmount).toBe(3000);
  });

  it('should throw error for expired or overused coupons', async () => {
    mockPrisma.coupon.findUnique.mockResolvedValue({
      code: 'EXPIRED',
      discountPercent: 20,
      courseId: 'course_1',
      isActive: true,
      timesUsed: 50,
      usageLimit: 50,
    });

    await expect(service.validateCoupon('EXPIRED', 4000, {
      type: 'COURSE',
      courseId: 'course_1',
    })).rejects.toThrow(
      'This coupon usage limit has been reached.'
    );
  });

  it('does not allow a membership coupon to be used on a course', async () => {
    mockPrisma.coupon.findUnique.mockResolvedValue({
      code: 'MEMBER100',
      discountAmount: 100,
      scope: 'MEMBERSHIP',
      isActive: true,
      timesUsed: 0,
      usageLimit: 10,
    });

    await expect(service.validateCoupon('MEMBER100', 1499, {
      type: 'COURSE',
      courseId: 'course_1',
    })).rejects.toThrow('This coupon is locked to the membership program or another course.');
  });

  it('applies a template coupon to its matching product', async () => {
    mockPrisma.coupon.findUnique.mockResolvedValue({
      code: 'TEMPLATE30',
      discountPercent: 30,
      scope: 'TEMPLATE',
      templateProductId: 'template_1',
      isActive: true,
      timesUsed: 0,
      usageLimit: 100,
    });

    const result = await service.validateCoupon('TEMPLATE30', 1000, {
      type: 'TEMPLATE',
      templateProductId: 'template_1',
    });
    expect(result.calculatedDiscount).toBe(300);
    expect(result.finalAmount).toBe(700);
  });

  it('does not allow a template coupon to be used on a different template product', async () => {
    mockPrisma.coupon.findUnique.mockResolvedValue({
      code: 'TEMPLATE30',
      discountPercent: 30,
      scope: 'TEMPLATE',
      templateProductId: 'template_1',
      isActive: true,
      timesUsed: 0,
      usageLimit: 100,
    });

    await expect(service.validateCoupon('TEMPLATE30', 1000, {
      type: 'TEMPLATE',
      templateProductId: 'template_2',
    })).rejects.toThrow('This coupon is locked to a different product.');
  });
});

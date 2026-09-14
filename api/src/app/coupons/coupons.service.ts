import { ServiceUnavailableException } from '@nestjs/common';
import { Injectable, BadRequestException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CouponsService implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    await this.seedInitialCoupons();
  }

  async seedInitialCoupons() {
    // Coupons are intentionally created from the admin panel with an explicit
    // course or membership scope. Never seed a global coupon: a global code
    // could accidentally discount a different course or a membership plan.
    const initialCoupons: any[] = [];

    if (this.prisma.isDbConnected !== false) {
      try {
        const count = await this.prisma.coupon.count();
        if (count === 0 && initialCoupons.length > 0) {
          await this.prisma.coupon.createMany({ data: initialCoupons as any });
        }
        return;
      } catch {
        throw new ServiceUnavailableException('Your data could not be loaded or saved. Please retry shortly.');
      }
    }

    if (this.prisma.inMemoryCoupons.length === 0) {
      this.prisma.inMemoryCoupons = initialCoupons.map((coupon, index) => ({
        id: `coupon_${index + 1}`,
        ...coupon,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));
    }
  }

  async validateCoupon(
    code: string,
    originalAmount: number,
    context: {
      type: 'COURSE' | 'MEMBERSHIP' | 'TEMPLATE';
      courseId?: string;
      planId?: string;
      templateProductId?: string;
    } = {
      type: 'COURSE',
    },
    client?: any,
  ) {
    if (!code) {
      throw new BadRequestException('Coupon code is required.');
    }

    let coupon: any = null;
    if (this.prisma.isDbConnected !== false) {
      try {
        coupon = await (client || this.prisma).coupon.findUnique({ where: { code: code.trim().toUpperCase() } });
      } catch {
        throw new ServiceUnavailableException('Your data could not be loaded or saved. Please retry shortly.');
      }
    }
    if (!coupon) {
      coupon = (this.prisma.inMemoryCoupons || []).find(item => item.code === code.trim().toUpperCase());
    }

    if (!coupon || !coupon.isActive) {
      throw new BadRequestException('Invalid or expired coupon code.');
    }

    const scope = String(coupon.scope || 'COURSE').toUpperCase();
    let isAllowedScope = scope === context.type;
    if (isAllowedScope) {
      if (scope === 'COURSE') {
        isAllowedScope = Boolean(context.courseId) && coupon.courseId === context.courseId;
      } else if (scope === 'TEMPLATE') {
        isAllowedScope =
          Boolean(context.templateProductId) &&
          coupon.templateProductId === context.templateProductId;
      } else if (scope !== 'MEMBERSHIP') {
        isAllowedScope = false;
      }
    }
    if (!isAllowedScope) {
      throw new BadRequestException(
        context.type === 'MEMBERSHIP'
          ? 'This coupon is locked to a course or template.'
          : context.type === 'TEMPLATE'
            ? 'This coupon is locked to a different product.'
            : 'This coupon is locked to the membership program or another course.',
      );
    }

    if (coupon.expiryDate && Date.now() > new Date(coupon.expiryDate).getTime()) {
      throw new BadRequestException('This coupon code has expired.');
    }

    if (coupon.usageLimit != null && coupon.timesUsed >= coupon.usageLimit) {
      throw new BadRequestException('This coupon usage limit has been reached.');
    }

    let discount = 0;
    if (coupon.discountPercent) {
      discount = (originalAmount * coupon.discountPercent) / 100;
    } else if (coupon.discountAmount) {
      discount = coupon.discountAmount;
    }

    // Ensure discount doesn't exceed original amount
    discount = Math.min(discount, originalAmount);
    const finalAmount = Math.max(0, originalAmount - discount);

    return {
      valid: true,
      code: coupon.code,
      discountPercent: coupon.discountPercent,
      discountAmount: coupon.discountAmount,
      calculatedDiscount: Math.round(discount * 100) / 100,
      finalAmount: Math.round(finalAmount * 100) / 100,
    };
  }

  async incrementUsage(code: string) {
    if (this.prisma.isDbConnected !== false) {
      try {
        await this.prisma.coupon.update({
          where: { code: code.toUpperCase() },
          data: { timesUsed: { increment: 1 } },
        });
        return;
      } catch {
        throw new ServiceUnavailableException('Your data could not be loaded or saved. Please retry shortly.');
      }
    }

    const coupon = (this.prisma.inMemoryCoupons || []).find(item => item.code === code.toUpperCase());
    if (coupon) coupon.timesUsed += 1;
  }
}

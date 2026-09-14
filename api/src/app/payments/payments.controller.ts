import { Controller, Post, Body, Get, Headers, UseGuards, Request } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CouponsService } from '../coupons/coupons.service';
import { JwtAuthGuard } from '../auth/guards';

@Controller('payments')
export class PaymentsController {
  constructor(
    private paymentsService: PaymentsService,
    private couponsService: CouponsService
  ) {}

  @Get('plans')
  async getPlans() {
    return this.paymentsService.getMembershipPlans();
  }

  @Get('availability')
  getAvailability() { return this.paymentsService.getCheckoutAvailability(); }

  @Post('coupon/validate')
  async validateCoupon(@Body() dto: {
    code: string;
    originalAmount: number;
    type?: 'COURSE' | 'MEMBERSHIP' | 'TEMPLATE';
    courseId?: string;
    planId?: string;
    templateProductId?: string;
  }) {
    return this.couponsService.validateCoupon(dto.code, dto.originalAmount, {
      type:
        dto.type ||
        (dto.templateProductId ? 'TEMPLATE' : dto.courseId ? 'COURSE' : 'MEMBERSHIP'),
      courseId: dto.courseId,
      planId: dto.planId,
      templateProductId: dto.templateProductId,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post('create-order')
  async createOrder(
    @Request() req: any,
    @Body() dto: { courseId?: string; planId?: string; templateProductIds?: string[]; couponCode?: string; provider?: 'RAZORPAY' | 'LEMON_SQUEEZY' },
  ) {
    return this.paymentsService.createCheckoutOrder({
      ...dto,
      userId: req.user.id,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post('verify-razorpay')
  async verifyRazorpay(
    @Request() req: any,
    @Body() dto: { paymentId: string; razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string }
  ) {
    return this.paymentsService.verifyPayment(req.user.id, dto);
  }

  @Post('webhook')
  async handleWebhook(
    @Request() req: any,
    @Headers('x-razorpay-signature') signature: string,
  ) {
    return this.paymentsService.handleRazorpayWebhook(req.rawBody, signature);
  }
}

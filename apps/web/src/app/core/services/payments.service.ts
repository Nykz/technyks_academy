import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface CouponValidationResult {
  valid: boolean;
  code: string;
  discountPercent?: number;
  discountAmount?: number;
  calculatedDiscount: number;
  finalAmount: number;
}

export interface MembershipPlan {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  price: number;
  currency: string;
  interval: 'MONTHLY' | 'ANNUAL';
  isFree: boolean;
  isActive: boolean;
  accessAllCourses: boolean;
  features: string[];
  courseAccess?: { courseId: string }[];
}

export interface OrderResponse {
  provider: 'RAZORPAY' | 'LEMON_SQUEEZY' | 'STRIPE' | 'FREE';
  completed?: boolean;
  paymentId: string;
  razorpayOrderId?: string;
  razorpaySubscriptionId?: string;
  razorpayKeyId?: string;
  checkoutUrl?: string;
  amount: number;
  currency: string;
  title: string;
  isSubscription?: boolean;
  rbiComplianceNote?: string;
}

@Injectable({
  providedIn: 'root',
})
export class PaymentsService {
  private http = inject(HttpClient);

  getPlans(): Observable<MembershipPlan[]> {
    return this.http.get<MembershipPlan[]>('/api/payments/plans');
  }

  validateCoupon(code: string, originalAmount: number, context: { type: 'COURSE' | 'MEMBERSHIP' | 'TEMPLATE'; courseId?: string; planId?: string; templateProductId?: string }): Observable<CouponValidationResult> {
    return this.http.post<CouponValidationResult>('/api/payments/coupon/validate', { code, originalAmount, ...context });
  }

  createOrder(payload: { courseId?: string; planId?: string; templateProductIds?: string[]; couponCode?: string; provider?: string; currency?: string }): Observable<OrderResponse> {
    return this.http.post<OrderResponse>('/api/payments/create-order', payload);
  }

  verifyRazorpay(payload: { paymentId: string; razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string }): Observable<any> {
    return this.http.post<any>('/api/payments/verify-razorpay', payload);
  }

  /** Which gateways the server has keys for. */
  availability(): Observable<{ razorpay: boolean; stripe: boolean }> {
    return this.http.get<{ razorpay: boolean; stripe: boolean }>('/api/payments/availability');
  }

  /** After Stripe sends the buyer back: the server confirms with Stripe and enrolls. */
  verifyStripe(paymentId: string): Observable<any> {
    return this.http.post<any>('/api/payments/verify-stripe', { paymentId });
  }

  /** Re-checks a started payment with its gateway (reload / closed tab). */
  reconcile(paymentId: string): Observable<{ status: 'SUCCESS' | 'PENDING' | 'UNPAID' | 'EXPIRED' | 'FAILED' | string; payment?: any }> {
    return this.http.post<any>('/api/payments/reconcile', { paymentId });
  }
}

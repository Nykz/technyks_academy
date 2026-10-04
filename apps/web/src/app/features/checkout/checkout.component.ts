import { Component, computed, signal, inject, OnInit, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import {
  PaymentsService,
  CouponValidationResult,
} from '../../core/services/payments.service';
import { AuthService } from '../../core/services/auth.service';
import { EnrollmentsService } from '../../core/services/enrollments.service';
import { CoursesService, payablePrice } from '../../core/services/courses.service';
import { TemplateCartService } from '../../core/services/template-cart.service';
import { TemplatesService } from '../../core/services/templates.service';

import { LocalPriceService } from '../../core/services/local-price.service';
import { VerifiedPayment, trackGoogleAdsPurchase } from '../../core/utils/google-ads';
import { ThankYouContext, thankYouNavigation } from '../../core/guards/thank-you.guard';
import {
  clearPendingPayment,
  loadPendingPayment,
  savePendingPayment,
} from '../../core/utils/pending-payment';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="px-6 md:px-16 pt-24 pb-20 max-w-5xl mx-auto">
      <div class="mb-8">
        <span class="font-['JetBrains_Mono'] text-xs uppercase text-[#3B82F6] tracking-widest font-semibold">SECURE CHECKOUT</span>
        <h1 class="font-['Hanken_Grotesk'] text-3xl font-bold text-slate-950 dark:text-white mt-1">{{ templateMode() ? 'Complete Your Purchase' : 'Complete Your Enrollment' }}</h1>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <!-- Main Form Column -->
        <div class="lg:col-span-2 flex flex-col gap-6">
          <!-- Item Summary Card -->
          <div class="bg-[#121A2B] technical-border rounded p-6">
            <h2 class="font-['Hanken_Grotesk'] text-lg font-bold text-slate-950 dark:text-white mb-2">Order Summary</h2>
            @if (templateMode()) {
              @for (item of cart.items(); track item.id) {
                <div class="flex justify-between items-center py-3 border-b border-[#1E293B]">
                  <div><div class="font-['Hanken_Grotesk'] font-bold text-slate-950 dark:text-white text-base">{{ item.title }}</div><div class="font-['JetBrains_Mono'] text-xs text-slate-600 dark:text-[#d9c3af]">Source ZIP · Permanent dashboard download</div></div>
                  <div class="font-['JetBrains_Mono'] text-lg font-bold text-slate-950 dark:text-white">{{ prices.formatCharge(item.price) }}</div>
                </div>
              }
            } @else {
            <div class="flex justify-between items-center py-3 border-b border-[#1E293B]">
              <div>
                <div class="font-['Hanken_Grotesk'] font-bold text-white text-base">{{ itemTitle() }}</div>
                <div class="font-['JetBrains_Mono'] text-xs text-[#d9c3af]">Lifetime Access & Source Code</div>
              </div>
              <div class="font-['JetBrains_Mono'] text-lg font-bold text-white">
                {{ prices.formatCharge(originalAmount()) }}
              </div>
            </div>
            }
          </div>

          <!-- Coupon Code Input -->
          @if (canUseCoupon()) {
          <div class="bg-[#121A2B] technical-border rounded p-6">
            <h3 class="font-['JetBrains_Mono'] text-xs uppercase text-[#3B82F6] font-bold mb-4">COUPON CODE</h3>
            <div class="flex gap-3">
              <input
                type="text"
                [(ngModel)]="couponCode"
                (ngModelChange)="clearCoupon()"
                placeholder="Enter code (e.g. TECHNYKS50)"
                class="min-w-0 flex-grow rounded border border-slate-300 bg-white px-4 py-2.5 font-['JetBrains_Mono'] text-xs uppercase text-slate-900 caret-slate-900 placeholder:text-slate-400 focus:border-[#2563EB] focus:outline-none dark:border-[#1E293B] dark:bg-[#040810] dark:text-white dark:caret-white dark:placeholder:text-slate-500 dark:focus:border-[#3B82F6]"
              />
              <button
                (click)="applyCoupon()"
                [disabled]="isApplyingCoupon()"
                class="shrink-0 font-['JetBrains_Mono'] text-xs font-bold uppercase text-[#040810] bg-[#3B82F6] px-4 sm:px-5 py-2.5 rounded hover:bg-[#3B82F6]/90 transition-colors"
              >
                Apply
              </button>
            </div>

            @if (couponSuccess()) {
              <div class="mt-3 text-xs font-['JetBrains_Mono'] text-[#3B82F6] flex items-center gap-1.5">
                <span class="material-symbols-outlined text-sm">check_circle</span>
                Coupon {{ couponResult()?.code }} applied! Discount: {{ discountText() }}
              </div>
            }

            @if (couponError()) {
              <div class="mt-3 text-xs font-['JetBrains_Mono'] text-[#ffb4ab] flex items-center gap-1.5">
                <span class="material-symbols-outlined text-sm">error</span>
                {{ couponError() }}
              </div>
            }
          </div>
          } @else if (templateMode() && cart.items().length > 1) {
          <div class="bg-[#121A2B] technical-border rounded p-6">
            <p class="font-['JetBrains_Mono'] text-[11px] text-[#a18d7b]">Coupons can only be applied when checking out a single UI template. Remove the other items from your cart to use a coupon.</p>
          </div>
          }

          @if (finalAmount() > 0) {
          <!-- Payment Provider Options -->
          <div class="bg-[#121A2B] technical-border rounded p-6">
            <h3 class="font-['JetBrains_Mono'] text-xs uppercase text-[#3B82F6] font-bold mb-4">PAYMENT METHOD</h3>
            
            <!-- Gateway chosen by country: Razorpay in India, Stripe abroad -->
            <div class="mb-6 p-4 technical-border rounded border-[#3B82F6] bg-[#3B82F6]/5 text-left">
              @if (selectedProvider() === 'STRIPE') {
                <div class="flex justify-between items-center mb-2">
                  <span class="font-['Hanken_Grotesk'] text-sm font-bold text-slate-900 dark:text-white">Card payment (Stripe)</span>
                  <span class="font-['JetBrains_Mono'] text-[10px] text-[#3B82F6] font-bold">INTERNATIONAL</span>
                </div>
                <p class="font-['Inter'] text-xs text-[#d9c3af]">Visa, Mastercard, Amex, Apple Pay and Google Pay, in {{ prices.chargeCurrency() }}. You'll pay on Stripe's secure page.</p>
              } @else {
                <div class="flex justify-between items-center mb-2">
                  <span class="font-['Hanken_Grotesk'] text-sm font-bold text-slate-900 dark:text-white">Razorpay</span>
                  <span class="font-['JetBrains_Mono'] text-[10px] text-[#3B82F6] font-bold">UPI / CARDS</span>
                </div>
                <p class="font-['Inter'] text-xs text-[#d9c3af]">UPI, GPay, PhonePe, cards and netbanking</p>
              }
            </div>

            <!-- RBI Compliance Note for Razorpay -->
            <div class="p-3 bg-[#040810] border border-[#1E293B] rounded text-[11px] font-['JetBrains_Mono'] text-[#d9c3af]">
              Payment confirmation securely saves your {{ templateMode() ? 'downloads' : 'course' }} to your account.
            </div>
          </div>
          }
        </div>

        <!-- Order Summary Sidebar -->
        <div class="bg-[#121A2B] technical-border rounded p-6 flex flex-col justify-between h-fit shadow-2xl">
          <div>
            <h3 class="font-['Hanken_Grotesk'] text-lg font-bold text-white mb-4">Payment Breakdown</h3>

            <div class="flex flex-col gap-3 font-['JetBrains_Mono'] text-xs text-[#d9c3af] border-b border-[#1E293B] pb-4 mb-4">
              <div class="flex justify-between">
                <span>Subtotal:</span>
                <span>{{ prices.formatCharge(originalAmount()) }}</span>
              </div>

              @if (couponResult() && couponResult()?.calculatedDiscount! > 0) {
                <div class="flex justify-between text-[#3B82F6]">
                  <span>Discount ({{ couponResult()?.code }}):</span>
                  <span>-{{ discountText() }}</span>
                </div>
              }

              <div class="flex justify-between text-[#a18d7b]">
                <span>Taxes & GST (Included):</span>
                <span>{{ prices.formatCharge(0) }}</span>
              </div>
            </div>

            <div class="flex justify-between items-baseline mb-6 font-['JetBrains_Mono']">
              <span class="text-xs uppercase text-[#a18d7b]">Total Payable:</span>
              <span class="text-2xl font-bold text-[#3B82F6]">{{ prices.formatCharge(finalAmount()) }}</span>
            </div>
            @if (finalAmount() > 0 && prices.chargeCurrency() !== prices.currency()) {
              <p class="-mt-4 mb-6 text-xs text-slate-500 dark:text-[#a18d7b]">
                Shown as about {{ prices.format(finalAmount()) }}. You'll be charged
                {{ prices.formatCharge(finalAmount()) }} ({{ prices.chargeCurrency() }}); your bank converts it.
              </p>
            }
          </div>

          @if (recoveryMessage()) { <p role="status" class="mb-4 rounded p-3 bg-blue-50 text-blue-900 dark:bg-blue-950 dark:text-blue-100 text-sm">{{ recoveryMessage() }}</p> }
          @if (summaryError() || paymentError()) { <p role="alert" class="mb-4 rounded p-3 bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200 text-sm">{{ summaryError() || paymentError() }}</p> }
          @if (isLoadingSummary()) { <p role="status">Loading your order…</p> }
          <button
            (click)="onProceedToPayment()"
            [disabled]="isProcessing() || isLoadingSummary() || !!summaryError()"
            class="w-full font-['JetBrains_Mono'] text-xs uppercase tracking-wider text-[#040810] bg-[#3B82F6] py-4 rounded font-bold hover:bg-[#3B82F6]/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg"
          >
            @if (isProcessing()) {
              <span class="material-symbols-outlined animate-spin text-sm">progress_activity</span> Processing Order...
            } @else {
              <span>{{ finalAmount() === 0 ? (templateMode() ? 'Get downloads' : 'Enroll for free') : 'Pay ' + prices.formatCharge(finalAmount()) }}</span>
              <span class="material-symbols-outlined text-sm">lock</span>
            }
          </button>
        </div>
      </div>
    </div>
  `,
})
export class CheckoutComponent implements OnInit {
  readonly prices = inject(LocalPriceService);
  private zone = inject(NgZone);
  private enrollmentsService = inject(EnrollmentsService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private http = inject(HttpClient);
  private paymentsService = inject(PaymentsService);
  private authService = inject(AuthService);
  private coursesService = inject(CoursesService);
  cart = inject(TemplateCartService);
  private templatesService = inject(TemplatesService);

  courseId = signal<string | null>(null);
  planSlug = signal<string | null>(null);
  templateMode = signal(false);
  itemTitle = signal<string>('Technyks Architecture Course');
  originalAmount = signal<number>(0);
  /** Which gateways the server has keys for (loaded on open). */
  private gateways = signal<{ razorpay: boolean; stripe: boolean } | null>(null);
  /** Razorpay in India; Stripe for other currencies when it's configured. */
  selectedProvider = computed<'RAZORPAY' | 'STRIPE'>(() =>
    this.prices.chargeCurrency() !== 'INR' && this.gateways()?.stripe ? 'STRIPE' : 'RAZORPAY',
  );
  /** Shown while a returning/reloaded payment is being confirmed. */
  recoveryMessage = signal('');
  private razorpayScript?: Promise<void>;

  couponCode = '';
  couponResult = signal<CouponValidationResult | null>(null);
  couponSuccess = signal(false);
  couponError = signal('');
  isApplyingCoupon = signal(false);
  isProcessing = signal(false);

  paymentError = signal('');
  summaryError = signal('');
  isLoadingSummary = signal(true);

  ngOnInit() {
    if (typeof window !== 'undefined') {
      this.paymentsService.availability().subscribe({
        next: (gateways) => this.gateways.set(gateways),
        error: () => this.gateways.set(null),
      });
      // Load Razorpay now so the payment window opens instantly on "Pay".
      this.loadRazorpayScript().catch(() => undefined);
    }
    this.route.queryParams.subscribe((params) => {
      if (params['payment_return']) {
        this.completeStripeReturn(String(params['payment_return']));
        return;
      }
      if (params['payment_cancelled']) {
        clearPendingPayment();
        this.paymentError.set('Payment cancelled. You were not charged.');
      } else {
        this.resumePendingPayment();
      }
      this.clearCoupon();
      this.courseId.set(null);
      this.planSlug.set(null);
      this.templateMode.set(false);
      this.summaryError.set('');
      this.isLoadingSummary.set(true);
      if (params['templateCart']) {
        this.templateMode.set(true);
        this.templatesService.list().subscribe({
          next: (catalog) => {
            this.cart.syncWithCatalog(catalog);
            const items = this.cart.items();
            this.isLoadingSummary.set(false);
            if (!items.length) {
              this.summaryError.set(
                'Your UI template cart is empty or its products are no longer available.',
              );
              return;
            }
            this.itemTitle.set(
              items.length === 1
                ? items[0].title
                : `${items.length} UI templates`,
            );
            this.originalAmount.set(this.cart.subtotal());
          },
          error: () => {
            this.isLoadingSummary.set(false);
            this.summaryError.set(
              'Could not confirm current product prices. Please retry.',
            );
          },
        });
      } else if (params['courseId']) {
        const id = params['courseId'];
        this.courseId.set(id);
        this.coursesService.getPublicCourseById(id).subscribe({
          next: (course) => {
            this.courseId.set(course.id);
            this.itemTitle.set(course.title);
            this.originalAmount.set(payablePrice(course));
            if (!this.authService.isAuthenticated()) {
              this.isLoadingSummary.set(false);
              return;
            }
            this.enrollmentsService.getMyEnrollments().subscribe({
              next: (enrollments) => {
                this.isLoadingSummary.set(false);
                if (enrollments.some((e) => e.courseId === course.id))
                  this.router.navigate(['/courses', course.slug], {
                    replaceUrl: true,
                  });
              },
              error: () => {
                this.isLoadingSummary.set(false);
                this.summaryError.set(
                  'Could not check your course access. Please refresh before paying.',
                );
              },
            });
          },
          error: () => {
            this.isLoadingSummary.set(false);
            this.summaryError.set(
              'Could not load this course. Please return to the course page.',
            );
          },
        });
      } else if (params['planSlug'] || params['plan']) {
        const slug = params['planSlug'] || params['plan'];
        this.planSlug.set(slug === 'annual-vip' ? 'all-access-annual' : slug);
        this.paymentsService.getPlans().subscribe({
          next: (plans) => {
            const plan = plans.find((p) => p.slug === this.planSlug());
            this.isLoadingSummary.set(false);
            if (plan) {
              this.itemTitle.set(plan.name);
              this.originalAmount.set(plan.price);
            }
            this.summaryError.set(
              'Membership checkout is currently unavailable. Please contact support.',
            );
          },
          error: () => {
            this.isLoadingSummary.set(false);
            this.summaryError.set(
              'Could not load this membership. Please try again.',
            );
          },
        });
      } else {
        this.isLoadingSummary.set(false);
        this.summaryError.set('Choose a course before checking out.');
      }
    });
  }

  clearCoupon() {
    this.couponResult.set(null);
    this.couponSuccess.set(false);
    this.couponError.set('');
  }

  /** The coupon saving in the charge currency (subtotal minus total). */
  discountText() {
    const subtotal = this.prices.chargeQuote(this.originalAmount());
    const total = this.prices.chargeQuote(this.finalAmount());
    return new Intl.NumberFormat(subtotal.currency === 'INR' ? 'en-IN' : undefined, {
      style: 'currency',
      currency: subtotal.currency,
    }).format(Math.max(0, subtotal.amount - total.amount));
  }

  finalAmount = () => {
    const res = this.couponResult();
    return res ? res.finalAmount : this.originalAmount();
  };

  canUseCoupon = () => !this.templateMode() || this.cart.items().length === 1;

  applyCoupon() {
    if (
      !this.couponCode.trim() ||
      this.isApplyingCoupon() ||
      this.isLoadingSummary()
    )
      return;
    this.isApplyingCoupon.set(true);
    this.couponError.set('');
    this.couponSuccess.set(false);

    this.paymentsService
      .validateCoupon(
        this.couponCode,
        this.originalAmount(),
        this.templateMode()
          ? { type: 'TEMPLATE', templateProductId: this.cart.items()[0]?.id }
          : this.courseId()
            ? { type: 'COURSE', courseId: this.courseId() || undefined }
            : { type: 'MEMBERSHIP', planId: this.planSlug() || undefined },
      )
      .subscribe({
        next: (res) => {
          this.isApplyingCoupon.set(false);
          this.couponResult.set(res);
          this.couponSuccess.set(true);
        },
        error: (err) => {
          this.isApplyingCoupon.set(false);
          this.couponError.set(err.error?.message || 'Invalid coupon code');
          this.couponResult.set(null);
        },
      });
  }

  onProceedToPayment() {
    if (this.isProcessing() || this.isLoadingSummary() || this.summaryError())
      return;
    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/auth/login'], {
        queryParams: { returnUrl: this.router.url },
      });
      return;
    }
    this.isProcessing.set(true);
    this.paymentError.set('');
    this.paymentsService
      .createOrder({
        courseId: this.courseId() || undefined,
        planId: this.planSlug() || undefined,
        templateProductIds: this.templateMode()
          ? this.cart.items().map((item) => item.id)
          : undefined,
        couponCode: this.couponResult()?.code || undefined,
        provider: this.selectedProvider(),
        currency: this.prices.chargeCurrency(),
      })
      .subscribe({
        next: (order) => {
          if (order.completed) {
            // Nothing to pay: the server has already created the enrollment
            // (100% coupon) or template purchase. Already-owned courses
            // aren't a new enrollment, so those go to the dashboard.
            this.isProcessing.set(false);
            if ((order as any).alreadyEnrolled) {
              this.router.navigate(['/dashboard']);
              return;
            }
            const context = this.thankYouContext();
            if (this.templateMode()) this.cart.clear();
            this.router.navigate(['/thank-you'], thankYouNavigation(context));
            return;
          }
          if (order.provider === 'STRIPE' && order.checkoutUrl) {
            // Remember it, then go to Stripe's secure payment page.
            savePendingPayment({ paymentId: order.paymentId, provider: 'STRIPE', userId: this.userId() });
            window.location.assign(order.checkoutUrl);
            return;
          }
          this.openRazorpay(order).catch(() => {
            this.isProcessing.set(false);
            this.paymentError.set(
              'Could not open secure payment. Please retry.',
            );
          });
        },
        error: (error) => {
          this.isProcessing.set(false);
          this.paymentError.set(
            error?.error?.message ||
              'Order was not completed. Please try again.',
          );
        },
      });
  }

  private userId() {
    return this.authService.currentUser()?.id || '';
  }

  /**
   * A payment the server has confirmed (enrollment created): report it to
   * Google Ads once, then show the thank-you page.
   */
  private finishVerifiedPayment(payment: any, fallback: ThankYouContext) {
    clearPendingPayment();
    this.isProcessing.set(false);
    this.recoveryMessage.set('');
    trackGoogleAdsPurchase(payment);
    const productIds = this.templateIdsFrom(payment?.templateProductIds);
    const context: ThankYouContext = payment?.courseId
      ? { kind: 'course', courseId: payment.courseId }
      : productIds.length
        ? { kind: 'templates', productIds }
        : fallback;
    if (context.kind === 'templates') this.cart.clear();
    this.router.navigate(['/thank-you'], thankYouNavigation(context));
  }

  private templateIdsFrom(value: unknown): string[] {
    if (Array.isArray(value)) return value.map(String);
    try {
      const parsed = typeof value === 'string' ? JSON.parse(value) : [];
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }

  /** Back from Stripe: the server confirms with Stripe (retrying briefly). */
  private completeStripeReturn(paymentId: string, attempt = 0) {
    this.isProcessing.set(true);
    this.isLoadingSummary.set(false);
    this.recoveryMessage.set('Confirming your payment with Stripe…');
    this.paymentsService.verifyStripe(paymentId).subscribe({
      next: (payment) => this.finishVerifiedPayment(payment, { kind: 'course', courseId: '' }),
      error: () => {
        if (attempt < 4) {
          setTimeout(() => this.completeStripeReturn(paymentId, attempt + 1), 2000);
          return;
        }
        this.isProcessing.set(false);
        this.recoveryMessage.set(
          'Your payment is still being confirmed by Stripe. Do not pay again: your purchase unlocks automatically once it is confirmed. Refresh this page in a minute.',
        );
      },
    });
  }

  /** After a reload / closed tab mid-payment, ask the server to re-check it. */
  private resumePendingPayment() {
    const pending = loadPendingPayment(this.userId());
    if (!pending) return;
    this.paymentsService.reconcile(pending.paymentId).subscribe({
      next: (result) => {
        if (result.status === 'SUCCESS' && result.payment) {
          this.finishVerifiedPayment(result.payment, { kind: 'course', courseId: '' });
        } else if (result.status === 'PENDING') {
          this.recoveryMessage.set(
            'Your previous payment is still being confirmed. If money was deducted, do not pay again: your purchase unlocks automatically once it is confirmed.',
          );
        } else {
          clearPendingPayment(); // Never paid, expired or failed.
        }
      },
      error: () => undefined, // Keep it; the gateway webhook can still confirm it.
    });
  }

  /** What was bought, for the /thank-you guard (read before the cart is cleared). */
  private thankYouContext(): ThankYouContext {
    return this.templateMode()
      ? { kind: 'templates', productIds: this.cart.items().map((item) => item.id) }
      : { kind: 'course', courseId: this.courseId() ?? '' };
  }

  /** Loads Razorpay's checkout script once (started when checkout opens). */
  private loadRazorpayScript(): Promise<void> {
    if ((window as any).Razorpay) return Promise.resolve();
    this.razorpayScript ??= new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        script.remove();
        this.razorpayScript = undefined; // Allow a retry on "Pay".
        reject(new Error('Payment script unavailable'));
      };
      document.head.appendChild(script);
    });
    return this.razorpayScript;
  }

  private async openRazorpay(order: any) {
    await this.loadRazorpayScript();
    const fallbackContext = this.thankYouContext();
    const checkout = new (window as any).Razorpay({
      key: order.razorpayKeyId,
      order_id: order.razorpayOrderId,
      amount: order.amount,
      currency: order.currency,
      name: 'Technyks Academy',
      description: order.title,
      prefill: {
        name: this.authService.currentUser()?.name,
        email: this.authService.currentUser()?.email,
      },
      handler: (result: any) =>
        this.zone.run(() => {
          this.paymentsService
            .verifyRazorpay({
              paymentId: order.paymentId,
              razorpayOrderId: result.razorpay_order_id,
              razorpayPaymentId: result.razorpay_payment_id,
              razorpaySignature: result.razorpay_signature,
            })
            .subscribe({
              // The backend has verified the payment, marked it SUCCESS and
              // created the enrollment: report it once (INR), then thank-you.
              next: (payment: VerifiedPayment) => this.finishVerifiedPayment(payment, fallbackContext),
              error: () => {
                this.isProcessing.set(false);
                this.paymentError.set(
                  'Payment confirmation is pending. Do not pay again. Contact support with your payment reference.',
                );
              },
            });
        }),
      modal: {
        ondismiss: () =>
          this.zone.run(() => {
            clearPendingPayment();
            this.isProcessing.set(false);
            this.paymentError.set(
              'Payment window closed. No enrollment was confirmed.',
            );
          }),
      },
      theme: { color: '#2563EB' },
    });
    checkout.on('payment.failed', () =>
      this.zone.run(() => {
        clearPendingPayment();
        this.isProcessing.set(false);
        this.paymentError.set(
          'Payment failed. Please check your payment method and try again.',
        );
      }),
    );
    // Remembered so a reload mid-payment can be re-checked with Razorpay.
    savePendingPayment({ paymentId: order.paymentId, provider: 'RAZORPAY', userId: this.userId() });
    checkout.open();
  }
}

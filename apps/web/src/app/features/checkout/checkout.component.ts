import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { PaymentsService, CouponValidationResult } from '../../core/services/payments.service';
import { AuthService } from '../../core/services/auth.service';
import { CoursesService } from '../../core/services/courses.service';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="px-6 md:px-16 pt-24 pb-20 max-w-5xl mx-auto">
      <div class="mb-8">
        <span class="font-['JetBrains_Mono'] text-xs uppercase text-[#3B82F6] tracking-widest font-semibold">// SECURE CHECKOUT</span>
        <h1 class="font-['Hanken_Grotesk'] text-3xl font-bold text-white mt-1">Complete Your Enrollment</h1>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <!-- Main Form Column -->
        <div class="lg:col-span-2 flex flex-col gap-6">
          <!-- Item Summary Card -->
          <div class="bg-[#121A2B] technical-border rounded p-6">
            <h2 class="font-['Hanken_Grotesk'] text-lg font-bold text-white mb-2">Order Summary</h2>
            <div class="flex justify-between items-center py-3 border-b border-[#1E293B]">
              <div>
                <div class="font-['Hanken_Grotesk'] font-bold text-white text-base">{{ itemTitle() }}</div>
                <div class="font-['JetBrains_Mono'] text-xs text-[#d9c3af]">Lifetime Access & Source Code</div>
              </div>
              <div class="font-['JetBrains_Mono'] text-lg font-bold text-white">
                ₹{{ originalAmount().toLocaleString('en-IN') }}
              </div>
            </div>
          </div>

          <!-- Coupon Code Input -->
          <div class="bg-[#121A2B] technical-border rounded p-6">
            <h3 class="font-['JetBrains_Mono'] text-xs uppercase text-[#3B82F6] font-bold mb-4">// COUPON CODE</h3>
            <div class="flex gap-3">
              <input
                type="text"
                [(ngModel)]="couponCode"
                placeholder="Enter code (e.g. TECHNYKS50)"
                class="flex-grow rounded border border-slate-300 bg-white px-4 py-2.5 font-['JetBrains_Mono'] text-xs uppercase text-slate-900 caret-slate-900 placeholder:text-slate-400 focus:border-[#2563EB] focus:outline-none dark:border-[#1E293B] dark:bg-[#040810] dark:text-white dark:caret-white dark:placeholder:text-slate-500 dark:focus:border-[#3B82F6]"
              />
              <button
                (click)="applyCoupon()"
                [disabled]="isApplyingCoupon()"
                class="font-['JetBrains_Mono'] text-xs font-bold uppercase text-[#040810] bg-[#3B82F6] px-5 py-2.5 rounded hover:bg-[#3B82F6]/90 transition-colors"
              >
                Apply
              </button>
            </div>

            @if (couponSuccess()) {
              <div class="mt-3 text-xs font-['JetBrains_Mono'] text-[#3B82F6] flex items-center gap-1.5">
                <span class="material-symbols-outlined text-sm">check_circle</span>
                Coupon {{ couponResult()?.code }} applied! Discount: ₹{{ couponResult()?.calculatedDiscount }}
              </div>
            }

            @if (couponError()) {
              <div class="mt-3 text-xs font-['JetBrains_Mono'] text-[#ffb4ab] flex items-center gap-1.5">
                <span class="material-symbols-outlined text-sm">error</span>
                {{ couponError() }}
              </div>
            }
          </div>

          <!-- Payment Provider Options -->
          <div class="bg-[#121A2B] technical-border rounded p-6">
            <h3 class="font-['JetBrains_Mono'] text-xs uppercase text-[#3B82F6] font-bold mb-4">// PAYMENT METHOD</h3>
            
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <!-- Razorpay Option (India) -->
              <button
                type="button"
                (click)="selectedProvider.set('RAZORPAY')"
                [class.border-[#3B82F6]]="selectedProvider() === 'RAZORPAY'"
                [class.bg-[#3B82F6]/5]="selectedProvider() === 'RAZORPAY'"
                class="p-4 technical-border rounded cursor-pointer transition-all flex flex-col justify-between text-left"
              >
                <div class="flex justify-between items-center mb-2">
                  <span class="font-['Hanken_Grotesk'] text-sm font-bold text-white">Razorpay (India)</span>
                  <span class="font-['JetBrains_Mono'] text-[10px] text-[#3B82F6] font-bold">UPI / CARDS</span>
                </div>
                <p class="font-['Inter'] text-xs text-[#d9c3af]">UPI, GPay, PhonePe, Cards, Netbanking + RBI Autopay</p>
              </button>

              <!-- Lemon Squeezy Option (Global) -->
              <button
                type="button"
                (click)="selectedProvider.set('LEMON_SQUEEZY')"
                [class.border-[#3B82F6]]="selectedProvider() === 'LEMON_SQUEEZY'"
                [class.bg-[#3B82F6]/5]="selectedProvider() === 'LEMON_SQUEEZY'"
                class="p-4 technical-border rounded cursor-pointer transition-all flex flex-col justify-between text-left"
              >
                <div class="flex justify-between items-center mb-2">
                  <span class="font-['Hanken_Grotesk'] text-sm font-bold text-white">Lemon Squeezy</span>
                  <span class="font-['JetBrains_Mono'] text-[10px] text-[#3B82F6] font-bold">GLOBAL / VAT</span>
                </div>
                <p class="font-['Inter'] text-xs text-[#d9c3af]">International Cards, Apple Pay, Merchant of Record</p>
              </button>
            </div>

            <!-- RBI Compliance Note for Razorpay -->
            @if (selectedProvider() === 'RAZORPAY') {
              <div class="p-3 bg-[#040810] border border-[#1E293B] rounded text-[11px] font-['JetBrains_Mono'] text-[#d9c3af]">
                🛡️ <span class="text-[#3B82F6]">RBI Compliance:</span> Recurring subscriptions include pre-debit notices 24 hours prior to each billing cycle via SMS/Email.
              </div>
            }
          </div>
        </div>

        <!-- Order Summary Sidebar -->
        <div class="bg-[#121A2B] technical-border rounded p-6 flex flex-col justify-between h-fit shadow-2xl">
          <div>
            <h3 class="font-['Hanken_Grotesk'] text-lg font-bold text-white mb-4">Payment Breakdown</h3>

            <div class="flex flex-col gap-3 font-['JetBrains_Mono'] text-xs text-[#d9c3af] border-b border-[#1E293B] pb-4 mb-4">
              <div class="flex justify-between">
                <span>Subtotal:</span>
                <span>₹{{ originalAmount().toLocaleString('en-IN') }}</span>
              </div>

              @if (couponResult() && couponResult()?.calculatedDiscount! > 0) {
                <div class="flex justify-between text-[#3B82F6]">
                  <span>Discount ({{ couponResult()?.code }}):</span>
                  <span>-₹{{ couponResult()?.calculatedDiscount?.toLocaleString('en-IN') }}</span>
                </div>
              }

              <div class="flex justify-between text-[#a18d7b]">
                <span>Taxes & GST (Included):</span>
                <span>₹0</span>
              </div>
            </div>

            <div class="flex justify-between items-baseline mb-6 font-['JetBrains_Mono']">
              <span class="text-xs uppercase text-[#a18d7b]">Total Payable:</span>
              <span class="text-2xl font-bold text-[#3B82F6]">₹{{ finalAmount().toLocaleString('en-IN') }}</span>
            </div>
          </div>

          <button
            (click)="onProceedToPayment()"
            [disabled]="isProcessing()"
            class="w-full font-['JetBrains_Mono'] text-xs uppercase tracking-wider text-[#040810] bg-[#3B82F6] py-4 rounded font-bold hover:bg-[#3B82F6]/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg"
          >
            @if (isProcessing()) {
              <span class="material-symbols-outlined animate-spin text-sm">progress_activity</span> Processing Order...
            } @else {
              <span>Pay ₹{{ finalAmount().toLocaleString('en-IN') }}</span>
              <span class="material-symbols-outlined text-sm">lock</span>
            }
          </button>
        </div>
      </div>
    </div>
  `
})
export class CheckoutComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private http = inject(HttpClient);
  private paymentsService = inject(PaymentsService);
  private authService = inject(AuthService);
  private coursesService = inject(CoursesService);

  courseId = signal<string | null>(null);
  planSlug = signal<string | null>(null);
  itemTitle = signal<string>('Technyks Architecture Course');
  originalAmount = signal<number>(4999);
  selectedProvider = signal<'RAZORPAY' | 'LEMON_SQUEEZY'>('RAZORPAY');

  couponCode = '';
  couponResult = signal<CouponValidationResult | null>(null);
  couponSuccess = signal(false);
  couponError = signal('');
  isApplyingCoupon = signal(false);
  isProcessing = signal(false);

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params['courseId']) {
        this.courseId.set(params['courseId']);
        if (params['slug']) {
          this.coursesService.getCourseBySlug(params['slug']).subscribe({
            next: course => {
              this.itemTitle.set(course.title);
              this.originalAmount.set(course.price);
            },
          });
        }
      } else if (params['planSlug'] || params['plan']) {
        const planSlug = params['planSlug'] || params['plan'];
        this.planSlug.set(planSlug === 'annual-vip' ? 'all-access-annual' : planSlug);
        this.http.get<any[]>('/api/payments/plans').subscribe({
          next: (plans) => {
            const plan = plans.find((candidate) => candidate.slug === this.planSlug());
            if (plan) {
              this.itemTitle.set(plan.name);
              this.originalAmount.set(Number(plan.price) || 0);
            } else {
              this.setFallbackMembershipSummary();
            }
          },
          error: () => this.setFallbackMembershipSummary(),
        });
      }
    });
  }

  private setFallbackMembershipSummary() {
    const storedPlan = this.getStoredMembershipPlan();
    if (storedPlan) {
      this.itemTitle.set(storedPlan.name);
      this.originalAmount.set(Number(storedPlan.price) || 0);
      return;
    }
    if (this.planSlug() === 'pro-monthly') {
      this.itemTitle.set('Pro Monthly Membership');
      this.originalAmount.set(1499);
    } else {
      this.itemTitle.set('All-Access Annual Membership');
      this.originalAmount.set(11999);
    }
  }

  private getStoredMembershipPlan(): { name: string; price: number } | null {
    if (typeof localStorage === 'undefined') return null;
    try {
      const plans = JSON.parse(
        localStorage.getItem('technyks_membership_plans_v1') || '[]',
      );
      const plan = Array.isArray(plans)
        ? plans.find((candidate: any) => candidate.slug === this.planSlug())
        : null;
      return plan ? { name: plan.name, price: Number(plan.price) || 0 } : null;
    } catch {
      return null;
    }
  }

  finalAmount = () => {
    const res = this.couponResult();
    return res ? res.finalAmount : this.originalAmount();
  };

  applyCoupon() {
    if (!this.couponCode) return;
    this.isApplyingCoupon.set(true);
    this.couponError.set('');
    this.couponSuccess.set(false);

    this.paymentsService.validateCoupon(
      this.couponCode,
      this.originalAmount(),
      this.courseId()
        ? { type: 'COURSE', courseId: this.courseId() || undefined }
        : { type: 'MEMBERSHIP', planId: this.planSlug() || undefined },
    ).subscribe({
      next: (res) => {
        this.isApplyingCoupon.set(false);
        this.couponResult.set(res);
        this.couponSuccess.set(true);
      },
      error: (err) => {
        this.isApplyingCoupon.set(false);
        this.couponError.set(err.error?.message || 'Invalid coupon code');
        this.couponResult.set(null);
      }
    });
  }

  onProceedToPayment() {
    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/auth/login']);
      return;
    }

    this.isProcessing.set(true);

    const payload = {
      courseId: this.courseId() || undefined,
      planId: this.planSlug() || undefined,
      couponCode: this.couponResult()?.code || undefined,
      provider: this.selectedProvider(),
    };

    this.paymentsService.createOrder(payload).subscribe({
      next: (order) => {
        this.isProcessing.set(false);
        if (order.provider === 'LEMON_SQUEEZY' && order.checkoutUrl) {
          window.location.href = order.checkoutUrl;
        } else {
          // Razorpay trigger or mock completion
          alert(`Razorpay Payment Order Created! Order ID: ${order.razorpayOrderId || order.razorpaySubscriptionId}\n\n${order.rbiComplianceNote || 'Proceeding with secure Indian payment gateway.'}`);
          // Simulate instant payment verification for testing ease
          this.paymentsService.verifyRazorpay({
            paymentId: order.paymentId,
            razorpayOrderId: order.razorpayOrderId || 'order_mock',
            razorpayPaymentId: 'pay_mock_123',
            razorpaySignature: 'signature_mock',
          }).subscribe(() => {
            this.router.navigate(['/dashboard']);
          });
        }
      },
      error: () => {
        this.isProcessing.set(false);
        alert('Order creation failed. Please try again.');
      }
    });
  }
}

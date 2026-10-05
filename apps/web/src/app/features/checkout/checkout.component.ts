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
import { Course, CoursesService, payablePrice } from '../../core/services/courses.service';
import { MediaUrlPipe } from '../../core/pipes/media-url.pipe';
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
  imports: [CommonModule, FormsModule, RouterModule, MediaUrlPipe],
  template: `
    <div class="mx-auto max-w-6xl px-4 pb-32 pt-8 sm:px-6 sm:pt-10 lg:pb-16">
      <!-- Header -->
      <a
        [routerLink]="backLink()"
        class="inline-flex items-center gap-1 text-sm font-semibold text-slate-600 hover:text-[#2563EB] dark:text-slate-300 dark:hover:text-[#60A5FA]"
      >
        <span class="material-symbols-outlined text-lg" aria-hidden="true">arrow_back</span>
        {{ templateMode() ? 'Back to cart' : 'Back to course' }}
      </a>
      <div class="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <h1 class="font-['Hanken_Grotesk'] text-3xl font-bold text-slate-950 dark:text-white sm:text-4xl">Checkout</h1>
        <p class="inline-flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
          <span class="material-symbols-outlined text-lg !text-emerald-600" aria-hidden="true">lock</span>
          Secure, encrypted checkout
        </p>
      </div>

      <div class="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-8">
        <!-- Left: what you are buying -->
        <div class="flex min-w-0 flex-col gap-6">
          <section class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#121A2B] sm:p-6" aria-labelledby="order-heading">
            <h2 id="order-heading" class="font-['Hanken_Grotesk'] text-lg font-bold text-slate-950 dark:text-white">Order details</h2>

            @if (isLoadingSummary()) {
              <div class="mt-4 flex animate-pulse flex-col gap-4 sm:flex-row">
                <div class="aspect-video w-full rounded-lg bg-slate-200 dark:bg-white/10 sm:w-56"></div>
                <div class="flex-1 space-y-3 py-1">
                  <div class="h-5 w-3/4 rounded bg-slate-200 dark:bg-white/10"></div>
                  <div class="h-4 w-1/2 rounded bg-slate-200 dark:bg-white/10"></div>
                  <div class="h-4 w-2/3 rounded bg-slate-200 dark:bg-white/10"></div>
                </div>
              </div>
            } @else if (templateMode()) {
              <ul class="mt-4 divide-y divide-slate-200 dark:divide-white/10">
                @for (item of cart.items(); track item.id) {
                  <li class="flex gap-4 py-4 first:pt-0 last:pb-0">
                    <div class="aspect-[59/30] w-28 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-100 dark:border-white/10 dark:bg-[#0B1220] sm:w-40">
                      @if (item.thumbnail) {
                        <img [src]="item.thumbnail | mediaUrl" [alt]="item.title" class="h-full w-full object-cover object-top" />
                      }
                    </div>
                    <div class="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                      <div class="min-w-0">
                        <p class="line-clamp-2 font-bold leading-snug text-slate-950 dark:text-white">{{ item.title }}</p>
                        <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">{{ item.category }} · Source code ZIP · Lifetime download</p>
                      </div>
                      <p class="shrink-0 font-bold text-slate-950 dark:text-white">{{ prices.formatCharge(item.price) }}</p>
                    </div>
                  </li>
                }
              </ul>
            } @else if (course(); as c) {
              <div class="mt-4 flex flex-col gap-4 sm:flex-row">
                <div class="relative aspect-video w-full shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-900 dark:border-white/10 sm:w-56">
                  <img [src]="(c.thumbnail | mediaUrl) || '/assets/course-agentic-ai.png'" [alt]="c.title" class="h-full w-full object-cover" />
                </div>
                <div class="flex min-w-0 flex-1 flex-col">
                  <div class="flex items-start justify-between gap-4">
                    <p class="font-['Hanken_Grotesk'] text-lg font-bold leading-snug text-slate-950 dark:text-white">{{ c.title }}</p>
                    <p class="hidden shrink-0 text-lg font-bold text-slate-950 dark:text-white sm:block">{{ prices.formatCharge(originalAmount()) }}</p>
                  </div>
                  @if (c.subtitle) {
                    <p class="mt-1 line-clamp-2 text-sm text-slate-600 dark:text-slate-300">{{ c.subtitle }}</p>
                  }
                  <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">By Technyks Academy</p>
                  <div class="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                    <span class="inline-flex items-center gap-1"><span class="material-symbols-outlined text-base text-[#2563EB] dark:text-[#60A5FA]" aria-hidden="true">signal_cellular_alt</span>{{ c.level }}</span>
                    <span class="inline-flex items-center gap-1"><span class="material-symbols-outlined text-base text-[#2563EB] dark:text-[#60A5FA]" aria-hidden="true">play_lesson</span>{{ lessonCount() }} lessons</span>
                    @if (courseLength()) {
                      <span class="inline-flex items-center gap-1"><span class="material-symbols-outlined text-base text-[#2563EB] dark:text-[#60A5FA]" aria-hidden="true">schedule</span>{{ courseLength() }}</span>
                    }
                    <span class="inline-flex items-center gap-1"><span class="material-symbols-outlined text-base text-[#2563EB] dark:text-[#60A5FA]" aria-hidden="true">workspace_premium</span>Certificate</span>
                  </div>
                  <p class="mt-3 text-lg font-bold text-slate-950 dark:text-white sm:hidden">{{ prices.formatCharge(originalAmount()) }}</p>
                </div>
              </div>
            } @else {
              <p class="mt-4 font-bold text-slate-950 dark:text-white">{{ itemTitle() }}</p>
            }

            <!-- What's included -->
            @if (!isLoadingSummary() && !summaryError()) {
              <ul class="mt-6 grid gap-2 border-t border-slate-200 pt-5 text-sm text-slate-700 dark:border-white/10 dark:text-slate-300 sm:grid-cols-2">
                @for (line of includes(); track line) {
                  <li class="flex items-start gap-2">
                    <span class="material-symbols-outlined text-lg !text-emerald-600" aria-hidden="true">check_circle</span>{{ line }}
                  </li>
                }
              </ul>
            }
          </section>

          @if (finalAmount() > 0 && !isLoadingSummary() && !summaryError()) {
            <section class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#121A2B] sm:p-6" aria-labelledby="method-heading">
              <h2 id="method-heading" class="font-['Hanken_Grotesk'] text-lg font-bold text-slate-950 dark:text-white">Payment method</h2>
              <div class="mt-4 flex items-start gap-3 rounded-lg border-2 border-[#2563EB] bg-blue-50/60 p-4 dark:border-[#3B82F6] dark:bg-[#3B82F6]/10">
                <span class="material-symbols-outlined mt-0.5 text-2xl text-[#2563EB] dark:text-[#60A5FA]" aria-hidden="true">{{ selectedProvider() === 'STRIPE' ? 'credit_card' : 'account_balance_wallet' }}</span>
                <div class="min-w-0">
                  @if (selectedProvider() === 'STRIPE') {
                    <p class="font-bold text-slate-950 dark:text-white">Card payment (Stripe)</p>
                    <p class="mt-0.5 text-sm text-slate-600 dark:text-slate-300">Visa, Mastercard, Amex, Apple Pay and Google Pay, in {{ prices.chargeCurrency() }}. You'll pay on Stripe's secure page.</p>
                  } @else {
                    <p class="font-bold text-slate-950 dark:text-white">Razorpay</p>
                    <p class="mt-0.5 text-sm text-slate-600 dark:text-slate-300">UPI, GPay, PhonePe, cards and netbanking</p>
                  }
                </div>
              </div>
              <p class="mt-3 text-xs text-slate-500 dark:text-slate-400">
                Your {{ templateMode() ? 'downloads are' : 'course is' }} added to your account as soon as the payment is confirmed.
              </p>
            </section>
          }
        </div>

        <!-- Right: summary and purchase button -->
        <aside class="h-fit lg:sticky lg:top-24" aria-labelledby="summary-heading">
          <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-lg dark:border-white/10 dark:bg-[#121A2B] sm:p-6">
            <h2 id="summary-heading" class="font-['Hanken_Grotesk'] text-lg font-bold text-slate-950 dark:text-white">Summary</h2>

            <!-- Coupon -->
            @if (canUseCoupon()) {
              <div class="mt-4">
                <label for="coupon" class="text-xs font-semibold text-slate-600 dark:text-slate-300">Coupon code</label>
                <div class="mt-1.5 flex gap-2">
                  <input
                    id="coupon"
                    type="text"
                    [(ngModel)]="couponCode"
                    (ngModelChange)="clearCoupon()"
                    (keydown.enter)="applyCoupon()"
                    placeholder="Enter code"
                    class="min-w-0 flex-grow rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm uppercase text-slate-900 placeholder:normal-case placeholder:text-slate-400 focus:border-[#2563EB] focus:outline-none dark:border-white/15 dark:bg-[#040810] dark:text-white"
                  />
                  <button
                    type="button"
                    (click)="applyCoupon()"
                    [disabled]="isApplyingCoupon() || !couponCode.trim()"
                    class="shrink-0 rounded-lg border border-[#2563EB] px-4 text-sm font-bold text-[#2563EB] hover:bg-blue-50 disabled:opacity-50 dark:border-[#3B82F6] dark:text-[#60A5FA] dark:hover:bg-[#3B82F6]/10"
                  >
                    {{ isApplyingCoupon() ? '…' : 'Apply' }}
                  </button>
                </div>
                @if (couponSuccess()) {
                  <p class="mt-2 flex items-center gap-1 text-xs font-semibold !text-emerald-700 dark:!text-emerald-400">
                    <span class="material-symbols-outlined text-sm" aria-hidden="true">check_circle</span>
                    {{ couponResult()?.code }} applied: you save {{ discountText() }}
                  </p>
                }
                @if (couponError()) {
                  <p class="mt-2 flex items-center gap-1 text-xs font-semibold !text-rose-600" role="alert">
                    <span class="material-symbols-outlined text-sm" aria-hidden="true">error</span>{{ couponError() }}
                  </p>
                }
              </div>
            } @else if (templateMode() && cart.items().length > 1) {
              <p class="mt-4 text-xs text-slate-500 dark:text-slate-400">Coupons apply when checking out a single UI template.</p>
            }

            <!-- Breakdown -->
            <dl class="mt-5 space-y-2.5 border-t border-slate-200 pt-5 text-sm dark:border-white/10">
              <div class="flex justify-between text-slate-600 dark:text-slate-300">
                <dt>{{ templateMode() && cart.items().length > 1 ? 'Subtotal (' + cart.items().length + ' items)' : 'Price' }}</dt>
                <dd>{{ prices.formatCharge(originalAmount()) }}</dd>
              </div>
              @if (couponResult() && couponResult()?.calculatedDiscount! > 0) {
                <div class="flex justify-between !text-emerald-700 dark:!text-emerald-400">
                  <dt>Discount ({{ couponResult()?.code }})</dt>
                  <dd>−{{ discountText() }}</dd>
                </div>
              }
              <div class="flex justify-between text-slate-500 dark:text-slate-400">
                <dt>Taxes</dt>
                <dd>Included</dd>
              </div>
              <div class="flex items-baseline justify-between border-t border-slate-200 pt-3 dark:border-white/10">
                <dt class="font-bold text-slate-950 dark:text-white">Total</dt>
                <dd class="text-2xl font-bold text-slate-950 dark:text-white">{{ prices.formatCharge(finalAmount()) }}</dd>
              </div>
            </dl>
            @if (finalAmount() > 0 && prices.chargeCurrency() !== prices.currency()) {
              <p class="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Shown as about {{ prices.format(finalAmount()) }}. You'll be charged {{ prices.formatCharge(finalAmount()) }}
                ({{ prices.chargeCurrency() }}); your bank converts it.
              </p>
            }

            <!-- Messages -->
            @if (recoveryMessage()) {
              <p role="status" class="mt-4 rounded-lg !bg-blue-50 p-3 text-sm !text-blue-900">{{ recoveryMessage() }}</p>
            }
            @if (summaryError() || paymentError()) {
              <p role="alert" class="mt-4 rounded-lg !bg-rose-50 p-3 text-sm !text-rose-800">{{ summaryError() || paymentError() }}</p>
            }

            <!-- Purchase button -->
            <button
              type="button"
              (click)="onProceedToPayment()"
              [disabled]="isProcessing() || isLoadingSummary() || !!summaryError()"
              class="mt-5 flex w-full items-center justify-center gap-2 rounded-lg !bg-[#2563EB] px-6 py-4 text-base font-bold !text-white shadow-md transition-colors hover:!bg-[#1D4ED8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] disabled:cursor-not-allowed disabled:opacity-60"
            >
              @if (isProcessing()) {
                <span class="material-symbols-outlined animate-spin text-xl" aria-hidden="true">progress_activity</span>
                Processing…
              } @else {
                <span class="material-symbols-outlined text-xl" aria-hidden="true">lock</span>
                {{ buttonLabel() }}
              }
            </button>

            <p class="mt-3 flex items-center justify-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <span class="material-symbols-outlined text-sm" aria-hidden="true">verified_user</span>
              {{ finalAmount() > 0 ? 'Payments secured by ' + (selectedProvider() === 'STRIPE' ? 'Stripe' : 'Razorpay') : 'No payment needed' }}
            </p>
            <p class="mt-3 text-center text-[11px] leading-5 text-slate-500 dark:text-slate-400">
              By completing your purchase you agree to our
              <a routerLink="/terms-and-conditions" class="underline hover:text-[#2563EB]">Terms</a> and
              <a routerLink="/refund-policy" class="underline hover:text-[#2563EB]">Refund Policy</a>.
            </p>
          </div>
        </aside>
      </div>
    </div>

    <!-- Phones: total and purchase button always in reach -->
    @if (!isLoadingSummary() && !summaryError()) {
      <div class="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] backdrop-blur dark:border-white/10 dark:bg-[#0b1220]/95 lg:hidden">
        <div class="mx-auto flex max-w-6xl items-center gap-3">
          <div class="min-w-0">
            <p class="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">Total</p>
            <p class="truncate text-lg font-bold text-slate-950 dark:text-white">{{ prices.formatCharge(finalAmount()) }}</p>
          </div>
          <button
            type="button"
            (click)="onProceedToPayment()"
            [disabled]="isProcessing() || isLoadingSummary() || !!summaryError()"
            class="ml-auto flex items-center justify-center gap-1.5 rounded-lg !bg-[#2563EB] px-5 py-3 text-sm font-bold !text-white hover:!bg-[#1D4ED8] disabled:opacity-60"
          >
            @if (isProcessing()) {
              <span class="material-symbols-outlined animate-spin text-lg" aria-hidden="true">progress_activity</span> Processing…
            } @else {
              <span class="material-symbols-outlined text-lg" aria-hidden="true">lock</span>
              {{ finalAmount() > 0 ? 'Complete purchase' : buttonLabel() }}
            }
          </button>
        </div>
      </div>
    }
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
  /** The course being bought, for the order card. */
  course = signal<Course | null>(null);

  readonly lessonCount = computed(() =>
    (this.course()?.modules || []).reduce((total, module) => total + (module.lessons?.length || 0), 0),
  );
  readonly courseLength = computed(() => {
    const seconds = (this.course()?.modules || []).reduce(
      (total, module) => total + (module.lessons || []).reduce((sum, lesson) => sum + (Number(lesson.duration) || 0), 0),
      0,
    );
    const minutes = Math.round(seconds / 60);
    if (!minutes) return '';
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    return minutes % 60 ? `${hours}h ${minutes % 60}m` : `${hours}h`;
  });
  readonly backLink = computed(() =>
    this.templateMode() ? ['/cart'] : this.course() ? ['/courses', this.course()!.slug] : ['/courses'],
  );
  readonly includes = computed(() =>
    this.templateMode()
      ? ['Full source code (ZIP)', 'Instant download after payment', 'Lifetime access in your dashboard', 'Use in commercial projects']
      : ['Lifetime access to every lesson', 'Certificate of completion', 'Learn on phone, tablet and desktop', 'Ask questions under any lesson'],
  );
  readonly buttonLabel = computed(() => {
    if (this.finalAmount() <= 0) return this.templateMode() ? 'Get my downloads' : 'Enroll for free';
    return `Complete purchase · ${this.prices.formatCharge(this.finalAmount())}`;
  });
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
            this.course.set(course);
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
    checkout.on('payment.failed', (response: any) =>
      this.zone.run(() => {
        clearPendingPayment();
        this.isProcessing.set(false);
        // Razorpay's own, customer-safe reason (e.g. "declined by the bank").
        const error = response?.error || {};
        const reason = String(error.description || '').trim();
        let message = reason
          ? `Payment failed: ${reason}`
          : 'Payment failed. Please check your payment method and try again.';
        if (this.authService.isAdmin()) {
          const details = [error.code, error.reason, error.step && `step ${error.step}`, error.source && `source ${error.source}`]
            .filter(Boolean)
            .join(', ');
          if (details) message += ` [Admin only: Razorpay ${details}]`;
        }
        console.warn('[Razorpay] payment failed', error);
        this.paymentError.set(message);
      }),
    );
    // Remembered so a reload mid-payment can be re-checked with Razorpay.
    savePendingPayment({ paymentId: order.paymentId, provider: 'RAZORPAY', userId: this.userId() });
    checkout.open();
  }
}

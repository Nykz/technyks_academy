import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { EnrollmentsService, Enrollment } from '../../core/services/enrollments.service';
import { TemplatePurchase, TemplatesService } from '../../core/services/templates.service';
import { PaymentsService, ActiveMembership } from '../../core/services/payments.service';
import { MediaUrlPipe } from '../../core/pipes/media-url.pipe';
import { ThankYouContext } from '../../core/guards/thank-you.guard';

/**
 * Shown after a purchase has been verified by the server (see
 * thankYouGuard). It shows what was bought with the next step right here:
 * open the course, download the template, or start learning with the
 * membership. No payment, enrollment or tracking happens on this page.
 */
@Component({
  selector: 'app-thank-you',
  standalone: true,
  imports: [RouterModule, MediaUrlPipe, DatePipe],
  template: `
    <main class="px-4 pb-20 pt-12 sm:px-6 sm:pt-16">
      <section
        class="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center shadow-sm dark:border-white/10 dark:bg-[#121A2B] sm:px-10 sm:py-12"
        aria-labelledby="thank-you-heading"
      >
        <span
          class="mx-auto grid h-16 w-16 place-items-center rounded-full !bg-emerald-100 !text-emerald-700 dark:!bg-emerald-400/15 dark:!text-emerald-300"
          aria-hidden="true"
        >
          <span class="material-symbols-outlined text-4xl">check_circle</span>
        </span>

        <h1
          id="thank-you-heading"
          class="mt-6 font-['Hanken_Grotesk'] text-3xl font-bold leading-tight text-slate-950 dark:text-white sm:text-4xl"
        >
          Thank You for Your Purchase!
        </h1>
        <p class="mx-auto mt-4 max-w-md text-base leading-7 text-slate-600 dark:text-slate-300">
          {{ subheading() }}
        </p>

        <div class="mt-8 text-left">
          @if (loading()) {
            <div class="h-28 animate-pulse rounded-xl bg-slate-100 dark:bg-white/5" aria-label="Loading your purchase"></div>
          } @else {
            <!-- Course -->
            @if (enrollment(); as item) {
              <article class="flex flex-col gap-4 rounded-xl border border-slate-200 p-4 dark:border-white/10 sm:flex-row sm:items-center">
                <img
                  [src]="(item.course.thumbnail | mediaUrl) || '/assets/course-agentic-ai.png'"
                  [alt]="item.course.title"
                  class="aspect-video w-full rounded-lg object-cover sm:w-44"
                />
                <div class="min-w-0 flex-1">
                  <h2 class="font-['Hanken_Grotesk'] text-lg font-bold leading-snug text-slate-950 dark:text-white">{{ item.course.title }}</h2>
                  <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">{{ lessonCount(item) }} lessons · Lifetime access · Certificate</p>
                </div>
              </article>
              <a
                [routerLink]="courseLink(item)"
                class="mt-5 flex w-full items-center justify-center gap-2 rounded-lg !bg-[#2563EB] px-8 py-4 font-['JetBrains_Mono'] text-sm font-bold uppercase tracking-wider !text-white shadow-md transition-colors hover:!bg-[#1D4ED8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB]"
              >
                Go to course
                <span class="material-symbols-outlined text-lg" aria-hidden="true">play_arrow</span>
              </a>
            }

            <!-- UI templates: download right here -->
            @if (purchases().length) {
              <div class="flex flex-col gap-4">
                @for (purchase of purchases(); track purchase.id) {
                  <article class="rounded-xl border border-slate-200 p-4 dark:border-white/10">
                    <div class="flex flex-col gap-4 sm:flex-row sm:items-center">
                      <img
                        [src]="(purchase.product.thumbnail | mediaUrl) || '/assets/course-agentic-ai.png'"
                        [alt]="purchase.product.title"
                        class="aspect-video w-full rounded-lg object-cover object-top sm:w-44"
                      />
                      <div class="min-w-0 flex-1">
                        <h2 class="font-['Hanken_Grotesk'] text-lg font-bold leading-snug text-slate-950 dark:text-white">{{ purchase.product.title }}</h2>
                        @if (purchase.product.tagline) {
                          <p class="mt-1 line-clamp-2 text-sm text-slate-600 dark:text-slate-300">{{ purchase.product.tagline }}</p>
                        }
                      </div>
                    </div>
                    @if (purchase.product.buyerMessage) {
                      <p class="mt-3 rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-700 dark:bg-white/5 dark:text-slate-300">{{ purchase.product.buyerMessage }}</p>
                    }
                    <button
                      type="button"
                      (click)="download(purchase)"
                      [disabled]="downloadingId() === purchase.product.id"
                      class="mt-4 flex w-full items-center justify-center gap-2 rounded-lg !bg-[#2563EB] px-8 py-4 font-['JetBrains_Mono'] text-sm font-bold uppercase tracking-wider !text-white shadow-md transition-colors hover:!bg-[#1D4ED8] disabled:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB]"
                    >
                      <span class="material-symbols-outlined text-lg" aria-hidden="true">download</span>
                      {{ downloadingId() === purchase.product.id ? 'Preparing your download…' : purchase.product.downloadButtonText || 'Download files' }}
                    </button>
                  </article>
                }
                @if (downloadError()) {
                  <p class="text-sm text-red-600 dark:text-red-400" role="alert">{{ downloadError() }}</p>
                }
                <p class="text-center text-sm text-slate-500 dark:text-slate-400">
                  You can download it again any time from
                  <a routerLink="/dashboard" class="font-semibold text-[#2563EB] hover:underline dark:text-[#3B82F6]">My dashboard</a>.
                </p>
              </div>
            }

            <!-- Membership -->
            @if (membership(); as plan) {
              <article class="rounded-xl border border-slate-200 p-5 dark:border-white/10">
                <div class="flex items-center gap-3">
                  <span class="material-symbols-outlined text-3xl text-amber-500" aria-hidden="true">workspace_premium</span>
                  <div>
                    <h2 class="font-['Hanken_Grotesk'] text-lg font-bold text-slate-950 dark:text-white">{{ plan.name }}</h2>
                    <p class="text-sm text-slate-600 dark:text-slate-300">
                      {{ plan.accessAllCourses ? 'Every course' : 'Your plan courses' }} unlocked until {{ plan.currentPeriodEnd | date: 'd MMM y' }}
                    </p>
                  </div>
                </div>
              </article>
              <a
                routerLink="/dashboard"
                class="mt-5 flex w-full items-center justify-center gap-2 rounded-lg !bg-[#2563EB] px-8 py-4 font-['JetBrains_Mono'] text-sm font-bold uppercase tracking-wider !text-white shadow-md transition-colors hover:!bg-[#1D4ED8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB]"
              >
                Start learning
                <span class="material-symbols-outlined text-lg" aria-hidden="true">play_arrow</span>
              </a>
            }

            @if (nothingFound()) {
              <a
                routerLink="/dashboard"
                class="flex w-full items-center justify-center gap-2 rounded-lg !bg-[#2563EB] px-8 py-4 font-['JetBrains_Mono'] text-sm font-bold uppercase tracking-wider !text-white shadow-md hover:!bg-[#1D4ED8]"
              >
                Go to my dashboard
                <span class="material-symbols-outlined text-lg" aria-hidden="true">arrow_forward</span>
              </a>
            }
          }
        </div>
      </section>
    </main>
  `,
})
export class ThankYouComponent implements OnInit {
  private readonly title = inject(Title);
  private readonly enrollments = inject(EnrollmentsService);
  private readonly templates = inject(TemplatesService);
  private readonly payments = inject(PaymentsService);

  readonly loading = signal(true);
  readonly enrollment = signal<Enrollment | null>(null);
  readonly purchases = signal<TemplatePurchase[]>([]);
  readonly membership = signal<ActiveMembership | null>(null);
  readonly downloadingId = signal<string | null>(null);
  readonly downloadError = signal('');
  private readonly kind = signal<ThankYouContext['kind'] | null>(null);

  readonly subheading = computed(() => {
    switch (this.kind()) {
      case 'templates':
        return this.purchases().length > 1
          ? 'Your templates are ready. Download them below.'
          : 'Your template is ready. Download it below.';
      case 'membership':
        return 'Your membership is active. All its courses are unlocked.';
      default:
        return 'Your enrollment is confirmed. Your course is ready to start.';
    }
  });
  readonly nothingFound = computed(
    () => !this.enrollment() && !this.purchases().length && !this.membership(),
  );

  ngOnInit() {
    this.title.setTitle('Thank You | Technyks Academy');
    // thankYouGuard already confirmed this context with the server.
    const context = (typeof window === 'undefined' ? null : window.history.state?.thankYou) as ThankYouContext | null;
    this.kind.set(context?.kind ?? null);
    const done = () => this.loading.set(false);

    if (context?.kind === 'course') {
      this.enrollments.getMyEnrollments().subscribe({
        next: (items) => {
          this.enrollment.set(items.find((item) => item.courseId === context.courseId && item.course) ?? null);
          done();
        },
        error: done,
      });
    } else if (context?.kind === 'templates') {
      this.templates.purchases().subscribe({
        next: (items) => {
          this.purchases.set(items.filter((item) => context.productIds.includes(item.product?.id)));
          done();
        },
        error: done,
      });
    } else if (context?.kind === 'membership') {
      this.payments.myMemberships().subscribe({
        next: (plans) => {
          this.membership.set(plans.find((plan) => plan.planId === context.planId) ?? null);
          done();
        },
        error: done,
      });
    } else {
      done();
    }
  }

  lessonCount(item: Enrollment) {
    return (item.course.modules || []).reduce((total, module) => total + (module.lessons?.length || 0), 0);
  }

  /** Straight into the first lesson; the course page if it has none yet. */
  courseLink(item: Enrollment) {
    const modules = [...(item.course.modules || [])].sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
    for (const module of modules) {
      const lessons = [...(module.lessons || [])].sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
      if (lessons.length) return ['/courses', item.course.slug, 'watch', lessons[0].id];
    }
    return ['/courses', item.course.slug];
  }

  download(purchase: TemplatePurchase) {
    this.downloadingId.set(purchase.product.id);
    this.downloadError.set('');
    const failed = () => {
      this.downloadingId.set(null);
      this.downloadError.set('The download could not start. Please try again, or download it from My dashboard.');
    };
    this.templates.delivery(purchase.product.id).subscribe({
      next: (delivery) => {
        if (delivery.type === 'external' && delivery.url) {
          this.downloadingId.set(null);
          window.location.assign(delivery.url);
          return;
        }
        this.templates.download(purchase.product.id).subscribe({
          next: (blob) => {
            this.downloadingId.set(null);
            this.templates.saveBlob(blob, delivery.fileName || `${purchase.product.slug}.zip`);
          },
          error: failed,
        });
      },
      error: failed,
    });
  }
}

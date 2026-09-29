import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { catchError, of } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import {
  MembershipPlan,
  PaymentsService,
} from '../../core/services/payments.service';

type Choice = {
  value: string;
  title: string;
  description: string;
  icon: string;
};

const GOALS: Choice[] = [
  {
    value: 'learn-from-scratch',
    title: 'Learn coding from scratch',
    description: 'Build strong foundations with a guided path.',
    icon: 'school',
  },
  {
    value: 'build-projects',
    title: 'Build real-world projects',
    description: 'Turn ideas into portfolio-ready applications.',
    icon: 'construction',
  },
  {
    value: 'advance-career',
    title: 'Advance my career',
    description: 'Prepare for better roles and technical interviews.',
    icon: 'trending_up',
  },
  {
    value: 'ai-automation',
    title: 'Master AI and automation',
    description: 'Create useful AI systems and automated workflows.',
    icon: 'neurology',
  },
];

const EXPERIENCE: Choice[] = [
  {
    value: 'new-to-coding',
    title: 'New to coding',
    description: 'I am starting from the beginning.',
    icon: 'looks_one',
  },
  {
    value: 'learning-fundamentals',
    title: 'Learning the fundamentals',
    description: 'I know a little and want a clear structure.',
    icon: 'code',
  },
  {
    value: 'building-projects',
    title: 'Building projects',
    description: 'I can code and want production-level practice.',
    icon: 'deployed_code',
  },
  {
    value: 'working-developer',
    title: 'Working developer',
    description: 'I want advanced architecture and AI skills.',
    icon: 'terminal',
  },
];

const FALLBACK_PLANS: MembershipPlan[] = [
  {
    id: 'plan_free',
    name: 'Free Membership',
    slug: 'free',
    description: 'Start with free previews and your learner dashboard.',
    price: 0,
    currency: 'INR',
    interval: 'MONTHLY',
    isFree: true,
    isActive: true,
    accessAllCourses: false,
    features: ['Free preview lessons', 'Saved learning profile'],
  },
  {
    id: 'plan_pro_monthly',
    name: 'Pro Monthly',
    slug: 'pro-monthly',
    description: 'Full course access with flexible monthly billing.',
    price: 1499,
    currency: 'INR',
    interval: 'MONTHLY',
    isFree: false,
    isActive: true,
    accessAllCourses: true,
    features: ['All current courses', 'Cancel anytime'],
  },
  {
    id: 'plan_all_access_annual',
    name: 'All-Access Annual',
    slug: 'all-access-annual',
    description: 'The best value for a complete year of learning.',
    price: 11999,
    currency: 'INR',
    interval: 'ANNUAL',
    isFree: false,
    isActive: true,
    accessAllCourses: true,
    features: ['All current and future courses', 'Completion certificates'],
  },
];

import { LocalPricePipe } from '../../core/pipes/local-price.pipe';

@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [CommonModule, RouterModule, LocalPricePipe],
  template: `
    <main class="onboarding-page h-dvh overflow-hidden p-0 lg:p-5">
      <section class="mx-auto h-full w-full max-w-6xl overflow-hidden border border-slate-200 bg-white shadow-2xl dark:border-[#26334B] dark:bg-[#101827] lg:rounded-3xl">
        <div class="grid h-full lg:grid-cols-[300px_minmax(0,1fr)]">
          <aside class="relative hidden h-full overflow-hidden bg-[#0B1730] p-8 text-white lg:block xl:p-10">
            <div class="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-blue-500/20 blur-3xl"></div>
            <div class="relative">
              <a routerLink="/" class="font-['Hanken_Grotesk'] text-xl font-bold text-white">Technyks <span class="text-[#60A5FA]">Academy</span></a>
              <p class="mt-10 font-['JetBrains_Mono'] text-[10px] font-bold uppercase tracking-[.25em] text-[#93C5FD]">Personalize your path</p>
              <h1 class="mt-3 font-['Hanken_Grotesk'] text-3xl font-bold leading-tight text-white">A better learning plan starts with you.</h1>
              <p class="mt-4 text-sm leading-6 text-[#C4D3EA]">Three quick questions help us recommend the right starting point. You can change plans later.</p>
              <div class="mt-10 flex gap-2 lg:flex-col">
                @for (number of [1, 2, 3]; track number) {
                  <div class="flex flex-1 items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors"
                    [class.border-blue-400]="step() === number" [class.bg-blue-500/15]="step() === number"
                    [class.border-white/10]="step() !== number">
                    <span class="grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold"
                      [class.bg-[#3B82F6]]="step() >= number" [class.text-white]="step() >= number"
                      [class.bg-white/10]="step() < number">{{ number }}</span>
                    <span class="hidden text-xs font-semibold lg:block">{{ number === 1 ? 'Your goal' : number === 2 ? 'Experience' : 'Membership' }}</span>
                  </div>
                }
              </div>
            </div>
          </aside>

          <div class="flex h-full min-h-0 flex-col overflow-hidden p-5 sm:p-8 lg:p-10 xl:p-12">
            <div class="mb-5 flex items-center justify-between gap-4 sm:mb-7">
              <span class="font-['JetBrains_Mono'] text-[11px] font-bold uppercase tracking-[.2em] text-[#2563EB]">Step {{ step() }} of 3</span>
              <div class="h-1.5 w-28 overflow-hidden rounded-full bg-slate-200 dark:bg-[#26334B]"><div class="h-full rounded-full bg-[#2563EB] transition-all duration-300" [style.width.%]="step() * 33.333"></div></div>
            </div>

            @if (step() === 1) {
              <div class="onboarding-step">
                <h2 class="font-['Hanken_Grotesk'] text-3xl font-bold text-slate-950 dark:text-white">What brings you to Technyks?</h2>
                <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">Choose the outcome that matters most right now.</p>
                <div class="mt-7 grid gap-3 sm:grid-cols-2">
                  @for (choice of goals; track choice.value) {
                    <button type="button" (click)="learnerGoal.set(choice.value)" class="choice-card text-left" [class.choice-selected]="learnerGoal() === choice.value">
                      <span class="material-symbols-outlined text-xl text-[#2563EB]">{{ choice.icon }}</span>
                      <span class="block font-['Hanken_Grotesk'] text-base font-bold text-slate-900 dark:text-white">{{ choice.title }}</span>
                      <span class="mt-1 block text-xs leading-5 text-slate-600 dark:text-slate-300">{{ choice.description }}</span>
                    </button>
                  }
                </div>
              </div>
            } @else if (step() === 2) {
              <div class="onboarding-step">
                <h2 class="font-['Hanken_Grotesk'] text-3xl font-bold text-slate-950 dark:text-white">Where are you in your coding journey?</h2>
                <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">This helps us match the depth and pace to you.</p>
                <div class="mt-7 grid gap-3 sm:grid-cols-2">
                  @for (choice of experienceChoices; track choice.value) {
                    <button type="button" (click)="experienceLevel.set(choice.value)" class="choice-card text-left" [class.choice-selected]="experienceLevel() === choice.value">
                      <span class="material-symbols-outlined text-xl text-[#2563EB]">{{ choice.icon }}</span>
                      <span class="block font-['Hanken_Grotesk'] text-base font-bold text-slate-900 dark:text-white">{{ choice.title }}</span>
                      <span class="mt-1 block text-xs leading-5 text-slate-600 dark:text-slate-300">{{ choice.description }}</span>
                    </button>
                  }
                </div>
              </div>
            } @else {
              <div class="onboarding-step">
                <h2 class="font-['Hanken_Grotesk'] text-3xl font-bold text-slate-950 dark:text-white">How would you like to start?</h2>
                <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">Free access stays free. Paid plans continue to secure checkout.</p>
                <div class="mt-7 grid gap-3">
                  @for (plan of plans(); track plan.id) {
                    <button type="button" (click)="membershipPreference.set(plan.slug)" class="choice-card flex items-center gap-4 text-left" [class.choice-selected]="membershipPreference() === plan.slug">
                      <span class="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blue-50 text-[#2563EB] dark:bg-blue-950/60"><span class="material-symbols-outlined">{{ plan.isFree ? 'person' : 'workspace_premium' }}</span></span>
                      <span class="min-w-0 flex-1"><span class="block font-['Hanken_Grotesk'] text-base font-bold text-slate-900 dark:text-white">{{ plan.name }}</span><span class="mt-1 block text-xs text-slate-600 dark:text-slate-300">{{ plan.description }}</span></span>
                      <span class="shrink-0 font-['JetBrains_Mono'] text-sm font-bold text-slate-900 dark:text-white">{{ plan.isFree ? (0 | localPrice) : (plan.price | localPrice) }}<span class="block text-[9px] font-normal uppercase text-slate-500">{{ plan.isFree ? 'forever' : plan.interval }}</span></span>
                    </button>
                  }
                </div>
              </div>
            }

            @if (errorMessage()) { <p class="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">{{ errorMessage() }}</p> }
            <div class="mt-auto flex flex-col-reverse gap-3 pt-5 sm:flex-row sm:items-center sm:justify-between sm:pt-7">
              @if (step() > 1) { <button type="button" (click)="previous()" class="px-5 py-3 font-['JetBrains_Mono'] text-xs font-bold uppercase text-slate-600 hover:text-[#2563EB] dark:text-slate-300">Back</button> } @else { <span></span> }
              <button type="button" (click)="next()" [disabled]="!canContinue() || isSaving()" class="flex items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-6 py-3.5 font-['JetBrains_Mono'] text-xs font-bold uppercase !text-white shadow-lg transition-all hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-40">
                @if (isSaving()) { <span class="material-symbols-outlined animate-spin text-base">progress_activity</span> Saving… } @else { {{ step() === 3 ? (isFreeSelection() ? 'Start learning free' : 'Continue to checkout') : 'Continue' }} <span class="material-symbols-outlined text-base">arrow_forward</span> }
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  `,
  styles: [
    `
      .onboarding-page {
        background:
          radial-gradient(
            circle at 12% 12%,
            rgba(37, 99, 235, 0.13),
            transparent 28%
          ),
          #eef3f9;
      }
      :host-context(.dark-theme) .onboarding-page {
        background:
          radial-gradient(
            circle at 12% 12%,
            rgba(59, 130, 246, 0.13),
            transparent 28%
          ),
          #060a12;
      }
      .choice-card {
        width: 100%;
        border: 1px solid #d7e0ec;
        border-radius: 14px;
        background: #fff;
        padding: 16px;
        transition:
          border-color 0.2s,
          box-shadow 0.2s,
          transform 0.2s;
      }
      .choice-card:hover {
        border-color: #60a5fa;
        transform: translateY(-1px);
      }
      .choice-selected {
        border-color: #2563eb !important;
        box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
        background: #f7faff !important;
      }
      :host-context(.dark-theme) .choice-card {
        border-color: #26334b;
        background: #121c2f;
      }
      :host-context(.dark-theme) .choice-selected {
        border-color: #60a5fa !important;
        background: #142344 !important;
      }
      .onboarding-step {
        animation: onboarding-step-in 0.34s cubic-bezier(0.2, 0.7, 0.2, 1) both;
      }
      @keyframes onboarding-step-in {
        from {
          opacity: 0;
          transform: translateY(12px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      @media (max-height: 720px) {
        .choice-card {
          padding: 11px;
        }
        .onboarding-step h2 {
          font-size: 1.65rem;
        }
        .onboarding-step .mt-7 {
          margin-top: 1rem;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .onboarding-step {
          animation: none;
        }
        .choice-card {
          transition: none;
        }
      }
    `,
  ],
})
export class OnboardingComponent implements OnInit {
  private authService = inject(AuthService);
  private paymentsService = inject(PaymentsService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly goals = GOALS;
  readonly experienceChoices = EXPERIENCE;
  step = signal(1);
  learnerGoal = signal('');
  experienceLevel = signal('');
  membershipPreference = signal('free');
  plans = signal<MembershipPlan[]>(FALLBACK_PLANS);
  isSaving = signal(false);
  errorMessage = signal('');

  ngOnInit() {
    const cached = this.authService.currentUser();
    this.learnerGoal.set(cached?.learnerGoal || '');
    this.experienceLevel.set(cached?.experienceLevel || '');
    this.membershipPreference.set(cached?.membershipPreference || 'free');

    this.paymentsService
      .getPlans()
      .pipe(catchError(() => of(FALLBACK_PLANS)))
      .subscribe((plans) => {
        const active = plans.filter((plan) => plan.isActive !== false);
        if (active.length) this.plans.set(active);
        if (!active.some((plan) => plan.slug === this.membershipPreference())) {
          this.membershipPreference.set(
            active.find((plan) => plan.isFree)?.slug ||
              active[0]?.slug ||
              'free',
          );
        }
      });

    this.authService.getProfile().subscribe({
      next: (user) => {
        if (user.role === 'ADMIN' || user.onboardingCompleted)
          this.navigateAfterFreeChoice();
      },
    });
  }

  canContinue() {
    return this.step() === 1
      ? Boolean(this.learnerGoal())
      : this.step() === 2
        ? Boolean(this.experienceLevel())
        : Boolean(this.membershipPreference());
  }

  previous() {
    this.errorMessage.set('');
    this.step.update((value) => Math.max(1, value - 1));
  }

  next() {
    if (!this.canContinue()) return;
    if (this.step() < 3) {
      this.errorMessage.set('');
      this.step.update((value) => value + 1);
      return;
    }
    this.save();
  }

  isFreeSelection() {
    return Boolean(
      this.plans().find((plan) => plan.slug === this.membershipPreference())
        ?.isFree,
    );
  }

  private save() {
    this.isSaving.set(true);
    this.errorMessage.set('');
    this.authService
      .completeOnboarding({
        learnerGoal: this.learnerGoal(),
        experienceLevel: this.experienceLevel(),
        membershipPreference: this.membershipPreference(),
      })
      .subscribe({
        next: () => {
          this.isSaving.set(false);
          if (this.isFreeSelection()) this.navigateAfterFreeChoice();
          else
            this.router.navigate(['/checkout'], {
              queryParams: { planSlug: this.membershipPreference() },
            });
        },
        error: (error) => {
          this.isSaving.set(false);
          this.errorMessage.set(
            error?.error?.message ||
              'Your preferences could not be saved. Please try again.',
          );
        },
      });
  }

  private navigateAfterFreeChoice() {
    const requested = this.route.snapshot.queryParamMap.get('returnUrl');
    const destination =
      requested?.startsWith('/') &&
      !requested.startsWith('/onboarding') &&
      !requested.startsWith('/checkout')
        ? requested
        : '/dashboard';
    this.router.navigateByUrl(destination);
  }
}

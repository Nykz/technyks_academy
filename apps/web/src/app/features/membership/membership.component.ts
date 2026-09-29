import { Component, OnInit, PLATFORM_ID, inject, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { catchError, of } from 'rxjs';
import { MembershipPlan } from '../../core/services/payments.service';
import { AuthService } from '../../core/services/auth.service';

const FALLBACK_PLANS: MembershipPlan[] = [
  {
    id: 'plan_free',
    name: 'Free Tier',
    slug: 'free',
    description: 'Start learning with previews, community access, and academy updates.',
    price: 0,
    currency: 'INR',
    interval: 'MONTHLY',
    isFree: true,
    isActive: true,
    accessAllCourses: false,
    features: ['Free preview lessons', 'Community access', 'Newsletter updates'],
  },
  {
    id: 'plan_pro_monthly',
    name: 'Pro Monthly',
    slug: 'pro-monthly',
    description: 'A focused membership for engineers building production systems.',
    price: 1499,
    currency: 'INR',
    interval: 'MONTHLY',
    isFree: false,
    isActive: true,
    accessAllCourses: true,
    features: ['All courses', 'Source code downloads', 'Q&A forum priority', 'Cancel anytime'],
  },
  {
    id: 'plan_all_access_annual',
    name: 'All-Access Annual',
    slug: 'all-access-annual',
    description: 'The complete Technyks learning program with every current and future course.',
    price: 11999,
    currency: 'INR',
    interval: 'ANNUAL',
    isFree: false,
    isActive: true,
    accessAllCourses: true,
    features: ['All courses and future releases', 'Completion certificates', '1-on-1 architecture review', 'RBI UPI Autopay'],
  },
];

import { LocalPricePipe } from '../../core/pipes/local-price.pipe';

@Component({
  selector: 'app-membership',
  standalone: true,
  imports: [CommonModule, RouterModule, LocalPricePipe],
  template: `
    <div class="px-4 sm:px-6 md:px-16 pt-16 sm:pt-20 lg:pt-24 pb-16 sm:pb-20 max-w-7xl mx-auto">
      <div class="text-center max-w-3xl mx-auto mb-10 sm:mb-16">
        <div class="inline-flex items-center gap-2 font-['JetBrains_Mono'] text-xs text-[#1D4ED8] dark:text-[#3B82F6] px-3.5 py-1.5 border border-[#2563EB]/40 dark:border-[#3B82F6]/30 bg-blue-50/90 dark:bg-[#3B82F6]/10 rounded-full w-fit mb-4 font-bold">
          <span class="material-symbols-outlined text-[16px]">workspace_premium</span>
          TECHNYKS MEMBERSHIP PROGRAM
        </div>
        <h1 class="font-['Hanken_Grotesk'] text-4xl md:text-5xl font-bold text-slate-900 dark:text-white mb-4">Learn faster with the right access</h1>
        <p class="font-['Inter'] text-base md:text-lg text-slate-600 dark:text-[#d9c3af]">{{ paidPlan()?.description || 'Unlock structured courses, practical projects, and the tools to turn ideas into working products.' }}</p>

        <div class="inline-flex w-full max-w-md flex-col sm:flex-row items-stretch sm:items-center bg-slate-100 border border-slate-200 dark:bg-[#121A2B] dark:border-[#1E293B] p-1.5 rounded-2xl sm:rounded-full mt-8 shadow-sm">
          <button type="button" (click)="isAnnual.set(false)" [class.membership-period-active]="!isAnnual()" [class.bg-[#1D4ED8]]="!isAnnual()" [class.!text-white]="!isAnnual()" [class.font-bold]="!isAnnual()" [class.text-slate-600]="isAnnual()" [class.dark:text-[#d9c3af]]="isAnnual()" class="font-['JetBrains_Mono'] text-xs uppercase px-4 sm:px-6 py-2.5 rounded-full transition-all whitespace-nowrap">Monthly Billing</button>
          <button type="button" (click)="isAnnual.set(true)" [class.membership-period-active]="isAnnual()" [class.bg-[#1D4ED8]]="isAnnual()" [class.!text-white]="isAnnual()" [class.font-bold]="isAnnual()" [class.text-slate-600]="!isAnnual()" [class.dark:text-[#d9c3af]]="!isAnnual()" class="font-['JetBrains_Mono'] text-xs uppercase px-4 sm:px-6 py-2.5 rounded-full transition-all flex items-center justify-center gap-2 whitespace-nowrap">Annual Billing <span class="membership-save-badge text-[10px] px-2 py-0.5 rounded-full font-bold">SAVE 33%</span></button>
        </div>
      </div>

      <div class="mb-12 max-w-4xl mx-auto p-4 bg-blue-50/80 border border-blue-200 text-blue-900 dark:bg-[#121A2B] dark:border-[#3B82F6]/40 dark:text-[#a1c9ff] rounded text-xs font-['JetBrains_Mono'] flex items-start sm:items-center gap-3">
        <span class="material-symbols-outlined text-xl text-[#2563EB] dark:text-[#3B82F6]">security</span>
        <div><span class="font-bold uppercase text-[#2563EB] dark:text-[#3B82F6]">Secure billing:</span> Membership access is granted after confirmed payment and is enforced by the server for every protected lesson.</div>
      </div>

      @if (isLoading()) {
        <div class="text-center font-['JetBrains_Mono'] text-sm text-[#a18d7b]">Loading membership plans...</div>
      } @else {
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
          @if (freePlan(); as plan) {
            <article class="bg-white border border-slate-200 dark:bg-[#121A2B] dark:border-[#1E293B] rounded-xl p-5 sm:p-8 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow">
              <div>
                <span class="font-['JetBrains_Mono'] text-xs uppercase text-slate-500 dark:text-[#a18d7b] font-bold">STARTER</span>
                <h2 class="font-['Hanken_Grotesk'] text-2xl font-bold text-slate-900 dark:text-white mt-1 mb-3">{{ plan.name }}</h2>
                <p class="font-['Inter'] text-sm text-slate-600 dark:text-[#d9c3af] mb-6">{{ plan.description }}</p>
                <div class="font-['JetBrains_Mono'] text-4xl font-bold text-slate-900 dark:text-white mb-6">{{ plan.price | localPrice }} <span class="text-xs text-slate-500 dark:text-[#a18d7b] font-normal">/ forever</span></div>
                <ul class="flex flex-col gap-3 font-['Inter'] text-sm text-slate-700 dark:text-[#d9c3af] mb-8">
                  @for (feature of plan.features; track feature) { <li class="flex items-center gap-2"><span class="material-symbols-outlined text-[#2563EB] dark:text-[#3B82F6] text-base">check</span>{{ feature }}</li> }
                </ul>
              </div>
              @if (authService.isAuthenticated()) {
                <div class="space-y-3">
                  <div class="flex items-center justify-center gap-2 rounded-lg bg-emerald-50 px-3 py-2.5 font-['Inter'] text-xs font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                    <span class="material-symbols-outlined text-base">verified</span>Your free access is active
                  </div>
                  <a routerLink="/dashboard" class="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-[#2563EB] py-3.5 text-center font-['JetBrains_Mono'] text-xs font-bold uppercase tracking-wider text-[#1D4ED8] transition-colors hover:bg-blue-50 dark:border-[#3B82F6] dark:text-[#3B82F6] dark:hover:bg-[#3B82F6]/10">Go to dashboard <span class="material-symbols-outlined text-base">arrow_forward</span></a>
                </div>
              } @else {
                <a routerLink="/auth/signup" class="w-full text-center font-['JetBrains_Mono'] text-xs uppercase tracking-wider text-[#1D4ED8] dark:text-[#3B82F6] border-2 border-[#2563EB] dark:border-[#3B82F6] py-3.5 rounded-lg font-bold hover:bg-blue-50 dark:hover:bg-[#3B82F6]/10 transition-colors">Create free account</a>
              }
            </article>
          }

          @if (paidPlan(); as plan) {
            <article class="lg:col-span-2 bg-white border-2 border-[#2563EB] dark:bg-[#121A2B] dark:border-[#3B82F6] rounded-xl p-5 sm:p-8 flex flex-col justify-between relative shadow-xl">
              <span class="absolute -top-3.5 right-6 font-['JetBrains_Mono'] text-[10px] uppercase font-bold !text-white bg-[#1D4ED8] dark:bg-[#3B82F6] px-3 py-1 rounded-full shadow">{{ isAnnual() ? 'BEST VALUE' : 'POPULAR' }}</span>
              <div>
                <span class="font-['JetBrains_Mono'] text-xs uppercase text-[#2563EB] dark:text-[#3B82F6] font-bold">{{ isAnnual() ? 'ANNUAL VIP' : 'PRO ENGINEER' }}</span>
                <h2 class="font-['Hanken_Grotesk'] text-3xl font-bold text-slate-900 dark:text-white mt-1 mb-3">{{ plan.name }}</h2>
                <p class="font-['Inter'] text-base text-slate-600 dark:text-[#d9c3af] mb-6 max-w-2xl">{{ plan.description }}</p>
                <div class="font-['JetBrains_Mono'] text-4xl font-bold text-slate-900 dark:text-white mb-6">{{ plan.price | localPrice }} <span class="text-xs text-slate-500 dark:text-[#a18d7b] font-normal">/ {{ isAnnual() ? 'year' : 'month' }}</span></div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 font-['Inter'] text-sm text-slate-700 dark:text-[#d9c3af] mb-8">
                  @for (feature of plan.features; track feature) { <div class="flex items-center gap-2"><span class="material-symbols-outlined text-[#2563EB] dark:text-[#3B82F6] text-base">check_circle</span>{{ feature }}</div> }
                </div>
              </div>
              <a routerLink="/checkout" [queryParams]="{ planSlug: plan.slug }" class="w-full text-center font-['JetBrains_Mono'] text-xs uppercase tracking-wider !text-white bg-[#1D4ED8] hover:bg-[#1E40AF] py-4 rounded-lg font-bold transition-all flex items-center justify-center gap-2 shadow-lg">Join {{ plan.name }} <span class="material-symbols-outlined text-sm !text-white">arrow_forward</span></a>
            </article>
          } @else {
            <div class="lg:col-span-2 border border-dashed border-[#3B82F6]/50 rounded-lg p-8 text-center font-['JetBrains_Mono'] text-sm text-[#a18d7b]">This membership interval is not available yet.</div>
          }
        </div>
      }
    </div>
  `,
})
export class MembershipComponent implements OnInit {
  private http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);
  authService = inject(AuthService);
  isAnnual = signal(true);
  isLoading = signal(true);
  plans = signal<MembershipPlan[]>([]);

  ngOnInit() {
    if (!isPlatformBrowser(this.platformId)) {
      this.plans.set(FALLBACK_PLANS);
      this.isLoading.set(false);
      return;
    }

    this.http.get<MembershipPlan[]>('/api/payments/plans').pipe(
      catchError(() => of(this.getFallbackPlans())),
    ).subscribe((plans) => {
      this.plans.set(plans.filter((plan) => plan.isActive !== false));
      this.isLoading.set(false);
    });
  }

  freePlan(): MembershipPlan | undefined {
    return this.plans().find((plan) => plan.isFree);
  }

  paidPlan(): MembershipPlan | undefined {
    const interval = this.isAnnual() ? 'ANNUAL' : 'MONTHLY';
    return this.plans().find((plan) => !plan.isFree && plan.interval === interval);
  }

  private getFallbackPlans(): MembershipPlan[] {
    if (typeof localStorage === 'undefined') return FALLBACK_PLANS;
    try {
      const stored = JSON.parse(
        localStorage.getItem('technyks_membership_plans_v1') || 'null',
      );
      return Array.isArray(stored) && stored.length ? stored : FALLBACK_PLANS;
    } catch {
      return FALLBACK_PLANS;
    }
  }
}

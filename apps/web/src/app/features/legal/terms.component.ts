import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-terms-conditions',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="min-h-screen bg-slate-50 dark:bg-[#040810] text-slate-800 dark:text-[#e0e3e5] pt-24 pb-20 px-6 md:px-16 max-w-5xl mx-auto transition-colors">
      <div class="mb-10 pb-6 border-b border-slate-200 dark:border-[#1E293B]">
        <div class="font-['JetBrains_Mono'] text-xs uppercase tracking-widest text-[#2563EB] dark:text-[#3B82F6] mb-2 font-bold">
          Terms of Service
        </div>
        <h1 class="font-['Hanken_Grotesk'] text-3xl md:text-4xl font-bold text-slate-900 dark:text-white">
          Terms & Conditions
        </h1>
        <p class="font-['Inter'] text-sm text-slate-500 dark:text-[#a18d7b] mt-2">
          Effective Date: January 1, 2026 · Last Updated: September 4, 2026
        </p>
      </div>

      <div class="prose dark:prose-invert max-w-none font-['Inter'] text-sm leading-relaxed space-y-8">
        <section class="bg-white dark:bg-[#121A2B] border border-slate-200 dark:border-[#1E293B] rounded-xl p-6 shadow-sm">
          <h2 class="font-['Hanken_Grotesk'] text-xl font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
            <span class="material-symbols-outlined text-[#2563EB] dark:text-[#3B82F6]">gavel</span>
            1. Agreement to Terms
          </h2>
          <p class="text-slate-600 dark:text-[#d9c3af]">
            By accessing or using the Technyks Academy website, creating an account, or purchasing any educational course or membership, you agree to be bound by these Terms and Conditions. If you disagree with any part of these terms, you may not access our services.
          </p>
        </section>

        <section class="bg-white dark:bg-[#121A2B] border border-slate-200 dark:border-[#1E293B] rounded-xl p-6 shadow-sm">
          <h2 class="font-['Hanken_Grotesk'] text-xl font-bold text-slate-900 dark:text-white mb-3">
            2. Intellectual Property & License
          </h2>
          <p class="text-slate-600 dark:text-[#d9c3af] mb-3">
            All curriculum videos, lesson notes, code repositories, architecture diagrams, and exercises provided on Technyks Academy are the exclusive proprietary property of Technyks Academy.
          </p>
          <ul class="list-disc pl-5 space-y-2 text-slate-600 dark:text-[#d9c3af]">
            <li>You are granted a limited, personal, non-exclusive, non-transferable license to access and complete the courses for your own learning.</li>
            <li>You may not reproduce, redistribute, re-broadcast, scrape, resell, or publicly display our video content or instructional materials without express written permission.</li>
          </ul>
        </section>

        <section class="bg-white dark:bg-[#121A2B] border border-slate-200 dark:border-[#1E293B] rounded-xl p-6 shadow-sm">
          <h2 class="font-['Hanken_Grotesk'] text-xl font-bold text-slate-900 dark:text-white mb-3">
            3. Account Responsibilities & Conduct
          </h2>
          <p class="text-slate-600 dark:text-[#d9c3af]">
            You are responsible for maintaining the confidentiality of your account credentials and for all activities occurring under your account. You agree not to share your account with multiple users or engage in unauthorized automated access to our learning systems.
          </p>
        </section>

        <section class="bg-white dark:bg-[#121A2B] border border-slate-200 dark:border-[#1E293B] rounded-xl p-6 shadow-sm">
          <h2 class="font-['Hanken_Grotesk'] text-xl font-bold text-slate-900 dark:text-white mb-3">
            4. Membership Billing & Cancellation
          </h2>
          <p class="text-slate-600 dark:text-[#d9c3af]">
            Membership subscriptions (Monthly or Annual) provide continuous access to our full library. Subscriptions renew automatically at the specified interval unless cancelled prior to the renewal date through your account dashboard or payment portal.
          </p>
        </section>

        <section class="bg-white dark:bg-[#121A2B] border border-slate-200 dark:border-[#1E293B] rounded-xl p-6 shadow-sm">
          <h2 class="font-['Hanken_Grotesk'] text-xl font-bold text-slate-900 dark:text-white mb-3">
            5. Contact Information
          </h2>
          <p class="text-slate-600 dark:text-[#d9c3af]">
            For legal inquiries, contact us at <a href="mailto:contact@technyks.com" class="text-[#2563EB] dark:text-[#3B82F6] hover:underline font-medium">contact&#64;technyks.com</a>.
          </p>
        </section>
      </div>
    </div>
  `,
})
export class TermsComponent {}

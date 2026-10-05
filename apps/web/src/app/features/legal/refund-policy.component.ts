import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-refund-policy',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="min-h-screen bg-slate-50 dark:bg-[#040810] text-slate-800 dark:text-[#e0e3e5] pt-24 pb-20 px-6 md:px-16 max-w-5xl mx-auto transition-colors">
      <div class="mb-10 pb-6 border-b border-slate-200 dark:border-[#1E293B]">
        <div class="font-['JetBrains_Mono'] text-xs uppercase tracking-widest text-[#2563EB] dark:text-[#3B82F6] mb-2 font-bold">
          Payment Policies
        </div>
        <h1 class="font-['Hanken_Grotesk'] text-3xl md:text-4xl font-bold text-slate-900 dark:text-white">
          Cancellation & Refund Policy
        </h1>
        <p class="font-['Inter'] text-sm text-slate-500 dark:text-[#a18d7b] mt-2">
          Effective Date: January 1, 2026 · Last Updated: September 4, 2026
        </p>
      </div>

      <div class="prose dark:prose-invert max-w-none font-['Inter'] text-sm leading-relaxed space-y-8">
        <section class="bg-white dark:bg-[#121A2B] border border-slate-200 dark:border-[#1E293B] rounded-xl p-6 shadow-sm">
          <h2 class="font-['Hanken_Grotesk'] text-xl font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
            <span class="material-symbols-outlined text-[#2563EB] dark:text-[#3B82F6]">verified</span>
            1. 30-Day Money-Back Guarantee (Individual Courses)
          </h2>
          <p class="text-slate-600 dark:text-[#d9c3af]">
            We want you to be completely confident in your learning investment. If you purchase an individual course and find that it does not meet your expectations, you may request a full refund within <strong>30 days of purchase</strong>, provided you have watched less than 50% of the course content and have not claimed a completion certificate.
          </p>
        </section>

        <section class="bg-white dark:bg-[#121A2B] border border-slate-200 dark:border-[#1E293B] rounded-xl p-6 shadow-sm">
          <h2 class="font-['Hanken_Grotesk'] text-xl font-bold text-slate-900 dark:text-white mb-3">
            2. Membership Subscriptions
          </h2>
          <p class="text-slate-600 dark:text-[#d9c3af]">
            Membership plans (Pro Monthly and All-Access Annual) can be cancelled at any time from your account dashboard. Upon cancellation, you will retain full access until the end of your current billing period, after which no further charges will occur.
          </p>
        </section>

        <section class="bg-white dark:bg-[#121A2B] border border-slate-200 dark:border-[#1E293B] rounded-xl p-6 shadow-sm">
          <h2 class="font-['Hanken_Grotesk'] text-xl font-bold text-slate-900 dark:text-white mb-3">
            3. How to Request a Refund
          </h2>
          <p class="text-slate-600 dark:text-[#d9c3af] mb-3">
            To submit a refund request:
          </p>
          <ol class="list-decimal pl-5 space-y-2 text-slate-600 dark:text-[#d9c3af]">
            <li>Send an email to <a href="mailto:contact@technyks.com" class="text-[#2563EB] dark:text-[#3B82F6] hover:underline font-medium">contact&#64;technyks.com</a> with your registered email and payment reference ID.</li>
            <li>Our team will review your request within 24 to 48 hours.</li>
            <li>Approved refunds are credited back to your original payment method (Bank Account / UPI / Card) within 5 to 7 business days as per banking norms.</li>
          </ol>
        </section>
      </div>
    </div>
  `,
})
export class RefundPolicyComponent {}

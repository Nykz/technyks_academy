import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-privacy-policy',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="min-h-screen bg-slate-50 dark:bg-[#040810] text-slate-800 dark:text-[#e0e3e5] pt-24 pb-20 px-6 md:px-16 max-w-5xl mx-auto transition-colors">
      <div class="mb-10 pb-6 border-b border-slate-200 dark:border-[#1E293B]">
        <div class="font-['JetBrains_Mono'] text-xs uppercase tracking-widest text-[#2563EB] dark:text-[#3B82F6] mb-2 font-bold">
          Legal & Compliance
        </div>
        <h1 class="font-['Hanken_Grotesk'] text-3xl md:text-4xl font-bold text-slate-900 dark:text-white">
          Privacy Policy
        </h1>
        <p class="font-['Inter'] text-sm text-slate-500 dark:text-[#a18d7b] mt-2">
          Effective Date: January 1, 2026 · Last Updated: September 4, 2026
        </p>
      </div>

      <div class="prose dark:prose-invert max-w-none font-['Inter'] text-sm leading-relaxed space-y-8">
        <section class="bg-white dark:bg-[#121A2B] border border-slate-200 dark:border-[#1E293B] rounded-xl p-6 shadow-sm">
          <h2 class="font-['Hanken_Grotesk'] text-xl font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
            <span class="material-symbols-outlined text-[#2563EB] dark:text-[#3B82F6]">shield</span>
            1. Overview & Commitment
          </h2>
          <p class="text-slate-600 dark:text-[#d9c3af]">
            Technyks Academy ("we," "our," or "us") is dedicated to protecting your personal information and your right to privacy. This Privacy Policy governs how we collect, store, utilize, and protect your information when you access our website (<strong>codingtechnyks.com</strong> / <strong>courses.codingtechnyks.com</strong>), enroll in our coding masterclasses, purchase memberships, or use our interactive learning tools.
          </p>
        </section>

        <section class="bg-white dark:bg-[#121A2B] border border-slate-200 dark:border-[#1E293B] rounded-xl p-6 shadow-sm">
          <h2 class="font-['Hanken_Grotesk'] text-xl font-bold text-slate-900 dark:text-white mb-3">
            2. Information We Collect
          </h2>
          <ul class="list-disc pl-5 space-y-2 text-slate-600 dark:text-[#d9c3af]">
            <li><strong>Account Information:</strong> Name, email address, password hash, profile avatar, and account role when you register.</li>
            <li><strong>Authentication Data:</strong> When signing in with Google OAuth, we receive your verified email, full name, and profile picture identifier.</li>
            <li><strong>Learning & Progress Data:</strong> Course enrollments, lesson completion status, quiz submissions, and certificates issued.</li>
            <li><strong>Payment & Transaction Information:</strong> Transactions are securely processed through RBI/PCI-DSS compliant payment gateways (Razorpay). We do not store raw credit card numbers or UPI PINs on our servers.</li>
            <li><strong>Communications:</strong> Any messages, feedback, support inquiries, or reviews submitted through our contact form.</li>
            <li><strong>Technical & Analytical Logs:</strong> IP address, browser type, operating system, pages viewed, and referral URLs.</li>
            <li><strong>Country for Pricing:</strong> To show prices and charge you in your local currency, we look up the country of your IP address. Only the IP address is sent to a country lookup service (country.is); the result is kept for up to 12 hours and is not linked to your account.</li>
          </ul>
        </section>

        <section class="bg-white dark:bg-[#121A2B] border border-slate-200 dark:border-[#1E293B] rounded-xl p-6 shadow-sm">
          <h2 class="font-['Hanken_Grotesk'] text-xl font-bold text-slate-900 dark:text-white mb-3">
            3. Google Ads, Analytics & Cookies
          </h2>
          <p class="text-slate-600 dark:text-[#d9c3af] mb-3">
            We use Google Analytics and Google Advertising services (including Google Ads / AdSense) to deliver relevant content and measure site usage.
          </p>
          <ul class="list-disc pl-5 space-y-2 text-slate-600 dark:text-[#d9c3af]">
            <li>Google, as a third-party vendor, uses cookies to serve ads based on user visits to our website and other sites across the Internet.</li>
            <li>Users may opt out of personalized advertising by visiting Google's <a href="https://adssettings.google.com" target="_blank" rel="noopener noreferrer" class="text-[#2563EB] dark:text-[#3B82F6] hover:underline font-medium">Ads Settings</a>.</li>
            <li>You can configure your browser to reject cookies; however, some academy features (such as maintaining login sessions) may not function properly without cookies.</li>
          </ul>
        </section>

        <section class="bg-white dark:bg-[#121A2B] border border-slate-200 dark:border-[#1E293B] rounded-xl p-6 shadow-sm">
          <h2 class="font-['Hanken_Grotesk'] text-xl font-bold text-slate-900 dark:text-white mb-3">
            4. Data Security & Storage
          </h2>
          <p class="text-slate-600 dark:text-[#d9c3af]">
            We employ industry-standard encryption protocols (HTTPS / TLS 1.3), bcrypt password hashing, and tokenized session authentication (JWT). Your data is hosted on secured infrastructure with strict access boundaries.
          </p>
        </section>

        <section class="bg-white dark:bg-[#121A2B] border border-slate-200 dark:border-[#1E293B] rounded-xl p-6 shadow-sm">
          <h2 class="font-['Hanken_Grotesk'] text-xl font-bold text-slate-900 dark:text-white mb-3">
            5. Your Rights & Contact Us
          </h2>
          <p class="text-slate-600 dark:text-[#d9c3af] mb-3">
            You have the right to review, update, or request the deletion of your personal data at any time. For questions or privacy requests:
          </p>
          <div class="bg-slate-50 dark:bg-[#040810] p-4 rounded-lg border border-slate-200 dark:border-[#1E293B] font-['JetBrains_Mono'] text-xs">
            <p><strong>Email:</strong> support&#64;codingtechnyks.com</p>
            <p class="mt-1"><strong>Address:</strong> Technyks Academy, India</p>
          </div>
        </section>
      </div>
    </div>
  `,
})
export class PrivacyPolicyComponent {}

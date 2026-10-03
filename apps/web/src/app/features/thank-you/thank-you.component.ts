import { Component, OnInit, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { Title } from '@angular/platform-browser';

/**
 * Shown after a purchase has been verified by the server. It only links
 * onward: no payment, enrollment or tracking happens here, so refreshing
 * or opening it directly is harmless.
 */
@Component({
  selector: 'app-thank-you',
  standalone: true,
  imports: [RouterModule],
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
          Your enrollment is confirmed.<br />
          Your course is ready to start.
        </p>

        <a
          routerLink="/dashboard"
          class="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-lg !bg-[#2563EB] px-8 py-4 font-['JetBrains_Mono'] text-sm font-bold uppercase tracking-wider !text-white shadow-md transition-colors hover:!bg-[#1D4ED8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] sm:w-auto"
        >
          Start Learning Now
          <span class="material-symbols-outlined text-lg" aria-hidden="true">play_arrow</span>
        </a>
      </section>

      <section
        class="mx-auto mt-6 max-w-2xl rounded-2xl border border-slate-200 bg-white px-6 py-8 text-center dark:border-white/10 dark:bg-[#121A2B] sm:px-10"
        aria-labelledby="explore-heading"
      >
        <h2
          id="explore-heading"
          class="font-['Hanken_Grotesk'] text-xl font-bold text-slate-950 dark:text-white sm:text-2xl"
        >
          Explore Other Courses
        </h2>
        <p class="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-600 dark:text-slate-300 sm:text-base">
          Want to learn more? Explore our other courses and continue building your skills.
        </p>
        <a
          routerLink="/courses"
          class="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#2563EB] px-8 py-3.5 font-['JetBrains_Mono'] text-sm font-bold uppercase tracking-wider text-[#2563EB] transition-colors hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] dark:border-[#3B82F6] dark:text-[#3B82F6] dark:hover:bg-[#3B82F6]/10 sm:w-auto"
        >
          Explore Courses
          <span class="material-symbols-outlined text-lg" aria-hidden="true">arrow_forward</span>
        </a>
      </section>
    </main>
  `,
})
export class ThankYouComponent implements OnInit {
  private readonly title = inject(Title);

  ngOnInit() {
    this.title.setTitle('Thank You | Technyks Academy');
  }
}

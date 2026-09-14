import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [FormsModule, RouterModule],
  template: `
    <main class="flex min-h-[85vh] items-center justify-center px-4 py-12">
      <section
        class="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-2xl dark:border-[#26334B] dark:bg-[#121A2B]"
      >
        <p
          class="font-['JetBrains_Mono'] text-xs font-semibold uppercase tracking-widest text-[#2563EB]"
        >
          SECURE PASSWORD RESET
        </p>
        <h1
          class="mt-5 font-['Hanken_Grotesk'] text-3xl font-bold text-slate-950 dark:text-white"
        >
          Choose a new password
        </h1>
        <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Use at least 8 characters. This link expires after 30 minutes.
        </p>

        @if (successMessage()) {
          <div
            role="status"
            class="mt-6 rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
          >
            {{ successMessage() }}
          </div>
          <a
            routerLink="/auth/login"
            class="mt-5 flex w-full justify-center rounded-lg bg-[#2563EB] px-4 py-3 font-['JetBrains_Mono'] text-xs font-bold uppercase !text-white"
            >Continue to sign in</a
          >
        } @else {
          @if (errorMessage()) {
            <div
              role="alert"
              class="mt-6 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
            >
              {{ errorMessage() }}
            </div>
          }
          <form (ngSubmit)="submit()" class="mt-6 space-y-5">
            <div>
              <label
                for="new-password"
                class="mb-2 block font-['JetBrains_Mono'] text-xs font-bold uppercase text-slate-700 dark:text-slate-300"
                >New password</label
              >
              <input
                id="new-password"
                type="password"
                name="newPassword"
                [(ngModel)]="newPassword"
                minlength="8"
                required
                autocomplete="new-password"
                class="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none focus:border-[#2563EB] dark:border-[#334155] dark:bg-[#040810] dark:text-white"
              />
            </div>
            <div>
              <label
                for="confirm-password"
                class="mb-2 block font-['JetBrains_Mono'] text-xs font-bold uppercase text-slate-700 dark:text-slate-300"
                >Confirm password</label
              >
              <input
                id="confirm-password"
                type="password"
                name="confirmPassword"
                [(ngModel)]="confirmPassword"
                minlength="8"
                required
                autocomplete="new-password"
                class="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none focus:border-[#2563EB] dark:border-[#334155] dark:bg-[#040810] dark:text-white"
              />
            </div>
            <button
              type="submit"
              [disabled]="isLoading() || !token"
              class="w-full rounded-lg bg-[#2563EB] px-4 py-3 font-['JetBrains_Mono'] text-xs font-bold uppercase !text-white disabled:opacity-50"
            >
              {{ isLoading() ? 'Saving…' : 'Save new password' }}
            </button>
          </form>
        }
      </section>
    </main>
  `,
})
export class ResetPasswordComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private authService = inject(AuthService);

  token = '';
  newPassword = '';
  confirmPassword = '';
  isLoading = signal(false);
  errorMessage = signal('');
  successMessage = signal('');

  ngOnInit() {
    this.token = this.route.snapshot.queryParamMap.get('token') || '';
    if (!this.token) {
      this.errorMessage.set(
        'This password reset link is invalid or incomplete.',
      );
    }
  }

  submit() {
    if (!this.token || this.isLoading()) return;
    if (this.newPassword.length < 8) {
      this.errorMessage.set('Password must be at least 8 characters.');
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.errorMessage.set('The two passwords do not match.');
      return;
    }
    this.isLoading.set(true);
    this.errorMessage.set('');
    this.authService.resetPassword(this.token, this.newPassword).subscribe({
      next: (response) => {
        this.isLoading.set(false);
        this.successMessage.set(response.message);
      },
      error: (error) => {
        this.isLoading.set(false);
        this.errorMessage.set(
          error?.error?.message || 'This reset link is expired or invalid.',
        );
      },
    });
  }
}

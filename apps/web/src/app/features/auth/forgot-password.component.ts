import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div
      class="min-h-[85vh] flex flex-col justify-center items-center px-4 py-12"
    >
      <div
        class="w-full max-w-md bg-[#121A2B] technical-border rounded p-8 shadow-2xl relative"
      >
        <div class="flex items-center gap-2 mb-6">
          <span class="material-symbols-outlined text-[#3B82F6]">key</span>
          <span
            class="font-['JetBrains_Mono'] text-xs uppercase text-[#3B82F6] tracking-widest font-semibold"
            >PASSWORD RECOVERY</span
          >
        </div>

        <h1 class="font-['Hanken_Grotesk'] text-2xl font-bold text-white mb-2">
          Reset Password
        </h1>
        <p class="font-['Inter'] text-sm text-[#d9c3af] mb-8">
          Enter your registered email address and we'll dispatch a secure
          recovery token.
        </p>

        @if (successMessage()) {
          <div
            class="mb-6 p-4 bg-[#006fc0]/20 border border-[#3B82F6]/40 rounded text-[#a1c9ff] text-xs font-['JetBrains_Mono'] flex items-center gap-2"
          >
            <span class="material-symbols-outlined text-sm">check_circle</span>
            {{ successMessage() }}
          </div>
        }

        @if (errorMessage()) {
          <div
            class="mb-6 p-4 bg-[#690005]/40 border border-[#ffb4ab]/30 rounded text-[#ffdad6] text-xs font-['JetBrains_Mono'] flex items-center gap-2"
          >
            <span class="material-symbols-outlined text-sm">error</span>
            {{ errorMessage() }}
          </div>
        }

        <form (ngSubmit)="onSubmit()" class="flex flex-col gap-5">
          <div>
            <label
              for="forgot-email"
              class="block font-['JetBrains_Mono'] text-xs text-[#d9c3af] uppercase tracking-wider mb-2"
              >Email Address</label
            >
            <input
              id="forgot-email"
              type="email"
              [(ngModel)]="email"
              name="email"
              required
              placeholder="name@company.com"
              class="w-full bg-[#040810] border border-[#1E293B] focus:border-[#3B82F6] focus:outline-none rounded px-4 py-3 text-sm text-white font-['Inter'] transition-colors"
            />
          </div>

          <button
            type="submit"
            [disabled]="isLoading()"
            class="w-full mt-2 font-['JetBrains_Mono'] text-xs uppercase tracking-wider text-[#040810] bg-[#3B82F6] py-3.5 rounded font-bold hover:bg-[#3B82F6]/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            @if (isLoading()) {
              <span class="material-symbols-outlined animate-spin text-sm"
                >progress_activity</span
              >
              Dispatching...
            } @else {
              <span>Dispatch Reset Link</span>
              <span class="material-symbols-outlined text-sm">send</span>
            }
          </button>
        </form>

        <p class="mt-8 text-center font-['Inter'] text-xs text-[#d9c3af]">
          Remember your password?
          <a
            routerLink="/auth/login"
            class="font-['JetBrains_Mono'] text-[#3B82F6] hover:underline font-semibold ml-1"
            >Sign In</a
          >
        </p>
      </div>
    </div>
  `,
})
export class ForgotPasswordComponent {
  private authService = inject(AuthService);

  email = '';
  isLoading = signal(false);
  successMessage = signal('');
  errorMessage = signal('');

  onSubmit() {
    if (!this.email) {
      this.errorMessage.set('Please enter your email address.');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    this.authService.forgotPassword(this.email).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        this.successMessage.set(res.message);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set(
          err.error?.message || 'Failed to request password reset.',
        );
      },
    });
  }
}

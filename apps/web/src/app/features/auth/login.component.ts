import {
  AfterViewInit,
  Component,
  ElementRef,
  NgZone,
  PLATFORM_ID,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

type GoogleCredentialResponse = { credential?: string };

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <section class="auth-page min-h-screen px-4 py-28 sm:px-6 lg:px-10">
      <div
        class="mx-auto grid w-full max-w-6xl overflow-hidden border border-[#2B3852] bg-[#0A1020] shadow-[0_32px_100px_rgba(0,0,0,.42)] lg:grid-cols-[1.08fr_.92fr]"
      >
        <div
          class="auth-brand-panel relative hidden min-h-[680px] overflow-hidden border-r border-[#2B3852] bg-[#101A31] p-12 lg:flex lg:flex-col lg:justify-between"
        >
          <div
            class="absolute inset-0 opacity-20"
            style="background-image:linear-gradient(rgba(96,165,250,.25) 1px,transparent 1px),linear-gradient(90deg,rgba(96,165,250,.25) 1px,transparent 1px);background-size:34px 34px"
          ></div>
          <div
            class="absolute -right-28 -top-28 h-80 w-80 rounded-full bg-[#2563EB]/20 blur-3xl"
          ></div>
          <div
            class="absolute -bottom-20 left-10 h-72 w-72 rounded-full bg-[#3B82F6]/15 blur-3xl"
          ></div>

          <div class="relative z-10">
            <a routerLink="/" class="inline-flex items-center gap-3 text-white">
              <span
                class="grid h-10 w-10 place-items-center border border-[#3B82F6] bg-[#3B82F6]/10 font-['JetBrains_Mono'] text-sm font-bold text-[#3B82F6]"
                >T_</span
              >
              <span class="font-['Hanken_Grotesk'] text-xl font-bold"
                >Technyks Academy</span
              >
            </a>
            <p class="mt-4 max-w-md text-sm leading-6 text-[#AFC0D9]">
              Engineering education built for professionals who want to ship
              reliable, production-ready software.
            </p>
          </div>

          <div class="relative z-10 my-10">
            <svg
              viewBox="0 0 620 360"
              class="w-full"
              role="img"
              aria-label="Connected learning architecture illustration"
            >
              <defs>
                <linearGradient id="panel" x1="0" x2="1">
                  <stop stop-color="#172554" />
                  <stop offset="1" stop-color="#1E3A8A" />
                </linearGradient>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="7" result="b" />
                  <feMerge>
                    <feMergeNode in="b" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <path
                d="M83 286L208 205L332 265L479 143"
                fill="none"
                stroke="#334B70"
                stroke-width="3"
                stroke-dasharray="8 9"
              />
              <rect
                x="54"
                y="195"
                width="175"
                height="112"
                fill="url(#panel)"
                stroke="#60A5FA"
              />
              <rect
                x="218"
                y="92"
                width="186"
                height="122"
                fill="#111C35"
                stroke="#60A5FA"
              />
              <rect
                x="405"
                y="181"
                width="157"
                height="104"
                fill="#111C35"
                stroke="#3B82F6"
              />
              <path
                d="M83 226h115M83 248h82M83 270h99"
                stroke="#75A6E8"
                stroke-width="8"
                opacity=".65"
              />
              <path
                d="M249 129h122M249 154h90M249 179h110"
                stroke="#93C5FD"
                stroke-width="8"
                opacity=".7"
              />
              <path
                d="M433 214h103M433 237h72M433 260h91"
                stroke="#60A5FA"
                stroke-width="8"
                opacity=".7"
              />
              <circle
                cx="208"
                cy="205"
                r="9"
                fill="#60A5FA"
                filter="url(#glow)"
              />
              <circle
                cx="332"
                cy="265"
                r="9"
                fill="#60A5FA"
                filter="url(#glow)"
              />
              <circle
                cx="479"
                cy="143"
                r="9"
                fill="#3B82F6"
                filter="url(#glow)"
              />
              <circle
                cx="100"
                cy="112"
                r="37"
                fill="#172554"
                stroke="#60A5FA"
              />
              <path
                d="M83 112l11 11 24-27"
                fill="none"
                stroke="#60A5FA"
                stroke-width="7"
              />
              <circle cx="501" cy="83" r="43" fill="#172554" stroke="#93C5FD" />
              <path
                d="M482 90h39M489 76h25M489 104h25"
                stroke="#BFDBFE"
                stroke-width="7"
              />
            </svg>
          </div>

          <div
            class="relative z-10 grid grid-cols-3 border border-[#2B3852] bg-[#080D18]/70"
          >
            <div class="p-4">
              <div class="font-['JetBrains_Mono'] text-lg font-bold text-white">
                81+
              </div>
              <div
                class="mt-1 text-[10px] uppercase tracking-wider text-[#8CA0BC]"
              >
                Lessons
              </div>
            </div>
            <div class="border-x border-[#2B3852] p-4">
              <div class="font-['JetBrains_Mono'] text-lg font-bold text-white">
                12
              </div>
              <div
                class="mt-1 text-[10px] uppercase tracking-wider text-[#8CA0BC]"
              >
                Modules
              </div>
            </div>
            <div class="p-4">
              <div class="font-['JetBrains_Mono'] text-lg font-bold text-white">
                24/7
              </div>
              <div
                class="mt-1 text-[10px] uppercase tracking-wider text-[#8CA0BC]"
              >
                Access
              </div>
            </div>
          </div>
        </div>

        <div
          class="flex min-h-[680px] items-center bg-[#F8FAFC] px-6 py-12 sm:px-12 lg:px-16"
        >
          <div class="w-full">
            <div
              class="mb-8 grid grid-cols-2 border border-[#CBD5E1] bg-[#EEF4FC] p-1"
              aria-label="Authentication mode"
            >
              <a
                routerLink="/auth/login"
                class="bg-[#2563EB] px-4 py-2.5 text-center font-['JetBrains_Mono'] text-[11px] font-bold uppercase tracking-wider !text-white"
                >Log in</a
              >
              <a
                routerLink="/auth/signup"
                class="px-4 py-2.5 text-center font-['JetBrains_Mono'] text-[11px] font-bold uppercase tracking-wider text-[#475569] transition-colors hover:bg-white hover:text-[#1D4ED8]"
                >Sign up</a
              >
            </div>
            <div class="mb-9">
              <span
                class="font-['JetBrains_Mono'] text-[11px] font-bold uppercase tracking-[.22em] text-[#2563EB]"
                >Secure learner access</span
              >
              <h1
                class="mt-3 font-['Hanken_Grotesk'] text-4xl font-bold tracking-tight text-[#111827]"
              >
                Welcome back.
              </h1>
              <p class="mt-3 text-sm leading-6 text-[#5D6B82]">
                Sign in to continue your courses, track progress, and access
                your certificates.
              </p>
            </div>

            @if (errorMessage()) {
              <div
                class="mb-5 flex items-start gap-2 border border-[#FCA5A5] bg-[#FEF2F2] p-3 text-xs text-[#991B1B]"
              >
                <span class="material-symbols-outlined text-base">error</span
                ><span>{{ errorMessage() }}</span>
              </div>
            }

            <form (ngSubmit)="onLogin()" class="space-y-5">
              <label class="block">
                <span
                  class="mb-2 block font-['JetBrains_Mono'] text-[11px] font-bold uppercase tracking-wider text-[#344054]"
                  >Work or personal email</span
                >
                <div class="relative">
                  <span
                    class="material-symbols-outlined absolute left-4 top-3.5 text-lg text-[#7C899D]"
                    >mail</span
                  ><input
                    type="email"
                    [(ngModel)]="email"
                    name="email"
                    required
                    autocomplete="email"
                    placeholder="name@company.com"
                    class="h-12 w-full border border-[#CBD5E1] bg-white pl-11 pr-4 text-sm text-[#111827] outline-none transition-colors placeholder:text-[#98A2B3] focus:border-[#2563EB]"
                  />
                </div>
              </label>
              <label class="block">
                <div class="mb-2 flex items-center justify-between">
                  <span
                    class="font-['JetBrains_Mono'] text-[11px] font-bold uppercase tracking-wider text-[#344054]"
                    >Password</span
                  ><a
                    routerLink="/auth/forgot-password"
                    class="text-xs font-semibold text-[#2563EB] hover:underline"
                    >Forgot password?</a
                  >
                </div>
                <div class="relative">
                  <span
                    class="material-symbols-outlined absolute left-4 top-3.5 text-lg text-[#7C899D]"
                    >lock</span
                  ><input
                    [type]="showPassword() ? 'text' : 'password'"
                    [(ngModel)]="password"
                    name="password"
                    required
                    autocomplete="current-password"
                    placeholder="Enter your password"
                    class="h-12 w-full border border-[#CBD5E1] bg-white pl-11 pr-12 text-sm text-[#111827] outline-none transition-colors placeholder:text-[#98A2B3] focus:border-[#2563EB]"
                  /><button
                    type="button"
                    (click)="showPassword.set(!showPassword())"
                    class="absolute right-3 top-2.5 grid h-8 w-8 place-items-center text-[#64748B]"
                    [attr.aria-label]="
                      showPassword() ? 'Hide password' : 'Show password'
                    "
                  >
                    <span class="material-symbols-outlined text-lg">{{
                      showPassword() ? 'visibility_off' : 'visibility'
                    }}</span>
                  </button>
                </div>
              </label>
              <button
                type="submit"
                [disabled]="isLoading()"
                class="flex h-12 w-full items-center justify-center gap-2 border border-[#1D4ED8] bg-[#2563EB] font-['JetBrains_Mono'] text-xs font-bold uppercase tracking-wider !text-white transition-colors hover:bg-[#1D4ED8] disabled:cursor-wait disabled:opacity-60"
              >
                @if (isLoading()) {
                  <span class="material-symbols-outlined animate-spin text-base"
                    >progress_activity</span
                  >
                  Signing in…
                } @else {
                  Continue to academy
                  <span class="material-symbols-outlined text-base"
                    >arrow_forward</span
                  >
                }
              </button>
            </form>

            <div class="my-6 flex items-center gap-3">
              <div class="h-px flex-1 bg-[#DCE3EC]"></div>
              <span
                class="font-['JetBrains_Mono'] text-[10px] uppercase tracking-widest text-[#7C899D]"
                >or continue with</span
              >
              <div class="h-px flex-1 bg-[#DCE3EC]"></div>
            </div>
            <div
              class="relative min-h-11 w-full border border-[#CBD5E1] bg-white p-1"
            >
              <div
                #googleButton
                class="flex min-h-9 w-full items-center justify-center"
              ></div>
              @if (googleLoading()) {
                <div
                  class="absolute inset-0 grid place-items-center bg-white/90"
                >
                  <span
                    class="material-symbols-outlined animate-spin text-xl text-[#2563EB]"
                    >progress_activity</span
                  >
                </div>
              }
            </div>
            @if (googleSetupMessage()) {
              <p class="mt-2 text-center text-[11px] text-[#B42318]">
                {{ googleSetupMessage() }}
              </p>
            }
            <p class="mt-8 text-center text-xs text-[#5D6B82]">
              New to Technyks Academy?
              <a
                routerLink="/auth/signup"
                class="font-bold text-[#2563EB] hover:underline"
                >Create your account</a
              >
            </p>
            <p class="mt-8 text-center text-[10px] leading-5 text-[#7C899D]">
              By continuing, you agree to the Technyks Academy Terms and Privacy
              Policy.
            </p>
          </div>
        </div>
      </div>
    </section>
  `,
  styles: [
    `
      .auth-page {
        background:
          radial-gradient(
            circle at 12% 18%,
            rgba(37, 99, 235, 0.14),
            transparent 30%
          ),
          radial-gradient(
            circle at 88% 80%,
            rgba(59, 130, 246, 0.12),
            transparent 28%
          ),
          #070b13;
      }
      :host ::ng-deep .light-theme .auth-page {
        background:
          radial-gradient(
            circle at 12% 18%,
            rgba(37, 99, 235, 0.12),
            transparent 30%
          ),
          radial-gradient(
            circle at 88% 80%,
            rgba(59, 130, 246, 0.1),
            transparent 28%
          ),
          #edf2f8 !important;
      }
    `,
  ],
})
export class LoginComponent implements AfterViewInit {
  @ViewChild('googleButton') googleButton?: ElementRef<HTMLDivElement>;
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private zone = inject(NgZone);
  private platformId = inject(PLATFORM_ID);

  email = '';
  password = '';
  isLoading = signal(false);
  googleLoading = signal(false);
  showPassword = signal(false);
  errorMessage = signal(
    this.isExpiredRedirect() ? 'Your session has expired. Please sign in again.' : '',
  );

  private isExpiredRedirect() {
    try {
      return new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search).get('expired') === '1';
    } catch {
      return false;
    }
  }
  googleSetupMessage = signal('');

  ngAfterViewInit() {
    if (!isPlatformBrowser(this.platformId)) return;
    this.authService.getPublicAuthConfig().subscribe({
      next: ({ googleClientId }) => {
        if (!googleClientId) {
          this.googleSetupMessage.set(
            'Google sign-in is temporarily unavailable.',
          );
          return;
        }
        this.loadGoogleIdentity()
          .then(() => this.renderGoogleButton(googleClientId))
          .catch(() =>
            this.googleSetupMessage.set(
              'Google sign-in could not be loaded. Please use email and password.',
            ),
          );
      },
      error: () =>
        this.googleSetupMessage.set(
          'Google sign-in is temporarily unavailable.',
        ),
    });
  }

  onLogin() {
    if (!this.email || !this.password) {
      this.errorMessage.set('Enter your email address and password.');
      return;
    }
    this.isLoading.set(true);
    this.errorMessage.set('');
    this.authService
      .login({ email: this.email, password: this.password })
      .subscribe({
        next: () => this.finishLogin(),
        error: (error) => {
          this.isLoading.set(false);
          this.errorMessage.set(
            error?.error?.message ||
              'Sign-in failed. Check your credentials and try again.',
          );
        },
      });
  }

  private renderGoogleButton(clientId: string) {
    const google = (window as any).google;
    const container = this.googleButton?.nativeElement;
    if (!google?.accounts?.id || !container)
      throw new Error('Google Identity Services unavailable');
    google.accounts.id.initialize({
      client_id: clientId,
      callback: (response: GoogleCredentialResponse) =>
        this.zone.run(() => this.handleGoogleCredential(response)),
    });
    google.accounts.id.renderButton(container, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'continue_with',
      shape: 'rectangular',
      logo_alignment: 'left',
      width: Math.max(280, Math.floor(container.clientWidth - 8)),
    });
  }

  private handleGoogleCredential(response: GoogleCredentialResponse) {
    if (!response.credential) {
      this.errorMessage.set(
        'Google did not return a valid sign-in credential.',
      );
      return;
    }
    this.googleLoading.set(true);
    this.errorMessage.set('');
    this.authService.loginWithGoogle(response.credential).subscribe({
      next: () => this.finishLogin(),
      error: (error) => {
        this.googleLoading.set(false);
        this.errorMessage.set(
          error?.error?.message || 'Google sign-in failed. Please try again.',
        );
      },
    });
  }

  private finishLogin() {
    this.isLoading.set(false);
    this.googleLoading.set(false);
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    const destination = returnUrl?.startsWith('/') ? returnUrl : '/dashboard';
    if (this.authService.needsOnboarding()) {
      this.router.navigate(['/onboarding'], {
        queryParams: { returnUrl: destination },
      });
      return;
    }
    this.router.navigateByUrl(destination);
  }

  private loadGoogleIdentity(): Promise<void> {
    if ((window as any).google?.accounts?.id) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>(
        'script[data-google-identity]',
      );
      if (existing) {
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => reject(), { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.dataset['googleIdentity'] = 'true';
      script.onload = () => resolve();
      script.onerror = () => reject();
      document.head.appendChild(script);
    });
  }
}

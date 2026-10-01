import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Title } from '@angular/platform-browser';
import {
  Account,
  AccountService,
  ProfileChanges,
  Purchase,
  squareJpeg,
} from '../../core/services/account.service';
import { UserAvatarComponent } from '../../core/components/user-avatar/user-avatar.component';
import { LocalPricePipe } from '../../core/pipes/local-price.pipe';

type Section = 'profile' | 'photo' | 'security' | 'notifications' | 'purchases';

const SECTIONS: { id: Section; label: string; icon: string; title: string; subtitle: string }[] = [
  { id: 'profile', label: 'Public profile', icon: 'person', title: 'Public profile', subtitle: 'Add information about yourself' },
  { id: 'photo', label: 'Photo', icon: 'photo_camera', title: 'Photo', subtitle: 'Add a nice photo of yourself for your profile' },
  { id: 'security', label: 'Account security', icon: 'lock', title: 'Account', subtitle: 'Edit your account settings and change your password here' },
  { id: 'notifications', label: 'Notification preferences', icon: 'notifications', title: 'Notification preferences', subtitle: 'Choose which emails you get from us' },
  { id: 'purchases', label: 'Purchase history', icon: 'receipt_long', title: 'Purchase history', subtitle: 'Your courses, templates and memberships' },
];

/** Udemy-style account settings: profile, photo, security, emails, purchases. */
@Component({
  selector: 'app-account-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, UserAvatarComponent, LocalPricePipe],
  styles: [
    `
      .field {
        width: 100%;
        border-radius: 0.5rem;
        border: 1px solid rgb(203 213 225);
        background: #fff;
        padding: 0.65rem 0.85rem;
        font-size: 0.9rem;
        color: #0f172a;
        outline: none;
      }
      .field:focus {
        border-color: #2563eb;
        box-shadow: 0 0 0 3px rgb(37 99 235 / 0.15);
      }
      .field:disabled {
        background: #f1f5f9;
        color: #64748b;
      }
      :host-context(.dark) .field {
        background: #0b1220;
        border-color: rgb(255 255 255 / 0.15);
        color: #f8fafc;
      }
      :host-context(.dark) .field:disabled {
        background: #111827;
        color: #94a3b8;
      }
      .label {
        display: block;
        font-size: 0.8rem;
        font-weight: 700;
        margin-bottom: 0.35rem;
      }
    `,
  ],
  template: `
    <div class="mx-auto max-w-6xl px-4 pb-20 pt-10 sm:px-6">
      <div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#0f172a] md:grid md:grid-cols-[260px_minmax(0,1fr)]">
        <!-- Sidebar -->
        <aside class="border-b border-slate-200 p-6 dark:border-white/10 md:border-b-0 md:border-r">
          <div class="flex flex-col items-center text-center">
            <app-user-avatar [name]="account()?.name" [src]="account()?.avatarUrl" [size]="112" />
            <p class="mt-3 text-base font-bold text-slate-950 dark:text-white">{{ account()?.name || ' ' }}</p>
            @if (account()?.headline) {
              <p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{{ account()?.headline }}</p>
            }
          </div>
          <nav class="mt-6 flex gap-1 overflow-x-auto md:flex-col md:overflow-visible" aria-label="Account settings">
            @for (item of sections; track item.id) {
              <a
                [routerLink]="['/account', item.id]"
                class="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm"
                [ngClass]="section() === item.id ? activeNav : inactiveNav"
                [attr.aria-current]="section() === item.id ? 'page' : null"
              >
                <span class="material-symbols-outlined text-[18px]">{{ item.icon }}</span>
                {{ item.label }}
              </a>
            }
            <a routerLink="/dashboard" class="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5">
              <span class="material-symbols-outlined text-[18px]">school</span>
              My learning
            </a>
          </nav>
        </aside>

        <!-- Content -->
        <section class="min-w-0">
          <header class="border-b border-slate-200 px-6 py-6 text-center dark:border-white/10">
            <h1 class="text-2xl font-bold text-slate-950 dark:text-white">{{ current().title }}</h1>
            <p class="mt-1 text-sm text-slate-600 dark:text-slate-400">{{ current().subtitle }}</p>
          </header>

          <div class="px-6 py-8 sm:px-10">
            @if (loadError()) {
              <p class="rounded-lg !bg-rose-50 px-4 py-3 text-sm !text-rose-700" role="alert">{{ loadError() }}</p>
            } @else if (!account()) {
              <p class="text-sm text-slate-500" role="status">Loading your account…</p>
            } @else {
              @if (message()) {
                <p class="mb-6 rounded-lg px-4 py-3 text-sm" [class.!bg-emerald-50]="!isError()" [class.!text-emerald-800]="!isError()" [class.!bg-rose-50]="isError()" [class.!text-rose-700]="isError()" role="status">
                  {{ message() }}
                </p>
              }

              @switch (section()) {
                @case ('profile') {
                  <form class="mx-auto flex max-w-2xl flex-col gap-6" (ngSubmit)="saveProfile()">
                    <fieldset class="flex flex-col gap-4">
                      <legend class="mb-3 text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Basics</legend>
                      <div>
                        <label class="label text-slate-800 dark:text-slate-200" for="name">Full name</label>
                        <input id="name" name="name" class="field" [(ngModel)]="profile.name" maxlength="80" required autocomplete="name" />
                        <p class="mt-1 text-xs text-slate-500">Shown on your certificates, reviews and questions.</p>
                      </div>
                      <div>
                        <label class="label text-slate-800 dark:text-slate-200" for="headline">Headline</label>
                        <div class="relative">
                          <input id="headline" name="headline" class="field pr-12" [(ngModel)]="profile.headline" maxlength="60" placeholder="e.g. Frontend developer at Technyks" />
                          <span class="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">{{ 60 - (profile.headline || '').length }}</span>
                        </div>
                      </div>
                      <div>
                        <label class="label text-slate-800 dark:text-slate-200" for="bio">Biography</label>
                        <textarea id="bio" name="bio" class="field min-h-32" [(ngModel)]="profile.bio" maxlength="2000" placeholder="Tell other learners a little about yourself."></textarea>
                      </div>
                    </fieldset>

                    <fieldset class="flex flex-col gap-4">
                      <legend class="mb-3 text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Links</legend>
                      @for (link of links; track link.field) {
                        <div>
                          <label class="label text-slate-800 dark:text-slate-200" [for]="link.field">{{ link.label }}</label>
                          <input [id]="link.field" [name]="link.field" class="field" type="url" inputmode="url" [(ngModel)]="profile[link.field]" [placeholder]="link.placeholder" />
                        </div>
                      }
                    </fieldset>

                    <div>
                      <button type="submit" [disabled]="busy()" class="rounded-lg !bg-slate-900 px-6 py-3 text-sm font-bold !text-white hover:!bg-slate-700 disabled:opacity-60 dark:!bg-white dark:!text-slate-900">
                        {{ busy() ? 'Saving…' : 'Save' }}
                      </button>
                    </div>
                  </form>
                }

                @case ('photo') {
                  <div class="mx-auto flex max-w-xl flex-col gap-6">
                    <div>
                      <p class="label text-slate-800 dark:text-slate-200">Image preview</p>
                      <div class="flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50 py-8 dark:border-white/10 dark:bg-white/5">
                        @if (photoPreview()) {
                          <img [src]="photoPreview()" alt="New profile photo preview" class="h-44 w-44 rounded-full object-cover" />
                        } @else {
                          <app-user-avatar [name]="account()!.name" [src]="account()!.avatarUrl" [size]="176" />
                        }
                      </div>
                      <p class="mt-2 text-xs text-slate-500">
                        JPG, PNG or WebP. We crop it to a square, so keep your face in the middle.
                        @if (account()!.googleLinked) {
                          Without a photo, your Google picture is used when you sign in with Google, otherwise your initials.
                        }
                      </p>
                    </div>
                    <div class="flex flex-wrap items-center gap-3">
                      <label class="cursor-pointer rounded-lg border border-slate-300 px-5 py-3 text-sm font-bold text-slate-800 hover:border-slate-900 dark:border-white/20 dark:text-slate-100">
                        Choose image
                        <input type="file" accept="image/jpeg,image/png,image/webp" class="sr-only" (change)="choosePhoto($event)" />
                      </label>
                      @if (photoBlob()) {
                        <button type="button" (click)="savePhoto()" [disabled]="busy()" class="rounded-lg !bg-slate-900 px-6 py-3 text-sm font-bold !text-white hover:!bg-slate-700 disabled:opacity-60 dark:!bg-white dark:!text-slate-900">
                          {{ busy() ? 'Uploading…' : 'Save photo' }}
                        </button>
                        <button type="button" (click)="cancelPhoto()" class="text-sm font-bold text-slate-600 underline dark:text-slate-300">Cancel</button>
                      } @else if (account()!.avatarUrl) {
                        <button type="button" (click)="removePhoto()" [disabled]="busy()" class="text-sm font-bold !text-rose-600 underline disabled:opacity-60">Remove photo</button>
                      }
                    </div>
                  </div>
                }

                @case ('security') {
                  <div class="mx-auto flex max-w-xl flex-col gap-8">
                    <div>
                      <label class="label text-slate-800 dark:text-slate-200" for="email">Email</label>
                      <input id="email" class="field" [value]="account()!.email" disabled />
                      @if (account()!.googleLinked) {
                        <p class="mt-2 inline-flex items-center gap-1.5 rounded-full !bg-slate-100 px-3 py-1 text-xs font-bold !text-slate-700">
                          <span class="material-symbols-outlined text-sm">link</span> Google sign-in connected
                        </p>
                      }
                    </div>

                    <form class="flex flex-col gap-4 border-t border-slate-200 pt-6 dark:border-white/10" (ngSubmit)="savePassword()">
                      <h2 class="text-base font-bold text-slate-950 dark:text-white">
                        {{ account()!.hasPassword ? 'Change password' : 'Create a password' }}
                      </h2>
                      @if (!account()!.hasPassword) {
                        <p class="text-sm text-slate-600 dark:text-slate-400">You sign in with Google. Add a password to also log in with your email.</p>
                      }
                      @if (account()!.hasPassword) {
                        <input class="field" type="password" name="currentPassword" [(ngModel)]="password.current" placeholder="Current password" autocomplete="current-password" required />
                      }
                      <input class="field" type="password" name="newPassword" [(ngModel)]="password.next" placeholder="New password (at least 8 characters)" autocomplete="new-password" minlength="8" required />
                      <input class="field" type="password" name="confirmPassword" [(ngModel)]="password.confirm" placeholder="Re-type new password" autocomplete="new-password" required />
                      <div>
                        <button type="submit" [disabled]="busy()" class="rounded-lg !bg-slate-900 px-6 py-3 text-sm font-bold !text-white hover:!bg-slate-700 disabled:opacity-60 dark:!bg-white dark:!text-slate-900">
                          {{ busy() ? 'Saving…' : (account()!.hasPassword ? 'Change password' : 'Create password') }}
                        </button>
                      </div>
                    </form>
                  </div>
                }

                @case ('notifications') {
                  <div class="mx-auto flex max-w-xl flex-col gap-4">
                    <label class="flex cursor-pointer items-start justify-between gap-4 rounded-lg border border-slate-200 p-4 dark:border-white/10">
                      <span>
                        <span class="block text-sm font-bold text-slate-950 dark:text-white">Course announcements</span>
                        <span class="mt-1 block text-xs text-slate-600 dark:text-slate-400">Emails when an instructor posts news or new lessons in courses you're enrolled in.</span>
                      </span>
                      <input type="checkbox" class="mt-1 h-5 w-5 accent-blue-600" [checked]="account()!.emailAnnouncements" (change)="toggleAnnouncements($event)" [disabled]="busy()" />
                    </label>
                    <div class="rounded-lg !bg-slate-50 p-4 text-xs !text-slate-600 dark:!bg-white/5 dark:!text-slate-400">
                      Account emails — password resets, receipts and certificates — are always sent, because they're about your account.
                    </div>
                  </div>
                }

                @case ('purchases') {
                  @if (purchases() === null) {
                    <p class="text-sm text-slate-500" role="status">Loading purchases…</p>
                  } @else if (!purchases()!.length) {
                    <div class="py-10 text-center">
                      <span class="material-symbols-outlined text-5xl text-slate-300">shopping_bag</span>
                      <p class="mt-2 text-sm text-slate-600 dark:text-slate-400">You haven't bought anything yet.</p>
                      <a routerLink="/courses" class="mt-4 inline-block rounded-lg !bg-slate-900 px-5 py-2.5 text-sm font-bold !text-white dark:!bg-white dark:!text-slate-900">Browse courses</a>
                    </div>
                  } @else {
                    <div class="overflow-x-auto">
                      <table class="w-full min-w-[560px] text-left text-sm">
                        <thead>
                          <tr class="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500 dark:border-white/10">
                            <th class="py-3 pr-4 font-bold">Item</th>
                            <th class="py-3 pr-4 font-bold">Date</th>
                            <th class="py-3 pr-4 font-bold">Total</th>
                            <th class="py-3 font-bold">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          @for (purchase of purchases(); track purchase.id) {
                            <tr class="border-b border-slate-100 align-top dark:border-white/5">
                              <td class="py-4 pr-4">
                                @for (item of purchase.items; track $index) {
                                  <div class="flex items-center gap-2 text-slate-900 dark:text-slate-100">
                                    <span class="material-symbols-outlined text-base text-slate-400">{{ itemIcon(item.type) }}</span>
                                    @if (item.slug) {
                                      <a [routerLink]="itemLink(item)" class="font-semibold hover:underline">{{ item.title }}</a>
                                    } @else {
                                      <span class="font-semibold">{{ item.title }}</span>
                                    }
                                  </div>
                                }
                                @if (purchase.couponCode) {
                                  <p class="mt-1 text-xs text-slate-500">Coupon {{ purchase.couponCode }}</p>
                                }
                              </td>
                              <td class="whitespace-nowrap py-4 pr-4 text-slate-600 dark:text-slate-400">{{ purchase.date | date: 'd MMM y' }}</td>
                              <td class="whitespace-nowrap py-4 pr-4 font-semibold text-slate-900 dark:text-slate-100">
                                {{ purchase.amount === 0 ? 'Free' : (purchase.amount | localPrice: purchase.currency) }}
                              </td>
                              <td class="py-4">
                                <span class="rounded-full px-2.5 py-1 text-xs font-bold" [class.!bg-emerald-100]="purchase.status === 'SUCCESS'" [class.!text-emerald-800]="purchase.status === 'SUCCESS'" [class.!bg-amber-100]="purchase.status === 'REFUNDED'" [class.!text-amber-800]="purchase.status === 'REFUNDED'">
                                  {{ purchase.status === 'SUCCESS' ? 'Paid' : 'Refunded' }}
                                </span>
                              </td>
                            </tr>
                          }
                        </tbody>
                      </table>
                    </div>
                  }
                }
              }
            }
          </div>
        </section>
      </div>
    </div>
  `,
})
export class AccountSettingsComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly accounts = inject(AccountService);
  private readonly title = inject(Title);

  readonly sections = SECTIONS;
  readonly activeNav = 'font-bold !bg-slate-900 !text-white dark:!bg-white dark:!text-slate-900';
  readonly inactiveNav = 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5';
  readonly links: { field: keyof ProfileChanges; label: string; placeholder: string }[] = [
    { field: 'websiteUrl', label: 'Website', placeholder: 'https://yourwebsite.com' },
    { field: 'linkedinUrl', label: 'LinkedIn', placeholder: 'https://linkedin.com/in/your-name' },
    { field: 'githubUrl', label: 'GitHub', placeholder: 'https://github.com/your-name' },
    { field: 'twitterUrl', label: 'X (Twitter)', placeholder: 'https://x.com/your-name' },
    { field: 'youtubeUrl', label: 'YouTube', placeholder: 'https://youtube.com/@your-channel' },
  ];

  readonly section = signal<Section>('profile');
  readonly current = computed(() => SECTIONS.find((item) => item.id === this.section()) || SECTIONS[0]);
  readonly account = signal<Account | null>(null);
  readonly loadError = signal('');
  readonly busy = signal(false);
  readonly message = signal('');
  readonly isError = signal(false);
  readonly purchases = signal<Purchase[] | null>(null);
  readonly photoBlob = signal<Blob | null>(null);
  readonly photoPreview = signal<string | null>(null);

  profile: ProfileChanges = {};
  password = { current: '', next: '', confirm: '' };

  ngOnInit() {
    this.route.paramMap.subscribe((params) => {
      const requested = params.get('section') as Section;
      this.section.set(SECTIONS.some((item) => item.id === requested) ? requested : 'profile');
      this.message.set('');
      this.title.setTitle(`${this.current().label} | Technyks Academy`);
      if (this.section() === 'purchases' && this.purchases() === null) this.loadPurchases();
    });
    this.accounts.get().subscribe({
      next: (account) => this.setAccount(account),
      error: () => this.loadError.set('Your account could not be loaded. Please refresh the page.'),
    });
  }

  saveProfile() {
    this.run(this.accounts.updateProfile(this.profile), 'Your profile has been saved.');
  }

  async choosePhoto(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      return this.notify('Choose a JPG, PNG or WebP image.', true);
    }
    if (file.size > 15 * 1024 * 1024) return this.notify('That image is larger than 15 MB.', true);
    try {
      const blob = await squareJpeg(file);
      this.clearPreview();
      this.photoBlob.set(blob);
      this.photoPreview.set(URL.createObjectURL(blob));
      this.message.set('');
    } catch {
      this.notify('That image could not be read. Try another one.', true);
    }
  }

  savePhoto() {
    const blob = this.photoBlob();
    if (!blob) return;
    this.run(this.accounts.uploadAvatar(blob), 'Your new photo has been saved.', () => this.cancelPhoto());
  }

  cancelPhoto() {
    this.clearPreview();
    this.photoBlob.set(null);
  }

  removePhoto() {
    this.run(this.accounts.removeAvatar(), 'Your photo has been removed.');
  }

  savePassword() {
    const { current, next, confirm } = this.password;
    if (next.length < 8) return this.notify('New password must be at least 8 characters.', true);
    if (next !== confirm) return this.notify('The new passwords do not match.', true);
    this.busy.set(true);
    this.accounts
      .changePassword({ currentPassword: current || undefined, newPassword: next })
      .subscribe({
        next: ({ message }) => {
          this.busy.set(false);
          this.password = { current: '', next: '', confirm: '' };
          const account = this.account();
          if (account) this.account.set({ ...account, hasPassword: true });
          this.notify(message, false);
        },
        error: (error) => {
          this.busy.set(false);
          this.notify(error?.error?.message || 'Your password could not be changed.', true);
        },
      });
  }

  toggleAnnouncements(event: Event) {
    const emailAnnouncements = (event.target as HTMLInputElement).checked;
    this.run(
      this.accounts.updateNotifications({ emailAnnouncements }),
      emailAnnouncements ? 'You will receive course announcement emails.' : 'Course announcement emails are turned off.',
    );
  }

  itemIcon(type: string) {
    return type === 'TEMPLATE' ? 'web' : type === 'MEMBERSHIP' ? 'card_membership' : 'play_circle';
  }

  itemLink(item: { type: string; slug?: string }) {
    return item.type === 'TEMPLATE' ? ['/templates', item.slug] : ['/courses', item.slug];
  }

  private loadPurchases() {
    this.accounts.purchases().subscribe({
      next: (items) => this.purchases.set(items),
      error: () => {
        this.purchases.set([]);
        this.notify('Your purchase history could not be loaded.', true);
      },
    });
  }

  private run(request: ReturnType<AccountService['get']>, success: string, after?: () => void) {
    this.busy.set(true);
    this.message.set('');
    request.subscribe({
      next: (account) => {
        this.busy.set(false);
        this.setAccount(account);
        after?.();
        this.notify(success, false);
      },
      error: (error) => {
        this.busy.set(false);
        const detail = error?.error?.message;
        this.notify(Array.isArray(detail) ? detail.join(' ') : detail || 'Something went wrong. Please try again.', true);
      },
    });
  }

  private setAccount(account: Account) {
    this.account.set(account);
    this.profile = {
      name: account.name,
      headline: account.headline,
      bio: account.bio,
      websiteUrl: account.websiteUrl,
      linkedinUrl: account.linkedinUrl,
      githubUrl: account.githubUrl,
      twitterUrl: account.twitterUrl,
      youtubeUrl: account.youtubeUrl,
    };
  }

  private notify(text: string, isError: boolean) {
    this.isError.set(isError);
    this.message.set(text);
  }

  private clearPreview() {
    const url = this.photoPreview();
    if (url) URL.revokeObjectURL(url);
    this.photoPreview.set(null);
  }
}

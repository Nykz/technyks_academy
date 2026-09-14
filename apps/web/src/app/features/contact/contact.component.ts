import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ContactService } from '../../core/services/contact.service';

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="contact-shell px-6 md:px-16 pt-24 pb-20">
      <section class="contact-hero max-w-5xl mx-auto text-center mb-12">
        <span
          class="contact-kicker font-['JetBrains_Mono'] text-xs uppercase tracking-widest"
        >
          SUPPORT DESK
        </span>
        <h1
          class="contact-heading font-['Hanken_Grotesk'] text-4xl md:text-6xl font-bold mt-4"
        >
          Let’s build your next breakthrough.
        </h1>
        <p
          class="contact-lead font-['Inter'] text-base md:text-lg max-w-2xl mx-auto mt-5"
        >
          Have a question about a course, membership, billing, or your learning
          journey? Send us a message and the Technyks Academy team will get back
          to you.
        </p>
      </section>

      <section
        class="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[.8fr_1.2fr] gap-8 items-start"
      >
        <aside class="contact-card rounded-2xl p-7 md:p-8">
          <span class="material-symbols-outlined contact-icon text-3xl"
            >support_agent</span
          >
          <h2
            class="contact-card-heading font-['Hanken_Grotesk'] text-2xl font-bold mt-5"
          >
            How can we help?
          </h2>
          <p class="contact-muted font-['Inter'] text-sm leading-relaxed mt-3">
            Tell us what you are trying to do. Include the course name or your
            account email when it helps us solve the issue faster.
          </p>

          <div class="mt-8 flex flex-col gap-5">
            <div class="contact-info-item flex items-start gap-3">
              <span class="material-symbols-outlined contact-accent text-xl"
                >school</span
              >
              <div>
                <p
                  class="contact-label font-['JetBrains_Mono'] text-[11px] uppercase tracking-wider"
                >
                  Course support
                </p>
                <p class="contact-muted font-['Inter'] text-sm mt-1">
                  Curriculum, access, previews, and progress
                </p>
              </div>
            </div>
            <div class="contact-info-item flex items-start gap-3">
              <span class="material-symbols-outlined contact-accent text-xl"
                >workspace_premium</span
              >
              <div>
                <p
                  class="contact-label font-['JetBrains_Mono'] text-[11px] uppercase tracking-wider"
                >
                  Membership
                </p>
                <p class="contact-muted font-['Inter'] text-sm mt-1">
                  Plans, billing, and account questions
                </p>
              </div>
            </div>
            <div class="contact-info-item flex items-start gap-3">
              <span class="material-symbols-outlined contact-accent text-xl"
                >schedule</span
              >
              <div>
                <p
                  class="contact-label font-['JetBrains_Mono'] text-[11px] uppercase tracking-wider"
                >
                  Response time
                </p>
                <p class="contact-muted font-['Inter'] text-sm mt-1">
                  Usually within 1–2 business days
                </p>
              </div>
            </div>
          </div>

          <a
            routerLink="/courses"
            class="contact-secondary-button inline-flex items-center gap-2 font-['JetBrains_Mono'] text-xs uppercase font-bold mt-9"
          >
            Browse courses
            <span class="material-symbols-outlined text-base"
              >arrow_forward</span
            >
          </a>
        </aside>

        <form
          class="contact-card rounded-2xl p-7 md:p-8"
          (ngSubmit)="submitMessage()"
          #contactForm="ngForm"
          novalidate
        >
          <div class="flex flex-col gap-5">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <label
                class="contact-field flex flex-col gap-2"
                for="contact-name"
              >
                <span
                  class="contact-label font-['JetBrains_Mono'] text-xs uppercase tracking-wider"
                  >Your name</span
                >
                <input
                  id="contact-name"
                  name="name"
                  type="text"
                  [(ngModel)]="name"
                  required
                  minlength="2"
                  maxlength="100"
                  autocomplete="name"
                  class="contact-input rounded-lg px-4 py-3 font-['Inter'] text-sm"
                  placeholder="Your full name"
                />
              </label>
              <label
                class="contact-field flex flex-col gap-2"
                for="contact-email"
              >
                <span
                  class="contact-label font-['JetBrains_Mono'] text-xs uppercase tracking-wider"
                  >Email address</span
                >
                <input
                  id="contact-email"
                  name="email"
                  type="email"
                  [(ngModel)]="email"
                  required
                  maxlength="254"
                  autocomplete="email"
                  class="contact-input rounded-lg px-4 py-3 font-['Inter'] text-sm"
                  placeholder="you@example.com"
                />
              </label>
            </div>

            <label
              class="contact-field flex flex-col gap-2"
              for="contact-subject"
            >
              <span
                class="contact-label font-['JetBrains_Mono'] text-xs uppercase tracking-wider"
                >Subject</span
              >
              <input
                id="contact-subject"
                name="subject"
                type="text"
                [(ngModel)]="subject"
                required
                minlength="3"
                maxlength="160"
                class="contact-input rounded-lg px-4 py-3 font-['Inter'] text-sm"
                placeholder="How can we help?"
              />
            </label>

            <label
              class="contact-field flex flex-col gap-2"
              for="contact-message"
            >
              <span
                class="contact-label font-['JetBrains_Mono'] text-xs uppercase tracking-wider"
                >Message</span
              >
              <textarea
                id="contact-message"
                name="message"
                [(ngModel)]="message"
                required
                minlength="10"
                maxlength="4000"
                rows="7"
                class="contact-input resize-y rounded-lg px-4 py-3 font-['Inter'] text-sm leading-relaxed"
                placeholder="Tell us a little more about what you need..."
              ></textarea>
              <span class="contact-muted font-['Inter'] text-xs text-right"
                >{{ message.length }}/4000</span
              >
            </label>

            @if (errorMessage()) {
              <p
                class="contact-error rounded-lg px-4 py-3 font-['Inter'] text-sm"
                role="alert"
              >
                {{ errorMessage() }}
              </p>
            }
            @if (successMessage()) {
              <p
                class="contact-success rounded-lg px-4 py-3 font-['Inter'] text-sm"
                role="status"
              >
                {{ successMessage() }}
              </p>
            }

            <button
              type="submit"
              [disabled]="isSubmitting() || contactForm.invalid"
              class="contact-submit inline-flex justify-center items-center gap-2 rounded-lg px-5 py-3.5 font-['JetBrains_Mono'] text-xs uppercase tracking-wider font-bold disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span class="material-symbols-outlined text-base">{{
                isSubmitting() ? 'progress_activity' : 'send'
              }}</span>
              {{ isSubmitting() ? 'Sending message...' : 'Send message' }}
            </button>
          </div>
        </form>
      </section>
    </div>
  `,
})
export class ContactComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly contactService = inject(ContactService);

  name = '';
  email = '';
  subject = '';
  message = '';
  isSubmitting = signal(false);
  successMessage = signal('');
  errorMessage = signal('');

  ngOnInit() {
    const user = this.authService.currentUser();
    if (user) {
      this.name = user.name;
      this.email = user.email;
    }
  }

  submitMessage() {
    this.successMessage.set('');
    this.errorMessage.set('');

    const payload = {
      name: this.name.trim(),
      email: this.email.trim(),
      subject: this.subject.trim(),
      message: this.message.trim(),
    };
    if (
      payload.name.length < 2 ||
      payload.subject.length < 3 ||
      payload.message.length < 10
    ) {
      this.errorMessage.set(
        'Please complete all fields. Your message must be at least 10 characters.',
      );
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
      this.errorMessage.set('Please enter a valid email address.');
      return;
    }

    this.isSubmitting.set(true);
    this.contactService.submitMessage(payload).subscribe({
      next: (response) => {
        this.isSubmitting.set(false);
        this.successMessage.set(
          response.message ||
            'Thanks — your message has been sent to the Technyks Academy team.',
        );
        this.subject = '';
        this.message = '';
      },
      error: (error) => {
        this.isSubmitting.set(false);
        this.errorMessage.set(
          error?.error?.message ||
            'We could not send your message right now. Please try again.',
        );
      },
    });
  }
}

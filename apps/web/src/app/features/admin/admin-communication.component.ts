import { CommonModule } from '@angular/common';
import { Component, Input, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Course } from '../../core/services/courses.service';
import {
  CommunicationService,
  CourseAnnouncement,
  CourseQuestion,
  EmailConfiguration,
} from '../../core/services/communication.service';

@Component({
  selector: 'app-admin-communication',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="space-y-6">
      <div
        class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#26334B] dark:bg-[#101827] sm:p-7"
      >
        <div
          class="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between"
        >
          <div>
            <p
              class="font-['JetBrains_Mono'] text-[10px] font-bold uppercase tracking-[.22em] text-[#2563EB]"
            >
              LMS communication center
            </p>
            <h2
              class="mt-2 font-['Hanken_Grotesk'] text-3xl font-bold text-slate-950 dark:text-white"
            >
              Student communication
            </h2>
            <p
              class="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300"
            >
              Answer course questions and publish targeted updates to enrolled
              students from one workspace.
            </p>
          </div>
          <div class="grid grid-cols-2 gap-3 sm:flex">
            <div
              class="rounded-xl border border-slate-200 px-4 py-3 text-center dark:border-[#334155]"
            >
              <strong class="block text-xl text-slate-950 dark:text-white">{{
                openQuestionsCount()
              }}</strong
              ><span class="text-[10px] uppercase text-slate-500"
                >Open questions</span
              >
            </div>
            <div
              class="rounded-xl border border-slate-200 px-4 py-3 text-center dark:border-[#334155]"
            >
              <strong class="block text-xl text-slate-950 dark:text-white">{{
                announcements().length
              }}</strong
              ><span class="text-[10px] uppercase text-slate-500"
                >Announcements</span
              >
            </div>
          </div>
        </div>
      </div>

      <div
        class="flex gap-2 overflow-x-auto rounded-xl border border-slate-200 bg-white p-2 dark:border-[#26334B] dark:bg-[#101827]"
      >
        <button
          type="button"
          (click)="section.set('questions')"
          [class.bg-[#2563EB]]="section() === 'questions'"
          [class.!text-white]="section() === 'questions'"
          class="flex shrink-0 items-center gap-2 rounded-lg px-5 py-3 font-['JetBrains_Mono'] text-[11px] font-bold uppercase text-slate-700 dark:text-slate-200"
        >
          <span class="material-symbols-outlined text-base">forum</span>Q&A
          inbox
        </button>
        <button
          type="button"
          (click)="section.set('announcements')"
          [class.bg-[#2563EB]]="section() === 'announcements'"
          [class.!text-white]="section() === 'announcements'"
          class="flex shrink-0 items-center gap-2 rounded-lg px-5 py-3 font-['JetBrains_Mono'] text-[11px] font-bold uppercase text-slate-700 dark:text-slate-200"
        >
          <span class="material-symbols-outlined text-base">campaign</span
          >Announcements
        </button>
      </div>

      @if (section() === 'questions') {
        <div class="space-y-5">
          <div
            class="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-[#26334B] dark:bg-[#101827] md:grid-cols-[minmax(0,1fr)_220px_170px_auto]"
          >
            <label class="relative"
              ><span
                class="material-symbols-outlined absolute left-3 top-3 text-lg text-slate-400"
                >search</span
              ><input
                [(ngModel)]="questionSearch"
                (keyup.enter)="loadQuestions()"
                placeholder="Search questions or students"
                class="w-full rounded-lg border border-slate-300 bg-white py-3 pl-10 pr-3 text-sm text-slate-950 outline-none focus:border-[#2563EB] dark:border-[#334155] dark:bg-[#0B111D] dark:text-white"
            /></label>
            <select
              [(ngModel)]="questionCourseId"
              (ngModelChange)="loadQuestions()"
              class="rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 dark:border-[#334155] dark:bg-[#0B111D] dark:text-white"
            >
              <option value="">All courses</option>
              @for (course of courses; track course.id) {
                <option [value]="course.id">{{ course.title }}</option>
              }
            </select>
            <select
              [(ngModel)]="questionStatus"
              (ngModelChange)="loadQuestions()"
              class="rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 dark:border-[#334155] dark:bg-[#0B111D] dark:text-white"
            >
              <option value="ALL">All statuses</option>
              <option value="OPEN">Open</option>
              <option value="ANSWERED">Answered</option>
              <option value="RESOLVED">Resolved</option>
            </select>
            <button
              type="button"
              (click)="loadQuestions()"
              class="rounded-lg bg-[#2563EB] px-5 py-3 font-['JetBrains_Mono'] text-[10px] font-bold uppercase !text-white"
            >
              Refresh
            </button>
          </div>

          @if (isLoadingQuestions()) {
            <div
              class="rounded-xl border border-slate-200 bg-white py-14 text-center text-sm text-slate-500 dark:border-[#26334B] dark:bg-[#101827]"
            >
              Loading Q&A inbox…
            </div>
          } @else if (!questions().length) {
            <div
              class="rounded-xl border border-dashed border-slate-300 bg-white py-14 text-center dark:border-[#334155] dark:bg-[#101827]"
            >
              <span class="material-symbols-outlined text-4xl text-[#2563EB]"
                >mark_chat_read</span
              >
              <h3 class="mt-2 font-bold text-slate-950 dark:text-white">
                All caught up
              </h3>
              <p class="mt-1 text-sm text-slate-500">
                No questions match these filters.
              </p>
            </div>
          } @else {
            <div class="space-y-4">
              @for (question of questions(); track question.id) {
                <article
                  class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#26334B] dark:bg-[#101827]"
                >
                  <div
                    class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"
                  >
                    <div class="min-w-0">
                      <div class="flex flex-wrap items-center gap-2">
                        <span
                          class="rounded bg-blue-50 px-2 py-1 font-['JetBrains_Mono'] text-[9px] font-bold uppercase text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                          >{{ question.courseTitle }}</span
                        >
                        @if (question.lessonTitle) {
                          <span class="text-xs text-slate-500">{{
                            question.lessonTitle
                          }}</span>
                        }
                      </div>
                      <h3
                        class="mt-3 font-['Hanken_Grotesk'] text-lg font-bold text-slate-950 dark:text-white"
                      >
                        {{ question.title }}
                      </h3>
                      <p class="mt-1 text-xs text-slate-500">
                        {{ question.user.name }} ·
                        {{ relativeDate(question.createdAt) }}
                      </p>
                      <p
                        class="mt-3 whitespace-pre-line text-sm leading-6 text-slate-700 dark:text-slate-300"
                      >
                        {{ question.body }}
                      </p>
                    </div>
                    <select
                      [ngModel]="question.status"
                      (ngModelChange)="setStatus(question, $event)"
                      class="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-900 dark:border-[#334155] dark:bg-[#0B111D] dark:text-white"
                    >
                      <option value="OPEN">Open</option>
                      <option value="ANSWERED">Answered</option>
                      <option value="RESOLVED">Resolved</option>
                    </select>
                  </div>

                  @if (question.replies.length) {
                    <div
                      class="mt-5 space-y-3 border-l-2 border-blue-100 pl-4 dark:border-blue-950"
                    >
                      @for (reply of question.replies; track reply.id) {
                        <div
                          class="rounded-lg bg-slate-50 p-3 dark:bg-[#121C2F]"
                        >
                          <div
                            class="flex flex-wrap items-center gap-2 text-xs"
                          >
                            <strong class="text-slate-950 dark:text-white">{{
                              reply.user.name
                            }}</strong>
                            @if (reply.isInstructor) {
                              <span
                                class="rounded bg-[#2563EB] px-1.5 py-0.5 font-['JetBrains_Mono'] text-[8px] font-bold uppercase !text-white"
                                >Instructor</span
                              >
                            }
                            <span class="text-slate-400">{{
                              relativeDate(reply.createdAt)
                            }}</span>
                          </div>
                          <p
                            class="mt-2 whitespace-pre-line text-sm text-slate-700 dark:text-slate-300"
                          >
                            {{ reply.body }}
                          </p>
                        </div>
                      }
                    </div>
                  }
                  <div class="mt-5 flex flex-col gap-2 sm:flex-row">
                    <textarea
                      [ngModel]="replyDrafts[question.id] || ''"
                      (ngModelChange)="replyDrafts[question.id] = $event"
                      rows="2"
                      placeholder="Write an instructor answer…"
                      class="min-w-0 flex-1 resize-y rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none focus:border-[#2563EB] dark:border-[#334155] dark:bg-[#0B111D] dark:text-white"
                    ></textarea
                    ><button
                      type="button"
                      (click)="reply(question)"
                      class="rounded-lg bg-[#2563EB] px-5 py-3 font-['JetBrains_Mono'] text-[10px] font-bold uppercase !text-white"
                    >
                      Post answer
                    </button>
                  </div>
                </article>
              }
            </div>
          }
        </div>
      } @else {
        <div
          class="rounded-xl border p-5"
          [class.border-emerald-200]="emailConfiguration()?.configured"
          [class.bg-emerald-50]="emailConfiguration()?.configured"
          [class.border-amber-200]="!emailConfiguration()?.configured"
          [class.bg-amber-50]="!emailConfiguration()?.configured"
        >
          <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div class="flex items-center gap-2">
                <span
                  class="material-symbols-outlined"
                  [class.text-emerald-600]="emailConfiguration()?.configured"
                  [class.text-amber-600]="!emailConfiguration()?.configured"
                  >{{ emailConfiguration()?.configured ? 'verified' : 'dns' }}</span
                >
                <h3 class="font-['Hanken_Grotesk'] text-lg font-bold text-slate-950">
                  Email delivery · {{ emailConfiguration()?.provider || 'Resend' }}
                </h3>
              </div>
              <p class="mt-2 text-sm text-slate-700">
                @if (emailConfiguration()?.configured) {
                  Ready to send individually addressed, branded course announcements
                  from {{ emailConfiguration()?.from }}.
                } @else {
                  LMS announcements work now. Add the Resend key and verify your domain
                  before email delivery can be activated.
                }
              </p>
            </div>
            <span
              class="w-fit rounded-full px-3 py-1 font-['JetBrains_Mono'] text-[9px] font-bold uppercase"
              [class.bg-emerald-100]="emailConfiguration()?.configured"
              [class.text-emerald-700]="emailConfiguration()?.configured"
              [class.bg-amber-100]="!emailConfiguration()?.configured"
              [class.text-amber-700]="!emailConfiguration()?.configured"
              >{{ emailConfiguration()?.configured ? 'Ready' : 'Setup required' }}</span
            >
          </div>
          @if (!emailConfiguration()?.configured) {
            <ol class="mt-4 grid gap-2 text-xs text-slate-700 sm:grid-cols-3">
              @for (requirement of emailConfiguration()?.requirements || []; track requirement) {
                <li class="rounded-lg bg-white/70 px-3 py-2">{{ $index + 1 }}. {{ requirement }}</li>
              }
            </ol>
          } @else {
            <div class="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                (click)="sendTestEmail()"
                [disabled]="isSendingTestEmail()"
                class="w-fit rounded-lg bg-[#2563EB] px-4 py-2 font-['JetBrains_Mono'] text-[11px] font-bold uppercase !text-white hover:bg-[#1D4ED8] disabled:opacity-60"
              >
                {{ isSendingTestEmail() ? 'Sending…' : 'Send test email to me' }}
              </button>
              <p class="text-xs text-slate-700">
                Replies go to {{ emailConfiguration()?.replyTo || emailConfiguration()?.from }}
                @if (emailConfiguration()?.contactInbox) {
                  · Contact form messages go to {{ emailConfiguration()?.contactInbox }}
                }
              </p>
            </div>
            @if (testEmailResult(); as result) {
              <p class="mt-3 text-sm font-semibold" [class.text-emerald-700]="result.ok" [class.text-red-700]="!result.ok" role="status">
                {{ result.message }}
              </p>
            }
          }
        </div>
        <div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div
            class="rounded-xl border border-slate-200 bg-white p-5 dark:border-[#26334B] dark:bg-[#101827] sm:p-7"
          >
            <div class="flex items-center gap-3">
              <span
                class="grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-[#2563EB] dark:bg-blue-950"
                ><span class="material-symbols-outlined"
                  >edit_square</span
                ></span
              >
              <div>
                <h3
                  class="font-['Hanken_Grotesk'] text-xl font-bold text-slate-950 dark:text-white"
                >
                  Compose announcement
                </h3>
                <p class="text-sm text-slate-500">
                  Publish in the LMS and optionally send by email.
                </p>
              </div>
            </div>
            <p
              class="mt-6 block font-['JetBrains_Mono'] text-[10px] font-bold uppercase text-slate-600 dark:text-slate-300"
              >Audience</p
            >
            <div
              class="mt-2 rounded-xl border border-slate-200 p-4 dark:border-[#334155]"
            >
              <label
                class="flex items-center gap-3 text-sm font-semibold text-slate-900 dark:text-white"
                ><input
                  type="checkbox"
                  [checked]="allCoursesSelected()"
                  (change)="toggleAllCourses($any($event.target).checked)"
                  class="accent-[#2563EB]"
                />
                All enrolled course students</label
              >
              <div class="mt-3 grid gap-2 sm:grid-cols-2">
                @for (course of courses; track course.id) {
                  <label
                    class="flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-700 dark:bg-[#0B111D] dark:text-slate-200"
                    ><input
                      type="checkbox"
                      [checked]="isTargetCourse(course.id)"
                      (change)="
                        toggleTargetCourse(
                          course.id,
                          $any($event.target).checked
                        )
                      "
                      [disabled]="allCoursesSelected()"
                      class="mt-0.5 accent-[#2563EB]"
                    /><span>{{ course.title }}</span></label
                  >
                }
              </div>
              <p class="mt-3 text-xs text-slate-500">
                Choose “all students” or any combination of courses. Students
                enrolled in multiple selected courses receive one email.
              </p>
            </div>
            <label
              for="announcement-subject"
              class="mt-5 block font-['JetBrains_Mono'] text-[10px] font-bold uppercase text-slate-600 dark:text-slate-300"
              >Subject</label
            >
            <input
              id="announcement-subject"
              [(ngModel)]="announcementTitle"
              maxlength="240"
              placeholder="Course update, live session, or new lesson"
              class="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none focus:border-[#2563EB] dark:border-[#334155] dark:bg-[#0B111D] dark:text-white"
            />
            <label
              for="announcement-message"
              class="mt-5 block font-['JetBrains_Mono'] text-[10px] font-bold uppercase text-slate-600 dark:text-slate-300"
              >Message</label
            >
            <textarea
              id="announcement-message"
              [(ngModel)]="announcementBody"
              maxlength="10000"
              rows="9"
              placeholder="Write a useful update for your students…"
              class="mt-2 w-full resize-y rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm leading-6 text-slate-950 outline-none focus:border-[#2563EB] dark:border-[#334155] dark:bg-[#0B111D] dark:text-white"
            ></textarea>
            <div
              class="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <label
                class="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-200"
                ><input
                  type="checkbox"
                  [(ngModel)]="sendEmail"
                  class="accent-[#2563EB]"
                /><span
                  ><strong class="block">Also send by email</strong
                  ><span class="text-xs text-slate-500"
                    >{{ emailConfiguration()?.configured ? 'Sent directly to each selected student.' : 'Requires verified Resend domain setup.' }}</span
                  ></span
                ></label
              ><button
                type="button"
                (click)="publishAnnouncement()"
                [disabled]="isPublishingAnnouncement()"
                class="rounded-lg bg-[#2563EB] px-6 py-3 font-['JetBrains_Mono'] text-[10px] font-bold uppercase !text-white shadow-md disabled:opacity-50"
              >
                {{
                  isPublishingAnnouncement()
                    ? 'Publishing…'
                    : 'Publish announcement'
                }}
              </button>
            </div>
            @if (announcementFeedback()) {
              <p
                class="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
              >
                {{ announcementFeedback() }}
              </p>
            }
          </div>

          <aside class="space-y-3">
            <h3
              class="font-['Hanken_Grotesk'] text-xl font-bold text-slate-950 dark:text-white"
            >
              Published history
            </h3>
            @if (!announcements().length) {
              <div
                class="rounded-xl border border-dashed border-slate-300 bg-white py-10 text-center text-sm text-slate-500 dark:border-[#334155] dark:bg-[#101827]"
              >
                No announcements yet.
              </div>
            }
            @for (announcement of announcements(); track announcement.id) {
              <article
                class="rounded-xl border border-slate-200 bg-white p-4 dark:border-[#26334B] dark:bg-[#101827]"
              >
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <h4 class="font-bold text-slate-950 dark:text-white">
                      {{ announcement.title }}
                    </h4>
                    <p class="mt-1 text-xs text-slate-500">
                      {{ relativeDate(announcement.createdAt) }} ·
                      {{ announcement.recipientCount }} recipients
                    </p>
                  </div>
                  <button
                    type="button"
                    (click)="deleteAnnouncement(announcement)"
                    aria-label="Delete announcement"
                    class="material-symbols-outlined text-lg text-red-500"
                  >
                    delete
                  </button>
                </div>
                <p
                  class="mt-3 line-clamp-3 whitespace-pre-line text-sm leading-6 text-slate-600 dark:text-slate-300"
                >
                  {{ announcement.body }}
                </p>
                <div class="mt-3 flex flex-wrap gap-2">
                  <span
                    class="rounded bg-slate-100 px-2 py-1 text-[9px] font-bold uppercase text-slate-600 dark:bg-[#1E293B] dark:text-slate-300"
                    >{{
                      announcement.targetCourses.length
                        ? announcement.targetCourses.join(', ')
                        : 'All courses'
                    }}</span
                  >
                  @if (announcement.sendEmail) {
                    <span
                      class="rounded bg-blue-50 px-2 py-1 text-[9px] font-bold uppercase text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                      >Email: {{ announcement.emailStatus }}</span
                    >
                  }
                </div>
              </article>
            }
          </aside>
        </div>
      }
    </section>
  `,
})
export class AdminCommunicationComponent implements OnInit {
  @Input() courses: Course[] = [];
  private communicationService = inject(CommunicationService);

  section = signal<'questions' | 'announcements'>('questions');
  questions = signal<CourseQuestion[]>([]);
  announcements = signal<CourseAnnouncement[]>([]);
  emailConfiguration = signal<EmailConfiguration | null>(null);
  isSendingTestEmail = signal(false);
  testEmailResult = signal<{ ok: boolean; message: string } | null>(null);
  isLoadingQuestions = signal(true);
  questionSearch = '';
  questionCourseId = '';
  questionStatus = 'ALL';
  replyDrafts: Record<string, string> = {};

  targetCourseIds = signal<string[]>([]);
  allCoursesSelected = signal(true);
  announcementTitle = '';
  announcementBody = '';
  sendEmail = true;
  isPublishingAnnouncement = signal(false);
  announcementFeedback = signal('');

  ngOnInit() {
    this.loadQuestions();
    this.loadAnnouncements();
    this.communicationService
      .getEmailConfiguration()
      .subscribe((configuration) => this.emailConfiguration.set(configuration));
  }

  sendTestEmail() {
    this.isSendingTestEmail.set(true);
    this.testEmailResult.set(null);
    this.communicationService.sendTestEmail().subscribe({
      next: (result) => {
        this.isSendingTestEmail.set(false);
        this.testEmailResult.set(
          result.sent
            ? { ok: true, message: `Test email sent to ${result.to}. Check the inbox (and spam folder).` }
            : { ok: false, message: `Not sent: ${result.reason || 'unknown error'}` },
        );
      },
      error: (error) => {
        this.isSendingTestEmail.set(false);
        this.testEmailResult.set({
          ok: false,
          message: error?.error?.message || 'The test email could not be sent.',
        });
      },
    });
  }

  loadQuestions() {
    this.isLoadingQuestions.set(true);
    this.communicationService
      .getAdminQuestions({
        courseId: this.questionCourseId || undefined,
        status: this.questionStatus,
        search: this.questionSearch,
      })
      .subscribe({
        next: (questions) => {
          this.questions.set(questions);
          this.isLoadingQuestions.set(false);
        },
        error: () => this.isLoadingQuestions.set(false),
      });
  }

  loadAnnouncements() {
    this.communicationService
      .getAdminAnnouncements()
      .subscribe((announcements) => this.announcements.set(announcements));
  }

  openQuestionsCount() {
    return this.questions().filter((question) => question.status === 'OPEN')
      .length;
  }

  reply(question: CourseQuestion) {
    const body = String(this.replyDrafts[question.id] || '').trim();
    if (!body) return;
    this.communicationService.replyAsInstructor(question.id, body).subscribe({
      next: (updated) => {
        this.questions.update((questions) =>
          questions.map((item) => (item.id === updated.id ? updated : item)),
        );
        this.replyDrafts[question.id] = '';
      },
    });
  }

  setStatus(
    question: CourseQuestion,
    status: 'OPEN' | 'ANSWERED' | 'RESOLVED',
  ) {
    this.communicationService
      .updateQuestionStatus(question.id, status)
      .subscribe((updated) =>
        this.questions.update((questions) =>
          questions.map((item) => (item.id === updated.id ? updated : item)),
        ),
      );
  }

  toggleAllCourses(selected: boolean) {
    this.allCoursesSelected.set(selected);
    if (selected) this.targetCourseIds.set([]);
  }

  isTargetCourse(courseId: string) {
    return this.targetCourseIds().includes(courseId);
  }

  toggleTargetCourse(courseId: string, selected: boolean) {
    const targets = new Set(this.targetCourseIds());
    if (selected) targets.add(courseId);
    else targets.delete(courseId);
    this.targetCourseIds.set([...targets]);
  }

  publishAnnouncement() {
    if (
      !this.announcementTitle.trim() ||
      this.announcementBody.trim().length < 10 ||
      (!this.allCoursesSelected() && !this.targetCourseIds().length)
    ) {
      this.announcementFeedback.set(
        'Add a subject, a complete message, and at least one audience.',
      );
      return;
    }
    this.isPublishingAnnouncement.set(true);
    this.announcementFeedback.set('');
    this.communicationService
      .createAnnouncement({
        title: this.announcementTitle,
        body: this.announcementBody,
        targetCourseIds: this.allCoursesSelected()
          ? []
          : this.targetCourseIds(),
        sendEmail: this.sendEmail,
      })
      .subscribe({
        next: (announcement) => {
          this.announcements.update((items) => [announcement, ...items]);
          this.announcementTitle = '';
          this.announcementBody = '';
          this.isPublishingAnnouncement.set(false);
          this.announcementFeedback.set(
            announcement.emailStatus === 'SENT'
              ? `Published and emailed to ${announcement.recipientCount} students.`
              : announcement.sendEmail &&
                  announcement.emailStatus === 'NOT_CONFIGURED'
                ? `Published in the LMS for ${announcement.recipientCount} students. Add RESEND_API_KEY and MAIL_FROM to activate email delivery.`
                : `Published in the LMS for ${announcement.recipientCount} students.`,
          );
        },
        error: (error) => {
          this.isPublishingAnnouncement.set(false);
          this.announcementFeedback.set(
            error?.error?.message || 'The announcement could not be published.',
          );
        },
      });
  }

  deleteAnnouncement(announcement: CourseAnnouncement) {
    if (
      typeof window === 'undefined' ||
      !window.confirm(`Delete “${announcement.title}”?`)
    )
      return;
    this.communicationService.deleteAnnouncement(announcement.id).subscribe({
      next: () =>
        this.announcements.update((items) =>
          items.filter((item) => item.id !== announcement.id),
        ),
    });
  }

  relativeDate(value: string) {
    const minutes = Math.max(
      1,
      Math.floor((Date.now() - new Date(value).getTime()) / 60_000),
    );
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return days < 30 ? `${days}d ago` : new Date(value).toLocaleDateString();
  }
}

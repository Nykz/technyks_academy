import {
  Component,
  signal,
  inject,
  OnInit,
  OnDestroy,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import {
  EnrollmentsService,
  PlaybackTokenResponse,
} from '../../core/services/enrollments.service';
import { CoursesService, Course } from '../../core/services/courses.service';
import { AuthService } from '../../core/services/auth.service';
import {
  CommunicationService,
  CourseAnnouncement,
  CourseQuestion,
} from '../../core/services/communication.service';

@Component({
  selector: 'app-watch',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="watch-shell pt-16 min-h-screen flex flex-col md:flex-row overflow-x-hidden">
      <!-- Main Video Player Container -->
      <main class="watch-main min-w-0 flex-1 p-3 sm:p-4 md:p-5 lg:p-7 flex flex-col gap-4">
        @if (isLoading()) {
          <div class="watch-card w-full aspect-video rounded flex flex-col items-center justify-center">
            <span class="material-symbols-outlined animate-spin text-4xl text-[#3B82F6] mb-2">progress_activity</span>
            <span class="font-['JetBrains_Mono'] text-xs text-[#3B82F6]">Verifying protected lesson playback...</span>
          </div>
        } @else if (playbackData()?.videoAvailable && safeEmbedUrl()) {
          <div class="watch-player w-full aspect-video rounded overflow-hidden shadow-2xl relative">
            <iframe
              [src]="safeEmbedUrl()"
              class="w-full h-full border-0"
              allow="autoplay; encrypted-media; picture-in-picture"
              referrerpolicy="strict-origin-when-cross-origin"
              allowfullscreen
            ></iframe>
          </div>

          <div class="watch-card flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 sm:p-6 rounded">
            <div>
              <div class="watch-accent inline-flex items-center gap-2 font-['JetBrains_Mono'] text-[11px] mb-1">
                <span class="material-symbols-outlined text-sm">lock</span>
                {{ playbackData()?.provider === 'YOUTUBE' ? 'YOUTUBE MEMBERSHIP VIDEO' : 'TOKEN AUTHENTICATED BUNNY STREAM (EXPIRES IN 4H)' }}
              </div>
              <h1 class="watch-heading font-['Hanken_Grotesk'] text-lg sm:text-xl font-bold">
                {{ playbackData()?.title }}
              </h1>
            </div>

            <button
              (click)="markAsCompleted()"
              [disabled]="isCurrentLessonCompleted()"
              [attr.aria-label]="isCurrentLessonCompleted() ? 'Lesson completed' : 'Mark lesson as completed'"
              class="font-['JetBrains_Mono'] text-xs font-bold uppercase !text-white bg-[#2563EB] px-5 py-3 rounded hover:bg-[#1D4ED8] transition-all flex items-center gap-2 shadow-md"
            >
              <span class="material-symbols-outlined text-sm">
                {{ isCurrentLessonCompleted() ? 'check_circle' : 'task_alt' }}
              </span>
              {{ isCurrentLessonCompleted() ? 'Lesson Completed' : 'Mark as Completed' }}
            </button>
          </div>
          @if (progressError()) {
            <p class="watch-progress-error font-['Inter'] text-xs" role="alert">{{ progressError() }}</p>
          }
        } @else if (playbackData()) {
          <div class="watch-card w-full aspect-video rounded flex flex-col items-center justify-center p-5 sm:p-8 text-center">
            <span class="material-symbols-outlined text-4xl text-[#3B82F6] mb-2">video_settings</span>
            <h3 class="watch-heading font-['Hanken_Grotesk'] text-lg font-bold mb-2">Video not connected yet</h3>
            <p class="watch-muted font-['Inter'] text-sm max-w-md">
              This lesson does not have a playable video source yet. Add a Bunny Stream video ID or a YouTube Membership video reference in the curriculum.
            </p>
          </div>
        } @else {
          <div class="watch-card w-full aspect-video rounded flex flex-col items-center justify-center p-5 sm:p-8 text-center">
            <span class="material-symbols-outlined text-4xl text-[#ffb4ab] mb-2">lock_person</span>
            <h3 class="watch-heading font-['Hanken_Grotesk'] text-lg font-bold mb-2">
              {{ playbackError() ? 'This lesson is locked' : 'Streaming Unauthorized' }}
            </h3>
            <p class="watch-muted font-['Inter'] text-sm max-w-md mb-6">
              {{ playbackError() || 'This is paid token-gated content. Please enroll in this course or join Membership to stream this lesson.' }}
            </p>
            <a routerLink="/courses" class="font-['JetBrains_Mono'] text-xs uppercase text-[#040810] bg-[#3B82F6] px-6 py-3 rounded font-bold">
              Enroll in Course
            </a>
          </div>
        }

        @if (course()) {
          <section class="watch-card overflow-hidden rounded-xl">
            <nav class="flex gap-1 overflow-x-auto border-b border-slate-200 px-3 dark:border-[#26334B] sm:px-5" aria-label="Course learning tools">
              @for (tab of learningTabs; track tab.id) {
                <button
                  type="button"
                  (click)="activeLearningTab.set(tab.id)"
                  [class.border-[#2563EB]]="activeLearningTab() === tab.id"
                  [class.text-[#2563EB]]="activeLearningTab() === tab.id"
                  [class.border-transparent]="activeLearningTab() !== tab.id"
                  class="flex shrink-0 items-center gap-2 border-b-2 px-3 py-4 font-['JetBrains_Mono'] text-[11px] font-bold uppercase text-slate-600 transition-colors dark:text-slate-300"
                >
                  <span class="material-symbols-outlined text-base">{{ tab.icon }}</span>
                  {{ tab.label }}
                  @if (tab.id === 'questions' && questions().length) {
                    <span class="rounded-full bg-blue-100 px-1.5 py-0.5 text-[9px] text-blue-700 dark:bg-blue-950 dark:text-blue-300">{{ questions().length }}</span>
                  }
                </button>
              }
            </nav>

            <div class="p-4 sm:p-6 lg:p-7">
              @if (activeLearningTab() === 'overview') {
                <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
                  <div>
                    <p class="font-['JetBrains_Mono'] text-[10px] font-bold uppercase tracking-[.2em] text-[#2563EB]">Current lecture</p>
                    <h2 class="mt-2 font-['Hanken_Grotesk'] text-2xl font-bold text-slate-950 dark:text-white">{{ playbackData()?.title }}</h2>
                    <p class="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
                      {{ currentLessonDescription() || course()?.description }}
                    </p>
                  </div>
                  <div class="rounded-xl border border-blue-200 bg-blue-50 p-5 dark:border-blue-900 dark:bg-blue-950/40">
                    <span class="material-symbols-outlined text-2xl text-[#2563EB]">monitoring</span>
                    <p class="mt-2 font-['JetBrains_Mono'] text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Your progress</p>
                    <p class="mt-1 font-['Hanken_Grotesk'] text-3xl font-bold text-slate-950 dark:text-white">{{ learningProgressPercent() }}%</p>
                    <div class="mt-3 h-2 overflow-hidden rounded-full bg-blue-100 dark:bg-blue-950"><div class="h-full rounded-full bg-[#2563EB] transition-all" [style.width.%]="learningProgressPercent()"></div></div>
                    <p class="mt-3 text-xs text-slate-600 dark:text-slate-300">{{ completedLessonIds().size }} of {{ totalLessons() }} lectures completed</p>
                  </div>
                </div>
              } @else if (activeLearningTab() === 'questions') {
                <div class="space-y-6">
                  <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <h2 class="font-['Hanken_Grotesk'] text-2xl font-bold text-slate-950 dark:text-white">Questions & answers</h2>
                      <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">Ask about this lecture or search answers from the whole course.</p>
                    </div>
                    <button type="button" (click)="showQuestionComposer.set(!showQuestionComposer())" class="rounded-lg bg-[#2563EB] px-5 py-3 font-['JetBrains_Mono'] text-[11px] font-bold uppercase !text-white shadow-md hover:bg-[#1D4ED8]">
                      {{ showQuestionComposer() ? 'Close composer' : 'Ask a question' }}
                    </button>
                  </div>

                  @if (communicationError()) {
                    <p class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">{{ communicationError() }}</p>
                  }

                  @if (showQuestionComposer()) {
                    <div class="rounded-xl border border-blue-200 bg-blue-50/60 p-4 dark:border-blue-900 dark:bg-blue-950/30 sm:p-5">
                      <label for="question-title" class="block font-['JetBrains_Mono'] text-[10px] font-bold uppercase text-slate-600 dark:text-slate-300">Question title</label>
                      <input id="question-title" [(ngModel)]="newQuestionTitle" maxlength="240" placeholder="What do you need help understanding?" class="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none focus:border-[#2563EB] dark:border-[#334155] dark:bg-[#0B111D] dark:text-white" />
                      <label for="question-details" class="mt-4 block font-['JetBrains_Mono'] text-[10px] font-bold uppercase text-slate-600 dark:text-slate-300">Details</label>
                      <textarea id="question-details" [(ngModel)]="newQuestionBody" maxlength="4000" rows="4" placeholder="Describe the problem, what you tried, and what you expected." class="mt-2 w-full resize-y rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none focus:border-[#2563EB] dark:border-[#334155] dark:bg-[#0B111D] dark:text-white"></textarea>
                      <div class="mt-4 flex flex-wrap items-center justify-between gap-3">
                        <label class="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300"><input type="checkbox" [(ngModel)]="questionForCurrentLecture" class="accent-[#2563EB]" /> Link to this lecture</label>
                        <button type="button" (click)="submitQuestion()" [disabled]="isSubmittingQuestion()" class="rounded-lg bg-[#2563EB] px-5 py-2.5 font-['JetBrains_Mono'] text-[10px] font-bold uppercase !text-white disabled:opacity-50">{{ isSubmittingQuestion() ? 'Publishing…' : 'Publish question' }}</button>
                      </div>
                    </div>
                  }

                  <div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_190px]">
                    <label class="relative"><span class="material-symbols-outlined absolute left-3 top-3 text-lg text-slate-400">search</span><input [(ngModel)]="questionSearch" placeholder="Search course questions" class="w-full rounded-lg border border-slate-300 bg-white py-3 pl-10 pr-4 text-sm text-slate-950 outline-none focus:border-[#2563EB] dark:border-[#334155] dark:bg-[#0B111D] dark:text-white" /></label>
                    <select [(ngModel)]="questionScope" (ngModelChange)="loadQuestions()" class="rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 dark:border-[#334155] dark:bg-[#0B111D] dark:text-white"><option value="ALL">All lectures</option><option value="CURRENT">Current lecture</option></select>
                    <select [(ngModel)]="questionSort" class="rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 dark:border-[#334155] dark:bg-[#0B111D] dark:text-white"><option value="NEWEST">Newest first</option><option value="OLDEST">Oldest first</option><option value="UNANSWERED">Unanswered first</option></select>
                  </div>

                  @if (isLoadingCommunication()) {
                    <div class="py-12 text-center text-sm text-slate-500">Loading discussions…</div>
                  } @else if (!filteredQuestions().length) {
                    <div class="rounded-xl border border-dashed border-slate-300 py-12 text-center dark:border-[#334155]"><span class="material-symbols-outlined text-4xl text-[#2563EB]">forum</span><h3 class="mt-2 font-bold text-slate-900 dark:text-white">No questions found</h3><p class="mt-1 text-sm text-slate-500">Be the first student to start this discussion.</p></div>
                  } @else {
                    <div class="space-y-4">
                      @for (question of filteredQuestions(); track question.id) {
                        <article class="rounded-xl border border-slate-200 bg-white p-4 dark:border-[#26334B] dark:bg-[#0B111D] sm:p-5">
                          <div class="flex gap-3">
                            <div class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-blue-100 font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300">{{ initials(question.user.name) }}</div>
                            <div class="min-w-0 flex-1">
                              <div class="flex flex-wrap items-start justify-between gap-2"><h3 class="font-['Hanken_Grotesk'] text-base font-bold text-slate-950 dark:text-white">{{ question.title }}</h3><span class="rounded-full px-2 py-1 font-['JetBrains_Mono'] text-[9px] font-bold uppercase" [class.bg-emerald-100]="question.status !== 'OPEN'" [class.text-emerald-700]="question.status !== 'OPEN'" [class.bg-amber-100]="question.status === 'OPEN'" [class.text-amber-700]="question.status === 'OPEN'">{{ question.status }}</span></div>
                              <p class="mt-1 text-xs text-slate-500">{{ question.user.name }} · {{ relativeDate(question.createdAt) }}@if (question.lessonTitle) {<span> · {{ question.lessonTitle }}</span>}</p>
                              <p class="mt-3 whitespace-pre-line text-sm leading-6 text-slate-700 dark:text-slate-300">{{ question.body }}</p>

                              @if (question.replies.length) {
                                <div class="mt-4 space-y-3 border-l-2 border-blue-100 pl-4 dark:border-blue-950">
                                  @for (reply of question.replies; track reply.id) {
                                    <div class="rounded-lg bg-slate-50 p-3 dark:bg-[#121C2F]">
                                      <div class="flex flex-wrap items-center gap-2 text-xs"><strong class="text-slate-900 dark:text-white">{{ reply.user.name }}</strong>@if (reply.isInstructor) {<span class="rounded bg-[#2563EB] px-1.5 py-0.5 font-['JetBrains_Mono'] text-[8px] font-bold uppercase !text-white">Instructor</span>}<span class="text-slate-400">{{ relativeDate(reply.createdAt) }}</span></div>
                                      <p class="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700 dark:text-slate-300">{{ reply.body }}</p>
                                    </div>
                                  }
                                </div>
                              }

                              <div class="mt-4 flex gap-2"><input [ngModel]="replyDrafts[question.id] || ''" (ngModelChange)="replyDrafts[question.id] = $event" placeholder="Write a helpful reply…" class="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none focus:border-[#2563EB] dark:border-[#334155] dark:bg-[#101827] dark:text-white" /><button type="button" (click)="submitReply(question.id)" class="rounded-lg border border-[#2563EB] px-4 py-2 font-['JetBrains_Mono'] text-[10px] font-bold uppercase text-[#2563EB]">Reply</button></div>
                            </div>
                          </div>
                        </article>
                      }
                    </div>
                  }
                </div>
              } @else if (activeLearningTab() === 'announcements') {
                <div>
                  <h2 class="font-['Hanken_Grotesk'] text-2xl font-bold text-slate-950 dark:text-white">Course announcements</h2>
                  <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">Updates and guidance from your instructor.</p>
                  @if (!announcements().length) {
                    <div class="mt-6 rounded-xl border border-dashed border-slate-300 py-12 text-center dark:border-[#334155]"><span class="material-symbols-outlined text-4xl text-[#2563EB]">campaign</span><p class="mt-2 text-sm text-slate-500">No announcements for this course yet.</p></div>
                  } @else {
                    <div class="mt-6 space-y-4">@for (announcement of announcements(); track announcement.id) {<article class="rounded-xl border border-slate-200 bg-white p-5 dark:border-[#26334B] dark:bg-[#0B111D]"><div class="flex items-center gap-3"><span class="grid h-10 w-10 place-items-center rounded-full bg-blue-100 text-[#2563EB] dark:bg-blue-950"><span class="material-symbols-outlined">campaign</span></span><div><p class="font-bold text-slate-950 dark:text-white">{{ announcement.authorName }}</p><p class="text-xs text-slate-500">{{ relativeDate(announcement.createdAt) }}</p></div></div><h3 class="mt-5 font-['Hanken_Grotesk'] text-xl font-bold text-slate-950 dark:text-white">{{ announcement.title }}</h3><p class="mt-3 whitespace-pre-line text-sm leading-7 text-slate-700 dark:text-slate-300">{{ announcement.body }}</p></article>}</div>
                  }
                </div>
              } @else {
                <div>
                  <h2 class="font-['Hanken_Grotesk'] text-2xl font-bold text-slate-950 dark:text-white">Student reviews</h2>
                  <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">Share an honest review after learning from the course.</p>
                  <div class="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-[#26334B] dark:bg-[#121C2F] sm:p-5">
                    <div class="flex flex-wrap gap-2" aria-label="Course rating">@for (star of [1,2,3,4,5]; track star) {<button type="button" (click)="reviewRating = star" class="material-symbols-outlined text-2xl" [class.text-amber-500]="star <= reviewRating" [class.text-slate-300]="star > reviewRating">star</button>}</div>
                    <textarea [(ngModel)]="reviewComment" rows="3" maxlength="2000" placeholder="What did you learn? What should future students know?" class="mt-3 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none focus:border-[#2563EB] dark:border-[#334155] dark:bg-[#0B111D] dark:text-white"></textarea>
                    <div class="mt-3 flex items-center justify-between gap-3"><span class="text-xs text-emerald-600 dark:text-emerald-400">{{ reviewFeedback() }}</span><button type="button" (click)="submitReview()" [disabled]="isSubmittingReview()" class="rounded-lg bg-[#2563EB] px-5 py-2.5 font-['JetBrains_Mono'] text-[10px] font-bold uppercase !text-white disabled:opacity-50">{{ isSubmittingReview() ? 'Saving…' : 'Save review' }}</button></div>
                  </div>
                  <div class="mt-6 space-y-3">@for (review of course()?.reviews || []; track review.id) {<article class="rounded-xl border border-slate-200 p-4 dark:border-[#26334B]"><div class="flex items-center justify-between gap-3"><strong class="text-sm text-slate-950 dark:text-white">{{ review.user.name }}</strong><span class="text-sm text-amber-500">★ {{ review.rating }}/5</span></div><p class="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-300">{{ review.comment }}</p><p class="mt-2 text-xs text-slate-400">{{ relativeDate(review.createdAt) }}</p></article>}</div>
                </div>
              }
            </div>
          </section>
        }
      </main>

      <!-- Right Drawer Curriculum Navigation Sidebar -->
      <aside class="watch-sidebar w-full md:w-[40%] md:min-w-[320px] md:max-w-[520px] p-4 sm:p-5 md:p-6 flex flex-col gap-5 md:sticky md:top-16 md:h-[calc(100vh-4rem)]">
        <div class="shrink-0">
          <span class="watch-accent font-['JetBrains_Mono'] text-xs uppercase font-bold">COURSE CURRICULUM</span>
          <h2 class="watch-heading font-['Hanken_Grotesk'] text-lg font-bold mt-1">{{ course()?.title }}</h2>
          <div class="flex items-center justify-between gap-3 mt-4">
            <span class="watch-muted font-['JetBrains_Mono'] text-[11px] uppercase">
              {{ course()?.modules?.length || 0 }} sections
            </span>
            <button
              type="button"
              (click)="toggleAllModules()"
              class="watch-accent font-['JetBrains_Mono'] text-[11px] uppercase hover:text-[#3B82F6] transition-colors"
            >
              {{ allModulesExpanded() ? 'Collapse all' : 'Expand all' }}
            </button>
          </div>
        </div>

        <div class="flex-1 min-h-0 flex flex-col gap-3 overflow-y-auto pr-1" role="list" aria-label="Course curriculum">
          @for (module of course()?.modules; track module.id) {
            <section class="watch-section rounded overflow-hidden shrink-0" role="listitem">
              <button
                type="button"
                (click)="toggleModule(module.id)"
                [attr.aria-expanded]="isModuleExpanded(module.id)"
                class="watch-section-header w-full p-3.5 flex items-center justify-between gap-3 text-left transition-colors"
              >
                <span class="flex items-center gap-2 min-w-0">
                  <span class="material-symbols-outlined text-base text-[#3B82F6]">
                    {{ isModuleExpanded(module.id) ? 'expand_less' : 'expand_more' }}
                  </span>
                  <span class="watch-heading font-['Hanken_Grotesk'] text-xs font-bold truncate">{{ module.title }}</span>
                </span>
                <span class="watch-muted font-['JetBrains_Mono'] text-[10px] whitespace-nowrap">
                  {{ module.lessons.length }} lectures
                </span>
              </button>

              @if (isModuleExpanded(module.id)) {
                <div class="divide-y divide-[#1E293B]/40">
                  @for (lesson of module.lessons; track lesson.id) {
                    <a
                      [routerLink]="['/courses', course()?.slug, 'watch', lesson.id]"
                      [class.bg-[#3B82F6]/15]="lesson.id === currentLessonId()"
                      [class.watch-lesson-active]="lesson.id === currentLessonId()"
                      [class.watch-lesson-completed]="isLessonCompleted(lesson.id)"
                      [attr.aria-current]="lesson.id === currentLessonId() ? 'page' : null"
                      class="watch-lesson-link p-3.5 flex items-center justify-between gap-3 text-xs font-['Inter'] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#3B82F6]"
                    >
                      <span class="flex items-center gap-2.5 min-w-0">
                        <span class="material-symbols-outlined text-sm text-[#3B82F6]">
                          {{ isLessonCompleted(lesson.id) ? 'check_circle' : (lesson.id === currentLessonId() ? 'play_circle' : (lesson.isFreePreview ? 'lock_open' : 'ondemand_video')) }}
                        </span>
                        <span class="watch-lesson-title line-clamp-2">{{ lesson.title }}</span>
                      </span>

                      <span class="flex items-center gap-2 shrink-0">
                        @if (lesson.isFreePreview) {
                          <span class="watch-preview font-['JetBrains_Mono'] text-[10px] uppercase">Preview</span>
                        }
                        @if (isLessonCompleted(lesson.id)) {
                          <span class="watch-completed-label font-['JetBrains_Mono'] text-[10px] uppercase">Done</span>
                        }
                        <span class="watch-muted font-['JetBrains_Mono'] text-[11px]">
                          {{ Math.max(1, Math.round(lesson.duration / 60)) }}m
                        </span>
                      </span>
                    </a>
                  }
                </div>
              }
            </section>
          }
        </div>
      </aside>
    </div>
  `,
})
export class WatchComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private enrollmentsService = inject(EnrollmentsService);
  private coursesService = inject(CoursesService);
  private sanitizer = inject(DomSanitizer);
  private authService = inject(AuthService);
  private communicationService = inject(CommunicationService);

  course = signal<Course | null>(null);
  playbackData = signal<PlaybackTokenResponse | null>(null);
  safeEmbedUrl = signal<SafeResourceUrl | null>(null);
  playbackError = signal('');
  currentLessonId = signal<string>('');
  courseId = signal<string>('');
  isLoading = signal(true);
  completedLessonIds = signal<Set<string>>(new Set());
  progressError = signal('');
  expandedModules = signal<Set<string>>(new Set());
  readonly learningTabs = [
    { id: 'overview' as const, label: 'Overview', icon: 'overview' },
    { id: 'questions' as const, label: 'Q&A', icon: 'forum' },
    { id: 'announcements' as const, label: 'Announcements', icon: 'campaign' },
    { id: 'reviews' as const, label: 'Reviews', icon: 'star' },
  ];
  activeLearningTab = signal<
    'overview' | 'questions' | 'announcements' | 'reviews'
  >('overview');
  questions = signal<CourseQuestion[]>([]);
  announcements = signal<CourseAnnouncement[]>([]);
  isLoadingCommunication = signal(false);
  communicationError = signal('');
  showQuestionComposer = signal(false);
  newQuestionTitle = '';
  newQuestionBody = '';
  questionForCurrentLecture = true;
  questionSearch = '';
  questionScope: 'ALL' | 'CURRENT' = 'ALL';
  questionSort: 'NEWEST' | 'OLDEST' | 'UNANSWERED' = 'NEWEST';
  replyDrafts: Record<string, string> = {};
  isSubmittingQuestion = signal(false);
  reviewRating = 5;
  reviewComment = '';
  isSubmittingReview = signal(false);
  reviewFeedback = signal('');

  private progressInterval: any;
  Math = Math;

  ngOnInit() {
    this.route.params.subscribe((params) => {
      const slug = params['slug'];
      const lessonId = params['lessonId'];
      this.currentLessonId.set(lessonId);
      this.isLoading.set(true);
      this.playbackData.set(null);
      this.safeEmbedUrl.set(null);
      this.playbackError.set('');
      this.completedLessonIds.set(new Set());
      this.progressError.set('');

      if (slug) {
        this.coursesService.getCourseBySlug(slug).subscribe({
          next: (c) => {
            const requestedLessonExists = (c.modules || []).some((module) =>
              (module.lessons || []).some((lesson) => lesson.id === lessonId),
            );
            if (!requestedLessonExists) {
              const firstLesson = (c.modules || []).find(
                (module) => module.lessons?.length,
              )?.lessons?.[0];
              if (firstLesson) {
                this.router.navigate(
                  ['/courses', c.slug, 'watch', firstLesson.id],
                  { replaceUrl: true },
                );
                return;
              }
            }
            this.course.set(c);
            this.courseId.set(c.id);
            this.loadCompletionStatus(c.id, lessonId);
            this.loadLearningData(c.id);
            const activeModule = (c.modules || []).find((module) =>
              (module.lessons || []).some((lesson) => lesson.id === lessonId),
            );
            this.expandedModules.set(
              new Set([
                ...(c.modules || []).slice(0, 1).map((module) => module.id),
                ...(activeModule ? [activeModule.id] : []),
              ]),
            );
            this.loadVideoToken(lessonId);
          },
          error: (error) => {
            this.isLoading.set(false);
            this.playbackError.set(
              error?.error?.message || 'Course content could not be loaded.',
            );
          },
        });
      }
    });

    // Save progress on interval every 10 seconds
    this.progressInterval = setInterval(() => {
      this.saveProgressInterval();
    }, 10000);
  }

  ngOnDestroy() {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
    }
    this.saveProgressInterval();
  }

  @HostListener('window:beforeunload')
  onBeforeUnload() {
    this.saveProgressInterval();
  }

  loadVideoToken(lessonId: string) {
    this.isLoading.set(true);
    this.enrollmentsService.getVideoToken(lessonId).subscribe({
      next: (data) => {
        this.playbackData.set(data);
        this.playbackError.set('');
        this.safeEmbedUrl.set(
          data.embedUrl
            ? this.sanitizer.bypassSecurityTrustResourceUrl(data.embedUrl)
            : null,
        );
        this.isLoading.set(false);
        this.saveProgressInterval();
      },
      error: (error) => {
        this.isLoading.set(false);
        this.playbackData.set(null);
        this.safeEmbedUrl.set(null);
        this.playbackError.set(
          error?.error?.message ||
            'This lesson could not be opened. Please enroll or check the preview settings.',
        );
      },
    });
  }

  private loadCompletionStatus(courseId: string, lessonId: string) {
    if (!this.authService.isAuthenticated()) {
      this.completedLessonIds.set(new Set());
      return;
    }

    this.enrollmentsService.getMyEnrollments().subscribe({
      next: (enrollments) => {
        const enrollment = enrollments.find(
          (item) =>
            item.courseId === courseId ||
            item.course?.slug === this.course()?.slug,
        );
        const completedLessonIds = new Set(
          enrollment?.completedLessonIds || [],
        );

        if (this.courseId() !== courseId || this.currentLessonId() !== lessonId)
          return;

        this.completedLessonIds.set(completedLessonIds);
      },
      error: () => {
        // Preview playback can still work for signed-out users or when the
        // progress endpoint is temporarily unavailable.
        if (
          this.courseId() === courseId &&
          this.currentLessonId() === lessonId
        ) {
          this.completedLessonIds.set(new Set());
        }
      },
    });
  }

  isLessonCompleted(lessonId: string): boolean {
    return this.completedLessonIds().has(lessonId);
  }

  isCurrentLessonCompleted(): boolean {
    return this.isLessonCompleted(this.currentLessonId());
  }

  private applyEnrollmentProgress(
    courseId: string,
    lessonId: string,
    completedLessonIds: string[] | undefined,
  ) {
    if (this.courseId() !== courseId) return;

    const completed = new Set(completedLessonIds || []);
    this.completedLessonIds.set(completed);
  }

  isModuleExpanded(moduleId: string): boolean {
    return this.expandedModules().has(moduleId);
  }

  toggleModule(moduleId: string) {
    const expanded = new Set(this.expandedModules());
    if (expanded.has(moduleId)) expanded.delete(moduleId);
    else expanded.add(moduleId);
    this.expandedModules.set(expanded);
  }

  allModulesExpanded(): boolean {
    const modules = this.course()?.modules || [];
    return (
      modules.length > 0 &&
      modules.every((module) => this.expandedModules().has(module.id))
    );
  }

  toggleAllModules() {
    const modules = this.course()?.modules || [];
    this.expandedModules.set(
      this.allModulesExpanded()
        ? new Set()
        : new Set(modules.map((module) => module.id)),
    );
  }

  saveProgressInterval() {
    const courseId = this.courseId();
    const lessonId = this.currentLessonId();
    if (this.authService.isAuthenticated() && courseId && lessonId) {
      this.enrollmentsService
        .updateProgress({
          courseId,
          lessonId,
          isCompleted: this.isCurrentLessonCompleted(),
        })
        .subscribe({
          next: (enrollment) => {
            this.applyEnrollmentProgress(
              courseId,
              lessonId,
              enrollment.completedLessonIds,
            );
          },
        });
    }
  }

  markAsCompleted() {
    const courseId = this.courseId();
    const lessonId = this.currentLessonId();
    if (
      this.isCurrentLessonCompleted() ||
      !this.authService.isAuthenticated() ||
      !courseId ||
      !lessonId
    )
      return;

    this.progressError.set('');

    const completed = new Set(this.completedLessonIds());
    completed.add(lessonId);
    this.completedLessonIds.set(completed);

    this.enrollmentsService
      .updateProgress({ courseId, lessonId, isCompleted: true })
      .subscribe({
        next: (enrollment) => {
          this.applyEnrollmentProgress(
            courseId,
            lessonId,
            enrollment.completedLessonIds,
          );
        },
        error: (error) => {
          if (
            this.courseId() === courseId &&
            this.currentLessonId() === lessonId
          ) {
            const current = new Set(this.completedLessonIds());
            current.delete(lessonId);
            this.completedLessonIds.set(current);
            this.progressError.set(
              error?.error?.message ||
                'Progress could not be saved. Please try again.',
            );
          }
        },
      });
  }

  loadQuestions() {
    const courseId = this.courseId();
    if (!courseId) return;
    this.isLoadingCommunication.set(true);
    this.communicationError.set('');
    this.communicationService
      .getCourseQuestions(courseId, {
        scope: this.questionScope,
        lessonId: this.currentLessonId(),
      })
      .subscribe({
        next: (questions) => {
          this.questions.set(questions);
          this.isLoadingCommunication.set(false);
        },
        error: (error) => {
          this.questions.set([]);
          this.isLoadingCommunication.set(false);
          this.communicationError.set(
            error?.error?.message ||
              'Enroll in this course to join its Q&A and announcements.',
          );
        },
      });
  }

  filteredQuestions() {
    const query = this.questionSearch.trim().toLowerCase();
    const questions = this.questions().filter(
      (question) =>
        !query ||
        `${question.title} ${question.body} ${question.user.name} ${question.lessonTitle || ''}`
          .toLowerCase()
          .includes(query),
    );
    return [...questions].sort((a, b) => {
      if (this.questionSort === 'UNANSWERED') {
        const answerDifference =
          Number(a.status !== 'OPEN') - Number(b.status !== 'OPEN');
        if (answerDifference) return answerDifference;
      }
      const difference =
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return this.questionSort === 'OLDEST' ? -difference : difference;
    });
  }

  submitQuestion() {
    const courseId = this.courseId();
    if (
      !courseId ||
      !this.newQuestionTitle.trim() ||
      !this.newQuestionBody.trim()
    )
      return;
    this.isSubmittingQuestion.set(true);
    this.communicationService
      .createQuestion(courseId, {
        title: this.newQuestionTitle,
        body: this.newQuestionBody,
        lessonId: this.questionForCurrentLecture
          ? this.currentLessonId()
          : undefined,
      })
      .subscribe({
        next: () => {
          this.newQuestionTitle = '';
          this.newQuestionBody = '';
          this.showQuestionComposer.set(false);
          this.isSubmittingQuestion.set(false);
          this.loadQuestions();
        },
        error: (error) => {
          this.isSubmittingQuestion.set(false);
          this.communicationError.set(
            error?.error?.message || 'Your question could not be published.',
          );
        },
      });
  }

  submitReply(questionId: string) {
    const body = String(this.replyDrafts[questionId] || '').trim();
    if (!body) return;
    this.communicationService.replyToQuestion(questionId, body).subscribe({
      next: (updated) => {
        this.questions.update((questions) =>
          questions.map((question) =>
            question.id === updated.id ? updated : question,
          ),
        );
        this.replyDrafts[questionId] = '';
      },
      error: (error) =>
        this.communicationError.set(
          error?.error?.message || 'Your reply could not be published.',
        ),
    });
  }

  submitReview() {
    const course = this.course();
    if (!course || this.reviewComment.trim().length < 10) {
      this.reviewFeedback.set('Please write at least 10 characters.');
      return;
    }
    this.isSubmittingReview.set(true);
    this.reviewFeedback.set('');
    this.coursesService
      .submitReview(course.id, {
        rating: this.reviewRating,
        comment: this.reviewComment,
      })
      .subscribe({
        next: (review) => {
          this.course.update((current) =>
            current
              ? {
                  ...current,
                  reviews: [
                    review,
                    ...(current.reviews || []).filter(
                      (candidate) => candidate.id !== review.id,
                    ),
                  ],
                }
              : current,
          );
          this.reviewComment = '';
          this.isSubmittingReview.set(false);
          this.reviewFeedback.set('Your review has been saved.');
        },
        error: (error) => {
          this.isSubmittingReview.set(false);
          this.reviewFeedback.set(
            error?.error?.message || 'Your review could not be saved.',
          );
        },
      });
  }

  currentLessonDescription() {
    for (const module of this.course()?.modules || []) {
      const lesson = module.lessons.find(
        (candidate) => candidate.id === this.currentLessonId(),
      );
      if (lesson) return lesson.description || '';
    }
    return '';
  }

  totalLessons() {
    return (this.course()?.modules || []).reduce(
      (total, module) => total + module.lessons.length,
      0,
    );
  }

  learningProgressPercent() {
    const total = this.totalLessons();
    return total
      ? Math.round((this.completedLessonIds().size / total) * 100)
      : 0;
  }

  initials(name: string) {
    return String(name || 'S')
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase();
  }

  relativeDate(value: string) {
    const milliseconds = Date.now() - new Date(value).getTime();
    const minutes = Math.max(1, Math.floor(milliseconds / 60_000));
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(value).toLocaleDateString();
  }

  private loadLearningData(courseId: string) {
    this.loadQuestions();
    this.communicationService.getCourseAnnouncements(courseId).subscribe({
      next: (announcements) => this.announcements.set(announcements),
      error: () => this.announcements.set([]),
    });
  }
}

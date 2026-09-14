import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { CoursesService, Course } from '../../core/services/courses.service';
import { AuthService } from '../../core/services/auth.service';
import { EnrollmentsService } from '../../core/services/enrollments.service';
import { MediaUrlPipe } from '../../core/pipes/media-url.pipe';

@Component({
  selector: 'app-course-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, MediaUrlPipe],
  template: `
    @if (isLoading()) {
      <div class="min-h-[70vh] flex items-center justify-center">
        <span
          class="material-symbols-outlined animate-spin text-3xl text-[#3B82F6]"
          >progress_activity</span
        >
      </div>
    } @else if (course()) {
      <div class="pt-20 pb-20">
        <div
          class="max-w-6xl mx-auto px-6 md:px-16 pt-6 pb-4 font-['JetBrains_Mono'] text-[11px] text-slate-500 dark:text-[#a18d7b] uppercase tracking-wider"
        >
          <a
            routerLink="/courses"
            class="hover:text-[#2563EB] dark:hover:text-[#3B82F6] transition-colors"
            >Courses</a
          >
          <span class="mx-2 text-[#2563EB] dark:text-[#3B82F6]">/</span>
          <span>{{ course()?.level }} course</span>
        </div>

        <section class="px-4 sm:px-6 lg:px-8 pb-8 transition-colors">
          <div
            class="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-8 lg:gap-12 items-start"
          >
            <div
              class="min-w-0 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-[#1E293B] dark:bg-[#121A2B] sm:p-8 lg:p-10"
            >
              <div class="flex items-center gap-3 mb-4">
                <span
                  class="font-['JetBrains_Mono'] text-xs text-white dark:text-[#040810] bg-[#2563EB] dark:bg-[#3B82F6] px-3 py-1 rounded font-bold uppercase shadow-sm"
                >
                  {{ course()?.isFree ? 'Free course' : 'Premium course' }}
                </span>
                <span
                  class="font-['JetBrains_Mono'] text-xs text-[#2563EB] dark:text-[#3B82F6] font-bold uppercase"
                >
                  {{ course()?.level }} LEVEL
                </span>
              </div>

              <h1
                class="font-['Hanken_Grotesk'] text-3xl md:text-5xl font-bold text-slate-900 dark:text-white mb-4 leading-tight"
              >
                {{ course()?.title }}
              </h1>

              <p
                class="font-['Inter'] text-lg text-slate-600 dark:text-[#d9c3af] mb-8 leading-relaxed"
              >
                {{ course()?.subtitle }}
              </p>

              <div
                class="flex flex-wrap items-center gap-6 font-['JetBrains_Mono'] text-xs text-slate-600 dark:text-[#a18d7b]"
              >
                <div class="flex items-center gap-2">
                  <span
                    class="material-symbols-outlined text-[#2563EB] dark:text-[#3B82F6] text-base"
                    >schedule</span
                  >
                  {{ getTotalDurationMinutes() }} Minutes Total
                </div>
                <div class="flex items-center gap-2">
                  <span
                    class="material-symbols-outlined text-[#2563EB] dark:text-[#3B82F6] text-base"
                    >layers</span
                  >
                  {{ getTotalModules() }} Sections ·
                  {{ getTotalLessons() }} Lessons
                </div>
                <div class="flex items-center gap-2">
                  <span
                    class="material-symbols-outlined text-[#2563EB] dark:text-[#3B82F6] text-base"
                    >verified</span
                  >
                  Certificate Included
                </div>
                <div class="flex items-center gap-2">
                  <span
                    class="material-symbols-outlined text-amber-500 dark:text-[#3B82F6] text-base"
                    >star</span
                  >
                  {{ course()?.rating || 0 | number: '1.1-1' }}
                  ({{ course()?.reviewCount || 0 }} reviews)
                </div>
              </div>
            </div>

            <!-- Enrollment Card -->
            <div
              class="course-access-card bg-white dark:bg-[#0B111D] border border-slate-200 dark:border-[#26334B] rounded-2xl p-5 sm:p-6 flex flex-col gap-5 shadow-2xl lg:sticky lg:top-28 lg:row-span-3 lg:self-start"
            >
              <div
                class="relative aspect-video shrink-0 overflow-hidden rounded-lg border border-slate-200 dark:border-[#334155] -mx-2 -mt-2 bg-slate-950 shadow-lg group"
              >
                @if (!promoPlaying()) {
                  @if (course()?.thumbnail) {
                    <img
                      [src]="course()?.thumbnail | mediaUrl"
                      [alt]="course()?.title"
                      class="w-full h-full object-contain transition-transform duration-500 group-hover:scale-[1.02]"
                    />
                  } @else {
                    <div
                      class="w-full h-full bg-gradient-to-br from-[#172033] to-[#060A12] flex items-center justify-center"
                    >
                      <span
                        class="material-symbols-outlined text-5xl text-[#64748B]"
                        >school</span
                      >
                    </div>
                  }
                  @if (course()?.promoVideoUrl) {
                    <button
                      type="button"
                      (click)="playPromo()"
                      class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/25 hover:bg-black/40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#3B82F6]"
                      aria-label="Play course preview"
                    >
                      <span
                        class="w-16 h-16 rounded-full bg-white text-[#111827] flex items-center justify-center shadow-2xl transition-transform group-hover:scale-105"
                      >
                        <span class="material-symbols-outlined text-4xl ml-1"
                          >play_arrow</span
                        >
                      </span>
                      <span
                        class="font-['Inter'] text-sm font-bold text-white drop-shadow"
                        >Preview this course</span
                      >
                    </button>
                  }
                } @else if (isUploadedPromoVideo(course()?.promoVideoUrl)) {
                  <video
                    [src]="course()?.promoVideoUrl | mediaUrl"
                    controls
                    autoplay
                    playsinline
                    class="w-full h-full object-contain bg-black"
                  ></video>
                } @else if (promoEmbedUrl()) {
                  <iframe
                    [src]="promoEmbedUrl()"
                    class="w-full h-full border-0"
                    title="Course introduction video"
                    allow="autoplay; encrypted-media; picture-in-picture"
                    referrerpolicy="strict-origin-when-cross-origin"
                    allowfullscreen
                  ></iframe>
                }
              </div>
              <div
                class="font-['JetBrains_Mono'] text-xs text-[#2563EB] dark:text-[#3B82F6] uppercase tracking-widest font-bold"
              >
                COURSE ACCESS
              </div>

              @if (isEnrolled()) {
                <div
                  class="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 font-['Inter'] text-sm font-semibold text-emerald-800 dark:border-emerald-800/70 dark:bg-emerald-950/35 dark:text-emerald-300"
                >
                  <span class="material-symbols-outlined text-lg"
                    >verified</span
                  >
                  You are enrolled in this course
                </div>
              }

              @if (checkingEnrollment()) {
                <p
                  role="status"
                  class="text-sm text-slate-700 dark:text-slate-300"
                >
                  Checking your course access…
                </p>
              } @else if (enrollmentCheckError()) {
                <p role="alert" class="text-sm text-red-700 dark:text-red-300">
                  {{ enrollmentCheckError() }}
                </p>
                <button
                  type="button"
                  (click)="retryEnrollmentCheck()"
                  class="text-blue-700 dark:text-blue-300 underline"
                >
                  Retry access check
                </button>
              } @else {
                <div class="flex items-baseline justify-between gap-4">
                  @if (isEnrolled()) {
                    <span
                      class="font-['JetBrains_Mono'] text-2xl font-bold text-[#2563EB] dark:text-[#60A5FA]"
                      >OWNED</span
                    >
                    <span
                      class="font-['JetBrains_Mono'] text-[10px] text-emerald-700 dark:text-emerald-300 font-bold text-right uppercase"
                      >Saved to your account</span
                    >
                  } @else if (course()?.isFree) {
                    <span
                      class="font-['JetBrains_Mono'] text-3xl font-bold text-[#2563EB] dark:text-[#3B82F6]"
                      >FREE</span
                    >
                    <span
                      class="font-['JetBrains_Mono'] text-xs text-[#2563EB] dark:text-[#3B82F6] font-semibold text-right"
                      >LOGGED-IN STUDENTS ONLY</span
                    >
                  } @else {
                    <span
                      class="font-['JetBrains_Mono'] text-3xl font-bold text-slate-900 dark:text-white"
                      >₹{{ course()?.price?.toLocaleString('en-IN') }}</span
                    >
                    <span
                      class="font-['JetBrains_Mono'] text-xs text-[#2563EB] dark:text-[#3B82F6] font-semibold"
                      >ONE-TIME OR MEMBERSHIP</span
                    >
                  }
                </div>

                @if (isEnrolled()) {
                  <a
                    [routerLink]="[
                      '/courses',
                      course()?.slug,
                      'watch',
                      getCourseEntryLessonId(),
                    ]"
                    class="w-full text-center font-['JetBrains_Mono'] text-xs uppercase tracking-wider font-bold !text-white bg-[#2563EB] hover:bg-[#1D4ED8] py-4 rounded-lg transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
                  >
                    <span>Go to course</span>
                    <span class="material-symbols-outlined text-sm !text-white"
                      >play_arrow</span
                    >
                  </a>
                } @else if (course()?.isFree) {
                  <button
                    type="button"
                    (click)="enrollInFreeCourse()"
                    [disabled]="isEnrolling()"
                    class="w-full text-center font-['JetBrains_Mono'] text-xs uppercase tracking-wider font-bold !text-white bg-[#2563EB] hover:bg-[#1D4ED8] py-4 rounded-lg transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg disabled:opacity-60"
                  >
                    <span>{{
                      isEnrolling() ? 'Enrolling...' : 'Enroll for free'
                    }}</span>
                    <span class="material-symbols-outlined text-sm !text-white"
                      >arrow_forward</span
                    >
                  </button>
                  @if (enrollmentMessage()) {
                    <p
                      class="font-['Inter'] text-xs text-slate-600 dark:text-[#d9c3af] text-center"
                    >
                      {{ enrollmentMessage() }}
                    </p>
                  }
                } @else {
                  <a
                    [routerLink]="['/checkout']"
                    [queryParams]="{
                      courseId: course()?.id,
                      slug: course()?.slug,
                    }"
                    class="w-full text-center font-['JetBrains_Mono'] text-xs uppercase tracking-wider font-bold !text-white bg-[#2563EB] hover:bg-[#1D4ED8] py-4 rounded-lg transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
                  >
                    <span class="!text-white font-bold"
                      >Enroll in Course Now</span
                    >
                    <span class="material-symbols-outlined text-sm !text-white"
                      >arrow_forward</span
                    >
                  </a>
                }

                @if (!isEnrolled()) {
                  <a
                    routerLink="/membership"
                    class="w-full text-center font-['JetBrains_Mono'] text-xs uppercase tracking-wider font-bold bg-white hover:bg-slate-100 text-slate-800 hover:text-[#2563EB] border-2 border-slate-300 hover:border-[#2563EB] dark:bg-transparent dark:hover:bg-[#3B82F6]/10 dark:text-[#60A5FA] dark:border-[#3B82F6]/50 dark:hover:border-[#3B82F6] py-3.5 rounded-lg transition-all shadow-sm flex items-center justify-center gap-2"
                  >
                    <span
                      class="material-symbols-outlined text-base text-[#2563EB] dark:text-[#3B82F6]"
                      >workspace_premium</span
                    >
                    <span>Get All Courses with Membership</span>
                  </a>
                }
              }
              <div class="border-t border-slate-200 pt-4 dark:border-[#26334B]">
                <h3
                  class="mb-3 font-['Hanken_Grotesk'] text-sm font-bold text-slate-900 dark:text-white"
                >
                  This course includes:
                </h3>
                <ul
                  class="space-y-2.5 font-['Inter'] text-xs text-slate-600 dark:text-slate-300"
                >
                  <li class="flex items-center gap-2">
                    <span
                      class="material-symbols-outlined text-base text-[#2563EB]"
                      >play_lesson</span
                    >{{ getTotalLessons() }} on-demand lessons
                  </li>
                  <li class="flex items-center gap-2">
                    <span
                      class="material-symbols-outlined text-base text-[#2563EB]"
                      >devices</span
                    >Access on mobile, tablet, and desktop
                  </li>
                  <li class="flex items-center gap-2">
                    <span
                      class="material-symbols-outlined text-base text-[#2563EB]"
                      >all_inclusive</span
                    >Lifetime access to purchased courses
                  </li>
                  <li class="flex items-center gap-2">
                    <span
                      class="material-symbols-outlined text-base text-[#2563EB]"
                      >workspace_premium</span
                    >Certificate of completion
                  </li>
                </ul>
              </div>

              <div
                class="text-center font-['Inter'] text-xs text-slate-500 dark:text-[#a18d7b] pt-2 border-t border-slate-200 dark:border-[#1E293B]"
              >
                {{
                  isEnrolled()
                    ? 'Your enrollment remains active when course content is updated.'
                    : 'Instant lifetime access • 30-day money-back guarantee'
                }}
              </div>
            </div>

            <!-- Curriculum & Overview Section -->
            <section class="min-w-0 lg:col-start-1 mt-2 lg:mt-4">
              <div>
                <div
                  class="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6"
                >
                  <div>
                    <h2
                      class="font-['Hanken_Grotesk'] text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2"
                    >
                      <span
                        class="material-symbols-outlined text-[#2563EB] dark:text-[#3B82F6]"
                        >account_tree</span
                      >
                      Course content
                    </h2>
                    <p
                      class="font-['Inter'] text-sm text-slate-600 dark:text-[#a18d7b] mt-2"
                    >
                      {{ getTotalModules() }} sections ·
                      {{ getTotalLessons() }} lessons ·
                      {{ getTotalDurationMinutes() }} minutes of curriculum
                    </p>
                  </div>
                  <button
                    type="button"
                    (click)="toggleAllModules()"
                    class="font-['JetBrains_Mono'] text-xs font-semibold text-[#2563EB] hover:text-[#1D4ED8] dark:text-[#3B82F6] dark:hover:text-[#60A5FA] transition-colors text-left sm:text-right hover:underline"
                  >
                    {{
                      allModulesExpanded()
                        ? 'Collapse all sections'
                        : 'Expand all sections'
                    }}
                  </button>
                </div>

                <div class="flex flex-col gap-4">
                  @for (module of course()?.modules; track module.id) {
                    <div
                      class="bg-white dark:bg-[#121A2B] border border-slate-200 dark:border-[#1E293B] rounded-xl shadow-sm overflow-hidden"
                    >
                      <button
                        type="button"
                        (click)="toggleModule(module.id)"
                        class="w-full p-5 bg-slate-100/90 hover:bg-slate-200/80 dark:bg-[#162032] dark:hover:bg-[#1c2940] flex items-center justify-between gap-4 border-b border-slate-200 dark:border-[#1E293B] text-left transition-colors"
                      >
                        <span class="flex items-center gap-3 min-w-0">
                          <span
                            class="material-symbols-outlined text-[#2563EB] dark:text-[#3B82F6] text-lg shrink-0"
                            >{{
                              isModuleExpanded(module.id)
                                ? 'expand_less'
                                : 'expand_more'
                            }}</span
                          >
                          <span
                            class="font-['Hanken_Grotesk'] text-base font-bold text-slate-900 dark:text-white truncate"
                            >{{ module.title }}</span
                          >
                        </span>
                        <span
                          class="font-['JetBrains_Mono'] text-xs text-[#1D4ED8] dark:text-[#60A5FA] font-semibold bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/60 px-2.5 py-1 rounded-md whitespace-nowrap shrink-0"
                        >
                          {{ module.lessons ? module.lessons.length : 0 }}
                          lectures · {{ getModuleDurationMinutes(module) }}m
                        </span>
                      </button>

                      @if (isModuleExpanded(module.id)) {
                        <div
                          class="divide-y divide-slate-200 dark:divide-[#1E293B]/60 bg-white dark:bg-[#121A2B]"
                        >
                          @for (lesson of module.lessons; track lesson.id) {
                            <a
                              [routerLink]="[
                                '/courses',
                                course()?.slug,
                                'watch',
                                lesson.id,
                              ]"
                              class="p-4 flex items-center justify-between gap-4 hover:bg-blue-50/60 dark:hover:bg-[#1E293B]/40 transition-colors"
                            >
                              <div class="flex items-center gap-3 min-w-0">
                                <span
                                  class="material-symbols-outlined text-[#2563EB] dark:text-[#3B82F6] text-sm shrink-0"
                                  >{{
                                    lesson.isFreePreview
                                      ? 'play_circle'
                                      : 'lock'
                                  }}</span
                                >
                                <span
                                  class="font-['Inter'] text-sm text-slate-800 dark:text-[#e0e3e5] font-medium truncate"
                                  >{{ lesson.title }}</span
                                >
                              </div>

                              <div class="flex items-center gap-3 shrink-0">
                                @if (lesson.isFreePreview) {
                                  <span
                                    class="font-['JetBrains_Mono'] text-[10px] text-[#1D4ED8] dark:text-[#93C5FD] bg-blue-100 dark:bg-blue-900/40 border border-blue-300 dark:border-blue-700/60 px-2 py-0.5 rounded uppercase font-bold tracking-wider"
                                  >
                                    WATCH PREVIEW
                                  </span>
                                }
                                <span
                                  class="font-['JetBrains_Mono'] text-xs text-slate-600 dark:text-[#a18d7b] font-medium"
                                >
                                  {{ Math.round(lesson.duration / 60) }}m
                                </span>
                              </div>
                            </a>
                          }
                        </div>
                      }
                    </div>
                  }
                </div>
              </div>

              <!-- Sidebar: Instructor & Details -->
              <div class="flex flex-col gap-8 mt-8">
                <div
                  class="bg-white dark:bg-[#121A2B] border border-slate-200 dark:border-[#1E293B] rounded-xl shadow-sm p-6"
                >
                  <h3
                    class="font-['JetBrains_Mono'] text-xs uppercase text-[#2563EB] dark:text-[#3B82F6] tracking-wider font-bold mb-4"
                  >
                    THIS COURSE INCLUDES
                  </h3>
                  <div class="flex items-center gap-4 mb-4">
                    <div
                      class="w-12 h-12 rounded-full bg-[#2563EB] dark:bg-[#3B82F6] text-white dark:text-[#040810] font-bold text-xl flex items-center justify-center font-['Hanken_Grotesk'] shadow-sm"
                    >
                      {{ getInstructorInitials() }}
                    </div>
                    <div>
                      <h4
                        class="font-['Hanken_Grotesk'] text-base font-bold text-slate-900 dark:text-white"
                      >
                        Technyks Architect
                      </h4>
                      <p
                        class="font-['Inter'] text-xs text-slate-600 dark:text-[#d9c3af]"
                      >
                        Production engineering curriculum
                      </p>
                    </div>
                  </div>
                  <div
                    class="flex flex-col gap-3 pt-4 border-t border-slate-200 dark:border-[#1E293B] font-['Inter'] text-sm text-slate-700 dark:text-[#d9c3af]"
                  >
                    <div class="flex items-center justify-between gap-3">
                      <span class="text-slate-600 dark:text-slate-400"
                        >On-demand lessons</span
                      ><span
                        class="text-slate-900 dark:text-white font-semibold"
                        >{{ getTotalLessons() }}</span
                      >
                    </div>
                    <div class="flex items-center justify-between gap-3">
                      <span class="text-slate-600 dark:text-slate-400"
                        >Full curriculum</span
                      ><span
                        class="text-slate-900 dark:text-white font-semibold"
                        >{{ getTotalModules() }} sections</span
                      >
                    </div>
                    <div class="flex items-center justify-between gap-3">
                      <span class="text-slate-600 dark:text-slate-400"
                        >Certificate</span
                      ><span
                        class="text-[#2563EB] dark:text-[#3B82F6] font-semibold"
                        >Included</span
                      >
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <!-- Student Reviews -->
            <section class="min-w-0 lg:col-start-1 mt-4 lg:mt-8">
              <div class="max-w-3xl">
                <div
                  class="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6"
                >
                  <div>
                    <h2
                      class="font-['Hanken_Grotesk'] text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2"
                    >
                      <span
                        class="material-symbols-outlined text-[#2563EB] dark:text-[#3B82F6]"
                        >reviews</span
                      >
                      Student reviews
                    </h2>
                    <p
                      class="font-['Inter'] text-sm text-slate-600 dark:text-[#a18d7b] mt-2"
                    >
                      {{ course()?.rating || 0 | number: '1.1-1' }} average
                      rating · {{ course()?.reviewCount || 0 }} reviews
                    </p>
                  </div>
                </div>

                @if (course()?.reviews?.length) {
                  <div class="flex flex-col gap-3">
                    @for (review of course()?.reviews; track review.id) {
                      <article
                        class="bg-white dark:bg-[#121A2B] border border-slate-200 dark:border-[#1E293B] rounded-xl shadow-sm p-5"
                      >
                        <div
                          class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3"
                        >
                          <div class="flex items-center gap-3">
                            <div
                              class="w-9 h-9 rounded-full bg-[#2563EB] dark:bg-[#3B82F6] text-white dark:text-[#040810] font-bold flex items-center justify-center text-sm shadow-sm"
                            >
                              {{ review.user.name.charAt(0).toUpperCase() }}
                            </div>
                            <div>
                              <div
                                class="font-['Hanken_Grotesk'] text-sm font-bold text-slate-900 dark:text-white"
                              >
                                {{ review.user.name }}
                              </div>
                              <div
                                class="font-['JetBrains_Mono'] text-[10px] text-slate-500 dark:text-[#a18d7b]"
                              >
                                {{ review.createdAt | date: 'mediumDate' }}
                              </div>
                            </div>
                          </div>
                          <div
                            class="font-['JetBrains_Mono'] text-sm text-amber-500 dark:text-[#3B82F6]"
                            [attr.aria-label]="
                              review.rating + ' out of 5 stars'
                            "
                          >
                            {{ '★'.repeat(review.rating)
                            }}{{ '☆'.repeat(5 - review.rating) }}
                          </div>
                        </div>
                        <p
                          class="font-['Inter'] text-sm text-slate-700 dark:text-[#d9c3af] leading-relaxed"
                        >
                          {{ review.comment }}
                        </p>
                      </article>
                    }
                  </div>
                } @else {
                  <div
                    class="bg-white dark:bg-[#121A2B] border border-dashed border-slate-300 dark:border-[#3B82F6]/50 rounded-xl p-6 font-['Inter'] text-sm text-slate-600 dark:text-[#a18d7b]"
                  >
                    No reviews yet. Be the first enrolled student to share your
                    experience.
                  </div>
                }

                <div
                  class="bg-white dark:bg-[#121A2B] border border-slate-200 dark:border-[#1E293B] rounded-xl shadow-sm p-6 mt-6"
                >
                  @if (authService.isAuthenticated() && isEnrolled()) {
                    <h3
                      class="font-['Hanken_Grotesk'] text-lg font-bold text-slate-900 dark:text-white mb-4"
                    >
                      Share your review
                    </h3>
                    <div
                      class="flex items-center gap-2 mb-4"
                      role="radiogroup"
                      aria-label="Course rating"
                    >
                      @for (star of [1, 2, 3, 4, 5]; track star) {
                        <button
                          type="button"
                          (click)="reviewRating = star"
                          [attr.aria-label]="star + ' stars'"
                          [class.text-amber-500]="star <= reviewRating"
                          [class.text-slate-300]="star > reviewRating"
                          [class.dark:text-[#3B82F6]]="star <= reviewRating"
                          [class.dark:text-[#a18d7b]]="star > reviewRating"
                          class="text-2xl leading-none hover:text-amber-500 dark:hover:text-[#3B82F6] transition-colors"
                        >
                          ★
                        </button>
                      }
                      <span
                        class="font-['JetBrains_Mono'] text-xs text-slate-600 dark:text-[#a18d7b] ml-2"
                        >{{ reviewRating }}/5</span
                      >
                    </div>
                    <textarea
                      [(ngModel)]="reviewComment"
                      rows="4"
                      maxlength="2000"
                      placeholder="What did you think about this course?"
                      class="w-full bg-slate-50 dark:bg-[#040810] border border-slate-300 dark:border-[#1E293B] focus:border-[#2563EB] dark:focus:border-[#3B82F6] focus:bg-white focus:outline-none rounded-lg px-4 py-3 text-sm text-slate-900 dark:text-white font-['Inter'] mb-4"
                    ></textarea>
                    <div class="flex flex-wrap items-center gap-4">
                      <button
                        type="button"
                        (click)="submitReview()"
                        [disabled]="
                          isSubmittingReview() ||
                          reviewRating === 0 ||
                          reviewComment.trim().length < 10
                        "
                        class="font-['JetBrains_Mono'] text-xs font-bold uppercase !text-white bg-[#2563EB] hover:bg-[#1D4ED8] px-5 py-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all"
                      >
                        {{
                          isSubmittingReview() ? 'Saving...' : 'Publish review'
                        }}
                      </button>
                      @if (reviewMessage()) {
                        <span
                          class="font-['Inter'] text-xs text-[#2563EB] dark:text-[#3B82F6] font-semibold"
                          >{{ reviewMessage() }}</span
                        >
                      }
                    </div>
                  } @else if (!authService.isAuthenticated()) {
                    <p
                      class="font-['Inter'] text-sm text-slate-600 dark:text-[#d9c3af]"
                    >
                      <a
                        routerLink="/auth/login"
                        [queryParams]="{ returnUrl: router.url }"
                        class="text-[#2563EB] dark:text-[#3B82F6] font-semibold hover:underline"
                        >Sign in</a
                      >
                      and enroll to leave a course review.
                    </p>
                  } @else {
                    <p
                      class="font-['Inter'] text-sm text-slate-600 dark:text-[#d9c3af]"
                    >
                      Enroll in this course to leave a review.
                    </p>
                  }
                </div>
              </div>
            </section>
          </div>
        </section>
      </div>
    }
  `,
})
export class CourseDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  router = inject(Router);
  private coursesService = inject(CoursesService);
  private titleService = inject(Title);
  private metaService = inject(Meta);
  private sanitizer = inject(DomSanitizer);
  authService = inject(AuthService);
  private enrollmentsService = inject(EnrollmentsService);

  course = signal<Course | null>(null);
  isLoading = signal(true);
  expandedModules = signal<Set<string>>(new Set());
  promoEmbedUrl = signal<SafeResourceUrl | null>(null);
  promoPlaying = signal(false);
  isEnrolled = signal(false);
  checkingEnrollment = signal(false);
  enrollmentCheckError = signal('');
  resumeLessonId = signal('');
  isEnrolling = signal(false);
  enrollmentMessage = signal('');
  reviewRating = 0;
  reviewComment = '';
  isSubmittingReview = signal(false);
  reviewMessage = signal('');
  Math = Math;

  ngOnInit() {
    this.route.params.subscribe((params) => {
      const slug = params['slug'];
      if (slug) {
        this.isLoading.set(true);
        this.course.set(null);
        this.isEnrolled.set(false);
        this.resumeLessonId.set('');
        this.enrollmentMessage.set('');
        this.enrollmentCheckError.set('');
        this.coursesService.getCourseBySlug(slug).subscribe({
          next: (data) => {
            if (this.route.snapshot.paramMap.get('slug') !== slug) return;
            this.course.set(data);
            this.loadEnrollmentStatus(data);
            this.promoPlaying.set(false);
            this.promoEmbedUrl.set(this.toPromoEmbedUrl(data.promoVideoUrl));
            this.expandedModules.set(
              new Set(
                data.modules?.slice(0, 1).map((module) => module.id) || [],
              ),
            );
            this.isLoading.set(false);
            this.titleService.setTitle(`${data.title} - Technyks Academy`);
            this.metaService.updateTag({
              name: 'description',
              content: data.subtitle,
            });
          },
          error: () => this.isLoading.set(false),
        });
      }
    });
  }

  private loadEnrollmentStatus(course: Course) {
    if (!this.authService.isAuthenticated()) return;
    this.checkingEnrollment.set(true);
    this.enrollmentCheckError.set('');
    this.enrollmentsService.getCourseAccess(course.id).subscribe({
      next: ({ enrolled, enrollment }) => {
        if (this.course()?.id !== course.id) return;
        this.checkingEnrollment.set(false);
        this.isEnrolled.set(enrolled);
        if (enrollment?.lastWatchedLessonId) {
          const lessonStillExists = course.modules?.some((module) =>
            module.lessons?.some(
              (lesson) => lesson.id === enrollment.lastWatchedLessonId,
            ),
          );
          this.resumeLessonId.set(
            lessonStillExists ? enrollment.lastWatchedLessonId : '',
          );
        } else {
          this.resumeLessonId.set('');
        }
      },
      error: () => {
        if (this.course()?.id !== course.id) return;
        this.checkingEnrollment.set(false);
        this.enrollmentCheckError.set(
          'We could not verify your enrollment. Please retry; you do not need to buy the course again.',
        );
      },
    });
  }

  retryEnrollmentCheck() {
    const course = this.course();
    if (course) this.loadEnrollmentStatus(course);
  }

  getFirstLessonId(): string {
    return (
      this.course()?.modules?.find((module) => module.lessons?.length)
        ?.lessons[0]?.id || ''
    );
  }

  getCourseEntryLessonId(): string {
    return this.resumeLessonId() || this.getFirstLessonId();
  }

  enrollInFreeCourse() {
    const course = this.course();
    if (!course?.isFree) return;
    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/auth/login'], {
        queryParams: { returnUrl: this.router.url },
      });
      return;
    }

    this.isEnrolling.set(true);
    this.enrollmentMessage.set('');
    this.enrollmentsService.enrollInFreeCourse(course.id).subscribe({
      next: () => {
        this.isEnrolled.set(true);
        this.isEnrolling.set(false);
        this.enrollmentMessage.set('You are enrolled. Your lessons are ready.');
      },
      error: (error) => {
        this.isEnrolling.set(false);
        this.enrollmentMessage.set(
          error?.error?.message || 'Free enrollment could not be completed.',
        );
      },
    });
  }

  submitReview() {
    const course = this.course();
    const comment = this.reviewComment.trim();
    if (
      !course ||
      !this.isEnrolled() ||
      this.reviewRating < 1 ||
      comment.length < 10
    )
      return;

    this.isSubmittingReview.set(true);
    this.reviewMessage.set('');
    this.coursesService
      .submitReview(course.id, { rating: this.reviewRating, comment })
      .subscribe({
        next: (review) => {
          const reviews = [
            review,
            ...(course.reviews || []).filter(
              (candidate) => candidate.id !== review.id,
            ),
          ];
          const rating = Number(
            (
              reviews.reduce((total, item) => total + item.rating, 0) /
              reviews.length
            ).toFixed(1),
          );
          this.course.set({
            ...course,
            reviews,
            rating,
            reviewCount: reviews.length,
          });
          this.reviewRating = 0;
          this.reviewComment = '';
          this.isSubmittingReview.set(false);
          this.reviewMessage.set('Your review has been published.');
        },
        error: (error) => {
          this.isSubmittingReview.set(false);
          this.reviewMessage.set(
            error?.error?.message || 'Review could not be saved.',
          );
        },
      });
  }

  getTotalDurationMinutes(): number {
    const c = this.course();
    if (!c || !c.modules) return 0;
    let total = 0;
    c.modules.forEach((m) =>
      m.lessons?.forEach((l) => (total += l.duration || 0)),
    );
    return Math.round(total / 60);
  }

  getTotalLessons(): number {
    const c = this.course();
    if (!c || !c.modules) return 0;
    let count = 0;
    c.modules.forEach((m) => (count += m.lessons?.length || 0));
    return count;
  }

  getTotalModules(): number {
    return this.course()?.modules?.length || 0;
  }

  getModuleDurationMinutes(module: Course['modules'][number]): number {
    return Math.round(
      (module.lessons || []).reduce(
        (total, lesson) => total + (lesson.duration || 0),
        0,
      ) / 60,
    );
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

  getInstructorInitials(): string {
    return 'TA';
  }

  isUploadedPromoVideo(url?: string | null): boolean {
    return Boolean(
      url &&
        (url.startsWith('data:video/') ||
          /\.(mp4|webm|ogg|mov)(?:\?|$)/i.test(url)),
    );
  }

  playPromo() {
    const value = this.course()?.promoVideoUrl;
    if (!value) return;
    this.promoEmbedUrl.set(this.toPromoEmbedUrl(value, true));
    this.promoPlaying.set(true);
  }

  private toPromoEmbedUrl(
    value?: string | null,
    autoplay = false,
  ): SafeResourceUrl | null {
    if (!value || this.isUploadedPromoVideo(value)) return null;
    try {
      const url = new URL(value);
      if (url.hostname === 'youtu.be') {
        const videoId = url.pathname.split('/').filter(Boolean)[0];
        return videoId
          ? this.sanitizer.bypassSecurityTrustResourceUrl(
              this.youtubeEmbedUrl(videoId, autoplay),
            )
          : null;
      }
      if (
        url.hostname === 'youtube.com' ||
        url.hostname.endsWith('.youtube.com')
      ) {
        const videoId =
          url.searchParams.get('v') ||
          url.pathname.match(/^\/(?:embed|shorts)\/([A-Za-z0-9_-]{11})/)?.[1];
        return videoId
          ? this.sanitizer.bypassSecurityTrustResourceUrl(
              this.youtubeEmbedUrl(videoId, autoplay),
            )
          : null;
      }
      if (url.hostname === 'vimeo.com' || url.hostname.endsWith('.vimeo.com')) {
        const videoId = url.pathname
          .split('/')
          .filter(Boolean)
          .find((part) => /^\d+$/.test(part));
        return videoId
          ? this.sanitizer.bypassSecurityTrustResourceUrl(
              `https://player.vimeo.com/video/${videoId}${autoplay ? '?autoplay=1' : ''}`,
            )
          : null;
      }
    } catch {
      return null;
    }
    return null;
  }

  private youtubeEmbedUrl(videoId: string, autoplay: boolean) {
    const params = new URLSearchParams({
      controls: '1',
      rel: '0',
      playsinline: '1',
      iv_load_policy: '3',
      cc_load_policy: '0',
      color: 'white',
    });
    if (autoplay) params.set('autoplay', '1');
    return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
  }
}

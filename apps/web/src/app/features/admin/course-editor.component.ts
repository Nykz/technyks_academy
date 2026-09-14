import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import {
  CoursesService,
  Course,
  Module,
  Lesson,
} from '../../core/services/courses.service';
import {
  AdminService,
  Coupon,
  CourseStudent,
} from '../../core/services/admin.service';
import { MediaUrlPipe } from '../../core/pipes/media-url.pipe';

@Component({
  selector: 'app-course-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, MediaUrlPipe],
  template: `
    <div class="admin-shell min-h-screen bg-[#040810] text-[#e0e3e5] flex flex-col overflow-x-hidden">
      <!-- Top Header Navigation & Status Bar -->
      <div class="bg-[#121A2B] border-b border-[#1E293B] px-4 sm:px-6 py-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4 z-30 shadow-md">
        <div class="min-w-0 flex flex-wrap items-center gap-2 sm:gap-4">
          <a routerLink="/admin" class="text-[#a18d7b] hover:text-white flex items-center gap-1 font-['JetBrains_Mono'] text-xs">
            <span class="material-symbols-outlined text-sm">arrow_back</span>
            Back to Courses
          </a>
          <span class="text-[#1E293B]">|</span>
          <h1 class="min-w-0 max-w-full sm:max-w-md font-['Hanken_Grotesk'] text-base sm:text-lg font-bold text-white truncate">
            {{ course()?.title || 'Loading Course...' }}
          </h1>
          <span
            [class.bg-[#3B82F6]/20]="course()?.status === 'LIVE'"
            [class.text-[#3B82F6]]="course()?.status === 'LIVE'"
            [class.bg-[#3B82F6]/20]="course()?.status === 'DRAFT'"
            [class.text-[#3B82F6]]="course()?.status === 'DRAFT'"
            class="font-['JetBrains_Mono'] text-[10px] uppercase font-bold px-2.5 py-0.5 rounded border border-current"
          >
            {{ course()?.status || 'DRAFT' }}
          </span>
        </div>

        <div class="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 sm:gap-3">
          @if (saveMessage()) {
            <span class="save-badge-in col-span-2 sm:order-first flex items-center gap-1.5 font-['JetBrains_Mono'] text-[11px] sm:text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-500/50 px-3.5 py-1.5 rounded-lg shadow-sm">
              <span class="material-symbols-outlined text-sm">check_circle</span>
              {{ saveMessage() }}
            </span>
          }
          <!-- LIVE / DRAFT Status Toggle Button -->
          <button
            (click)="togglePublishStatus()"
            class="col-span-2 sm:col-span-1 justify-center font-['JetBrains_Mono'] text-[11px] sm:text-xs font-bold uppercase !text-white bg-[#2563EB] hover:bg-[#1D4ED8] px-4 py-2.5 rounded-lg transition-all shadow flex items-center gap-1.5"
          >
            <span class="material-symbols-outlined text-sm">
              {{ course()?.status === 'LIVE' ? 'public' : 'lock' }}
            </span>
            {{ course()?.status === 'LIVE' ? 'Course is LIVE (Public)' : 'Make Course LIVE (Public)' }}
          </button>

          <a [routerLink]="['/courses', course()?.slug]" target="_blank" class="justify-center font-['JetBrains_Mono'] text-[11px] sm:text-xs text-[#3B82F6] hover:underline flex items-center gap-1 px-2">
            Preview Student View <span class="material-symbols-outlined text-sm">open_in_new</span>
          </a>

          <button (click)="saveAllChanges()" [disabled]="isSaving()" class="admin-action-primary justify-center font-['JetBrains_Mono'] text-[11px] sm:text-xs font-bold uppercase !text-white bg-[#2563EB] hover:bg-[#1D4ED8] px-5 py-2.5 rounded-lg transition-all shadow-lg flex items-center gap-1 disabled:opacity-60 disabled:cursor-wait">
            <span class="material-symbols-outlined text-sm" [class.animate-spin]="isSaving()">{{ isSaving() ? 'progress_activity' : 'save' }}</span>
            {{ isSaving() ? 'Saving…' : 'Save Changes' }}
          </button>

          <button
            type="button"
            (click)="deleteCurrentCourse()"
            class="font-['JetBrains_Mono'] text-[11px] sm:text-xs font-bold uppercase text-[#ffb4ab] border border-[#ffb4ab]/40 hover:bg-[#ffb4ab]/10 px-4 py-2.5 rounded-lg transition-all"
          >
            Delete Course
          </button>
        </div>
      </div>

      <!-- Main Udemy Studio Layout (Left Sidebar + Content Area) -->
      <div class="min-w-0 flex-grow flex flex-col lg:flex-row max-w-7xl w-full mx-auto px-3 sm:px-4 lg:px-8 py-5 sm:py-8 gap-5 lg:gap-8">
        
        <!-- Left Udemy Navigation Sidebar -->
        <aside class="w-full lg:w-64 shrink-0 grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-col gap-4 lg:gap-6 font-['Inter'] text-xs">
          <div>
            <div class="font-['JetBrains_Mono'] text-[11px] font-bold text-[#a18d7b] uppercase tracking-wider mb-2">Course Editing</div>
            <nav class="flex flex-col gap-1">
              <button
                (click)="activeTab.set('curriculum')"
                [class.bg-[#121A2B]]="activeTab() === 'curriculum'"
                [class.text-[#3B82F6]]="activeTab() === 'curriculum'"
                [class.border-l-4]="activeTab() === 'curriculum'"
                [class.border-[#3B82F6]]="activeTab() === 'curriculum'"
                [class.text-[#d9c3af]]="activeTab() !== 'curriculum'"
                class="text-left px-4 py-2.5 rounded hover:bg-[#121A2B]/60 transition-all font-medium flex items-center justify-between"
              >
                <span>Curriculum</span>
                <span class="material-symbols-outlined text-sm">menu_book</span>
              </button>

              <button
                (click)="activeTab.set('landing')"
                [class.bg-[#121A2B]]="activeTab() === 'landing'"
                [class.text-[#3B82F6]]="activeTab() === 'landing'"
                [class.border-l-4]="activeTab() === 'landing'"
                [class.border-[#3B82F6]]="activeTab() === 'landing'"
                [class.text-[#d9c3af]]="activeTab() !== 'landing'"
                class="text-left px-4 py-2.5 rounded hover:bg-[#121A2B]/60 transition-all font-medium flex items-center justify-between"
              >
                <span>Course Landing Page</span>
                <span class="material-symbols-outlined text-sm">article</span>
              </button>
            </nav>
          </div>

          <div class="border-t border-[#1E293B] pt-4">
            <div class="font-['JetBrains_Mono'] text-[11px] font-bold text-[#a18d7b] uppercase tracking-wider mb-2">Course Management</div>
            <nav class="flex flex-col gap-1">
              <button
                (click)="activeTab.set('pricing')"
                [class.bg-[#121A2B]]="activeTab() === 'pricing'"
                [class.text-[#3B82F6]]="activeTab() === 'pricing'"
                [class.text-[#d9c3af]]="activeTab() !== 'pricing'"
                class="text-left px-4 py-2.5 rounded hover:bg-[#121A2B]/60 transition-all font-medium flex items-center justify-between"
              >
                <span>Pricing</span>
                <span class="material-symbols-outlined text-sm">payments</span>
              </button>

              <button
                (click)="activeTab.set('promotions')"
                [class.bg-[#121A2B]]="activeTab() === 'promotions'"
                [class.text-[#3B82F6]]="activeTab() === 'promotions'"
                [class.border-l-4]="activeTab() === 'promotions'"
                [class.border-[#3B82F6]]="activeTab() === 'promotions'"
                [class.text-[#d9c3af]]="activeTab() !== 'promotions'"
                class="text-left px-4 py-2.5 rounded hover:bg-[#121A2B]/60 transition-all font-medium flex items-center justify-between"
              >
                <span>Promotions & Coupons</span>
                <span class="material-symbols-outlined text-sm">confirmation_number</span>
              </button>
              <button
                (click)="openStudentsTab()"
                [class.bg-[#121A2B]]="activeTab() === 'students'"
                [class.text-[#3B82F6]]="activeTab() === 'students'"
                [class.border-l-4]="activeTab() === 'students'"
                [class.border-[#3B82F6]]="activeTab() === 'students'"
                [class.text-[#d9c3af]]="activeTab() !== 'students'"
                class="text-left px-4 py-2.5 rounded hover:bg-[#121A2B]/60 transition-all font-medium flex items-center justify-between"
              >
                <span>Enrolled Students</span>
                <span class="material-symbols-outlined text-sm">groups</span>
              </button>
            </nav>
          </div>
        </aside>

        <!-- Right Main Studio Content Area -->
        <main class="min-w-0 flex-grow bg-[#121A2B] technical-border rounded-xl p-4 sm:p-6 lg:p-8 min-h-[650px]">
          @if (isLoading()) {
            <div class="animate-pulse space-y-7" aria-label="Loading course editor">
              <div class="h-8 w-56 rounded bg-[#1E293B]"></div>
              <div class="h-3 w-3/4 rounded bg-[#1E293B]"></div>
              @for (item of [1, 2, 3, 4]; track item) {
                <div class="rounded-xl border border-[#1E293B] bg-[#040810]/40 p-5 space-y-4">
                  <div class="h-5 w-1/3 rounded bg-[#1E293B]"></div>
                  <div class="h-11 rounded bg-[#1E293B]/70"></div>
                  <div class="h-11 rounded bg-[#1E293B]/70"></div>
                </div>
              }
            </div>
          } @else {
          <!-- TAB 1: CURRICULUM BUILDER -->
          @if (activeTab() === 'curriculum') {
            <div>
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1E293B] pb-6 mb-6">
                <div>
                  <h2 class="font-['Hanken_Grotesk'] text-2xl font-bold text-white">Curriculum</h2>
                  <p class="font-['Inter'] text-xs text-[#d9c3af] mt-1">
                    Create your course in sections, each focused on a single learning objective. Add video lectures and preview toggles, then attach a Bunny ID or a protected YouTube reference for each lesson.
                  </p>
                </div>
                <button (click)="addSection()" class="font-['JetBrains_Mono'] text-xs text-[#3B82F6] border border-[#3B82F6]/40 hover:bg-[#3B82F6]/10 px-4 py-2 rounded flex items-center gap-1">
                  <span class="material-symbols-outlined text-sm">add</span> Add Section
                </button>
              </div>

              <!-- Sections List Accordion -->
              <div class="flex flex-col gap-6">
                @for (module of modules(); track module.id; let sIdx = $index) {
                  <div class="min-w-0 border border-[#1E293B] bg-[#040810]/50 rounded-xl p-3 sm:p-5">
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 border-b border-[#1E293B]/60 pb-3">
                      <div class="min-w-0 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 flex-grow max-w-xl">
                        <span class="font-['JetBrains_Mono'] text-xs font-bold text-[#3B82F6]">Section {{ sIdx + 1 }}:</span>
                        <input
                          type="text"
                          [(ngModel)]="module.title"
                          placeholder="Section Title..."
                          class="min-w-0 w-full bg-[#121A2B] border border-[#1E293B] focus:border-[#3B82F6] focus:outline-none rounded-lg px-3 py-2 text-xs text-white font-['Hanken_Grotesk'] font-bold flex-grow"
                        />
                      </div>
                      <button (click)="deleteSection(sIdx)" class="self-start sm:self-auto text-[#ffb4ab] hover:underline font-['JetBrains_Mono'] text-xs whitespace-nowrap">
                        Remove Section
                      </button>
                    </div>

                    <!-- Lectures List inside Section -->
                    <div class="min-w-0 flex flex-col gap-3 sm:pl-4 sm:border-l-2 border-[#1E293B]">
                      @for (lesson of module.lessons; track lesson.id; let lIdx = $index) {
                        <div class="min-w-0 bg-[#121A2B] border border-[#1E293B] rounded-lg p-3 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-3">
                          <div class="min-w-0 flex items-start sm:items-center gap-2 sm:gap-3 flex-grow w-full xl:w-auto">
                            <span class="material-symbols-outlined text-[#3B82F6] text-base">play_circle</span>
                            <div class="min-w-0 flex flex-col flex-grow">
                              <input
                                type="text"
                                [(ngModel)]="lesson.title"
                                placeholder="Lecture Title..."
                                class="bg-[#040810] border border-[#1E293B] rounded px-2.5 py-1 text-xs text-white font-['Inter'] font-semibold"
                              />
                              <div class="flex flex-wrap items-center gap-2 mt-2">
                                <span class="font-['JetBrains_Mono'] text-[10px] text-[#a18d7b]">Video source reference (optional):</span>
                                <input
                                  type="text"
                                  [(ngModel)]="lesson.videoAssetRef"
                                  placeholder="youtube:VIDEO_ID or Bunny video ID"
                                  class="min-w-[180px] flex-1 bg-[#040810] border border-[#1E293B] rounded px-2 py-1 text-[10px] text-[#3B82F6] font-['JetBrains_Mono']"
                                />
                                <span class="font-['JetBrains_Mono'] text-[10px] text-[#a18d7b] ml-1">Minutes:</span>
                                <input
                                  type="number"
                                  min="0"
                                  [ngModel]="Math.round(lesson.duration / 60)"
                                  (ngModelChange)="updateLessonDuration(sIdx, lIdx, $event)"
                                  class="w-16 bg-[#040810] border border-[#1E293B] rounded px-2 py-0.5 text-[10px] text-white font-['JetBrains_Mono']"
                                />
                              </div>
                            </div>
                          </div>

                          <div class="flex items-center gap-4 shrink-0 w-full xl:w-auto justify-between xl:justify-end">
                            <label class="inline-flex items-center gap-1.5 cursor-pointer font-['JetBrains_Mono'] text-[11px] text-[#d9c3af]">
                              <input
                                type="checkbox"
                                [(ngModel)]="lesson.isFreePreview"
                                class="rounded bg-[#040810] border-[#1E293B] text-[#3B82F6] focus:ring-0"
                              />
                              <span>(Preview enabled)</span>
                            </label>

                            <button (click)="deleteLesson(sIdx, lIdx)" class="text-[#ffb4ab] hover:underline font-['JetBrains_Mono'] text-[11px]">
                              Delete
                            </button>
                          </div>
                        </div>
                      }

                      <!-- Add Lecture Button -->
                      <button (click)="addLesson(sIdx)" class="w-fit font-['JetBrains_Mono'] text-xs text-[#3B82F6] hover:underline flex items-center gap-1 mt-2">
                        <span class="material-symbols-outlined text-sm">add_circle</span> + Curriculum Item (Lecture)
                      </button>
                    </div>
                  </div>
                }
              </div>
            </div>
          }

          <!-- TAB 2: COURSE LANDING PAGE -->
          @if (activeTab() === 'landing') {
            <div class="flex flex-col gap-6 max-w-3xl">
              <div class="border-b border-[#1E293B] pb-4">
                <h2 class="font-['Hanken_Grotesk'] text-2xl font-bold text-white">Course landing page</h2>
                <p class="font-['Inter'] text-xs text-[#d9c3af] mt-1">
                  Your course landing page is crucial to your success. Make it compelling to demonstrate why someone would want to enroll in your course.
                </p>
              </div>

              <div>
                <label for="course-title" class="block font-['JetBrains_Mono'] text-xs text-[#a18d7b] uppercase mb-1">Course title</label>
                <input
                  id="course-title"
                  type="text"
                  [ngModel]="course()?.title"
                  (ngModelChange)="updateCourseField('title', $event)"
                  class="w-full bg-[#040810] border border-[#1E293B] rounded px-4 py-2.5 text-xs text-white font-['Hanken_Grotesk'] font-bold"
                />
              </div>

              <div>
                <label for="course-subtitle" class="block font-['JetBrains_Mono'] text-xs text-[#a18d7b] uppercase mb-1">Course subtitle</label>
                <input
                  id="course-subtitle"
                  type="text"
                  [ngModel]="course()?.subtitle"
                  (ngModelChange)="updateCourseField('subtitle', $event)"
                  class="w-full bg-[#040810] border border-[#1E293B] rounded px-4 py-2.5 text-xs text-white font-['Inter']"
                />
              </div>

              <div>
                <label for="course-description" class="block font-['JetBrains_Mono'] text-xs text-[#a18d7b] uppercase mb-1">Course description</label>
                <textarea
                  id="course-description"
                  rows="6"
                  [ngModel]="course()?.description"
                  (ngModelChange)="updateCourseField('description', $event)"
                  class="w-full bg-[#040810] border border-[#1E293B] rounded p-4 text-xs text-white font-['Inter'] leading-relaxed"
                ></textarea>
              </div>

              <!-- Course Category, Level & Price Settings -->
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-[#1E293B] pt-6">
                <div>
                  <label for="course-category" class="block font-['JetBrains_Mono'] text-xs text-[#a18d7b] uppercase mb-1">
                    Subject Category
                  </label>
                  <input
                    id="course-category"
                    list="course-category-options"
                    [ngModel]="course()?.category"
                    (ngModelChange)="updateCourseField('category', $event)"
                    placeholder="e.g. AI & Agents"
                    class="w-full bg-[#040810] border border-[#1E293B] focus:border-[#3B82F6] rounded-lg px-4 py-2.5 text-xs text-white outline-none font-['JetBrains_Mono']"
                  />
                  <datalist id="course-category-options">
                    @for (category of suggestedCategories; track category) {
                      <option [value]="category"></option>
                    }
                  </datalist>
                  <p class="mt-1.5 font-['Inter'] text-[11px] text-[#a18d7b]">Choose a suggestion or type a new category.</p>
                </div>

                <div>
                  <label for="course-level" class="block font-['JetBrains_Mono'] text-xs text-[#a18d7b] uppercase mb-1">
                    Course Level
                  </label>
                  <select
                    id="course-level"
                    [ngModel]="course()?.level"
                    (ngModelChange)="updateCourseField('level', $event)"
                    class="w-full bg-[#040810] border border-[#1E293B] focus:border-[#3B82F6] rounded-lg px-4 py-2.5 text-xs text-white outline-none font-['JetBrains_Mono']"
                  >
                    <option value="Beginner">Beginner</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced</option>
                    <option value="All Levels">All Levels</option>
                  </select>
                </div>

                <div>
                  <label for="course-price" class="block font-['JetBrains_Mono'] text-xs text-[#a18d7b] uppercase mb-1">
                    Course Price (₹)
                  </label>
                  <input
                    id="course-price"
                    type="number"
                    min="0"
                    [ngModel]="course()?.price"
                    (ngModelChange)="updateCourseField('price', $event)"
                    placeholder="e.g. 4999 (0 for free)"
                    class="w-full bg-[#040810] border border-[#1E293B] focus:border-[#3B82F6] rounded-lg px-4 py-2.5 text-xs text-[#3B82F6] font-bold outline-none font-['JetBrains_Mono']"
                  />
                </div>

                <div class="flex flex-col justify-end pb-2">
                  <label class="inline-flex items-center gap-2 cursor-pointer font-['Inter'] text-xs text-white">
                    <input
                      type="checkbox"
                      [checked]="course()?.isFree"
                      (change)="updateCourseField('isFree', $any($event.target).checked)"
                      class="rounded bg-[#040810] border-[#1E293B] text-[#3B82F6] focus:ring-0"
                    />
                    <span>Free Course (No payment required)</span>
                  </label>
                </div>
              </div>

              <!-- Course Image Upload & Preview Card -->
              <div class="border-t border-[#1E293B] pt-6">
                <div class="flex items-center justify-between mb-4"><div><h3 class="font-['Hanken_Grotesk'] text-base font-bold text-white">Course image</h3><p class="font-['Inter'] text-xs text-[#a18d7b] mt-1">Shown in search results and behind the preview play button.</p></div>@if (course()?.thumbnail) {<button type="button" (click)="removeMedia('thumbnail')" [disabled]="removingMedia() === 'thumbnail'" class="font-['JetBrains_Mono'] text-[11px] text-[#ffb4ab] border border-[#ffb4ab]/40 rounded px-3 py-2 hover:bg-[#ffb4ab]/10 disabled:opacity-50">{{ removingMedia() === 'thumbnail' ? 'Removing…' : 'Remove image' }}</button>}</div>
                <div class="grid grid-cols-1 md:grid-cols-[minmax(0,1.15fr)_minmax(260px,0.85fr)] gap-6 items-stretch">
                  <div class="relative aspect-[16/9] bg-[#040810] border border-[#1E293B] rounded-xl overflow-hidden flex items-center justify-center shadow-inner">
                    @if (course()?.thumbnail) {<img [src]="course()?.thumbnail | mediaUrl" [alt]="course()?.title" class="w-full h-full object-cover" />} @else {<div class="text-center text-[#a18d7b]"><span class="material-symbols-outlined text-5xl">image</span><p class="text-xs mt-2">No course image</p></div>}
                    @if (isUploadingImage()) {<div class="absolute inset-0 bg-[#040810]/85 backdrop-blur-sm grid place-items-center"><div class="text-center"><span class="material-symbols-outlined text-3xl text-[#3B82F6] animate-spin">progress_activity</span><p class="font-['JetBrains_Mono'] text-[11px] text-white mt-2">Uploading image…</p></div></div>}
                  </div>
                  <div class="rounded-xl border border-[#1E293B] bg-[#040810]/45 p-5 flex flex-col justify-between gap-4">
                    <div><p class="font-['Inter'] text-xs text-[#d9c3af] leading-relaxed">Use a clean 16:9 image. Recommended size: <strong class="text-white">750 × 422 px</strong>. JPG, PNG, WebP, or GIF up to 10 MB.</p><p class="font-['JetBrains_Mono'] text-[10px] text-[#3B82F6] mt-3">Uploads are stored securely and saved to this course automatically.</p></div>
                    <label [class.pointer-events-none]="isUploadingImage()" class="w-full text-center font-['JetBrains_Mono'] text-xs font-bold text-[#040810] bg-[#3B82F6] hover:bg-[#2563eb] px-4 py-3 rounded-lg cursor-pointer transition-colors disabled:opacity-60">{{ course()?.thumbnail ? 'Replace image' : 'Upload image' }}<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" class="hidden" (change)="handleThumbnailFile($event)" /></label>
                  </div>
                </div>
              </div>

              <!-- Promotional Video Upload & Player Box -->
              <div class="border-t border-[#1E293B] pt-6">
                <div class="flex items-center justify-between mb-4"><div><h3 class="font-['Hanken_Grotesk'] text-base font-bold text-white">Promotional video</h3><p class="font-['Inter'] text-xs text-[#a18d7b] mt-1">This plays directly inside the landing-page preview card.</p></div>@if (course()?.promoVideoUrl) {<button type="button" (click)="removeMedia('promoVideoUrl')" [disabled]="removingMedia() === 'promoVideoUrl'" class="font-['JetBrains_Mono'] text-[11px] text-[#ffb4ab] border border-[#ffb4ab]/40 rounded px-3 py-2 hover:bg-[#ffb4ab]/10 disabled:opacity-50">{{ removingMedia() === 'promoVideoUrl' ? 'Removing…' : 'Remove video' }}</button>}</div>
                <div class="grid grid-cols-1 md:grid-cols-[minmax(0,1.15fr)_minmax(260px,0.85fr)] gap-6 items-stretch">
                  <div class="relative aspect-video bg-black border border-[#1E293B] rounded-xl overflow-hidden grid place-items-center">
                    @if (isDirectPromoVideo(course()?.promoVideoUrl)) {<video [src]="course()?.promoVideoUrl | mediaUrl" controls class="w-full h-full object-contain"></video>} @else if (promoEmbedUrl()) {<iframe [src]="promoEmbedUrl()" title="Course promotional video preview" class="w-full h-full border-0" allow="autoplay; encrypted-media; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>} @else {<div class="text-center text-[#a18d7b]"><span class="material-symbols-outlined text-5xl">smart_display</span><p class="text-xs mt-2">No promotional video</p></div>}
                    @if (isUploadingVideo()) {<div class="absolute inset-0 bg-[#040810]/90 backdrop-blur-sm grid place-items-center"><div class="text-center"><span class="material-symbols-outlined text-3xl text-[#3B82F6] animate-spin">progress_activity</span><p class="font-['JetBrains_Mono'] text-[11px] text-white mt-2">Uploading video…</p></div></div>}
                  </div>
                  <div class="rounded-xl border border-[#1E293B] bg-[#040810]/45 p-5 flex flex-col gap-4">
                    <p class="font-['Inter'] text-xs text-[#d9c3af] leading-relaxed">Upload an MP4, WebM, OGG, or MOV intro up to 250 MB, or paste a YouTube/Vimeo URL.</p>
                    <input type="url" [ngModel]="course()?.promoVideoUrl" (ngModelChange)="updateCourseField('promoVideoUrl', $event)" placeholder="https://youtube.com/watch?v=…" class="w-full bg-[#040810] border border-[#1E293B] focus:border-[#3B82F6] outline-none rounded-lg px-3 py-2.5 text-xs text-white" />
                    <div class="grid grid-cols-2 gap-2"><label [class.pointer-events-none]="isUploadingVideo()" class="text-center font-['JetBrains_Mono'] text-[11px] font-bold text-[#040810] bg-[#3B82F6] px-3 py-3 cursor-pointer">Upload video<input type="file" accept="video/mp4,video/webm,video/ogg,video/quicktime" class="hidden" (change)="handlePromoVideoFile($event)" /></label><button type="button" (click)="saveAllChanges()" [disabled]="isSaving()" class="admin-action-primary font-['JetBrains_Mono'] text-[11px] font-bold !text-white bg-[#2563EB] disabled:opacity-50">Save URL</button></div>
                  </div>
                </div>
              </div>

              <!-- Student Reviews -->
              <div class="border-t border-[#1E293B] pt-6">
                <div class="flex items-center justify-between gap-4 mb-4">
                  <div>
                    <h3 class="font-['Hanken_Grotesk'] text-base font-bold text-white">Student reviews</h3>
                    <p class="font-['Inter'] text-xs text-[#a18d7b] mt-1">Real reviews from enrolled students appear here automatically.</p>
                  </div>
                  <span class="font-['JetBrains_Mono'] text-xs text-[#3B82F6]">{{ course()?.reviewCount || 0 }} reviews</span>
                </div>
                @if (course()?.reviews?.length) {
                  <div class="flex flex-col gap-3">
                    @for (review of course()?.reviews; track review.id) {
                      <article class="border border-[#1E293B] bg-[#040810]/60 rounded-lg p-4">
                        <div class="flex items-center justify-between gap-4 mb-2">
                          <span class="font-['Hanken_Grotesk'] text-sm font-bold text-white">{{ review.user.name }}</span>
                          <span class="font-['JetBrains_Mono'] text-sm text-[#3B82F6]">{{ '★'.repeat(review.rating) }}{{ '☆'.repeat(5 - review.rating) }}</span>
                        </div>
                        <p class="font-['Inter'] text-xs text-[#d9c3af] leading-relaxed">{{ review.comment }}</p>
                      </article>
                    }
                  </div>
                } @else {
                  <div class="border border-dashed border-[#1E293B] rounded-lg p-5 font-['Inter'] text-xs text-[#a18d7b]">No student reviews yet.</div>
                }
              </div>
            </div>
          }

          <!-- TAB 3: PROMOTIONS & COUPONS -->
          @if (activeTab() === 'promotions') {
            <div class="flex flex-col gap-6">
              <div class="border-b border-[#1E293B] pb-4">
                <h2 class="font-['Hanken_Grotesk'] text-2xl font-bold text-white">Promotions</h2>
                <p class="font-['Inter'] text-xs text-[#d9c3af] mt-1">
                  Create targeted coupons and referral links to promote your course and increase student enrollments.
                </p>
              </div>

              <!-- Refer Students Card -->
              <div class="border border-[#1E293B] bg-[#040810]/60 rounded-lg p-6 flex flex-col gap-3">
                <h3 class="font-['Hanken_Grotesk'] text-base font-bold text-white">Refer students</h3>
                <div class="flex gap-3 max-w-xl">
                  <input
                    type="text"
                    readonly
                    [value]="referralUrl"
                    class="bg-[#121A2B] border border-[#1E293B] rounded px-3 py-2 text-xs text-[#3B82F6] font-['JetBrains_Mono'] flex-grow"
                  />
                  <button (click)="copyReferralLink()" class="font-['JetBrains_Mono'] text-xs font-bold text-[#040810] bg-[#3B82F6] px-5 py-2 rounded hover:bg-[#3B82F6]/90 transition-colors">
                    {{ copiedLink ? 'Copied!' : 'Copy' }}
                  </button>
                </div>
              </div>

              <section class="border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#040810] rounded-lg p-6 flex flex-col gap-4" aria-label="Course coupon">
                <div class="flex justify-between items-center gap-4">
                  <h3 class="font-bold text-slate-900 dark:text-white">Course coupon</h3>
                  <button type="button" role="switch" [attr.aria-checked]="couponActive" aria-label="Enable course coupon"
                    [disabled]="couponSaving() || couponLoading() || !savedCoupon()"
                    (click)="toggleCourseCoupon()"
                    class="px-4 py-2 rounded-full border font-semibold disabled:opacity-50"
                    [class.bg-emerald-600]="couponActive" [class.!text-white]="couponActive">
                    {{ couponActive ? 'Active' : 'Inactive' }}
                  </button>
                </div>
                @if (couponLoading()) { <p role="status">Loading coupon…</p> }
                <p class="text-sm text-slate-600 dark:text-slate-300">Save and activate one coupon for this course. You can update it here at any time.</p>
                <fieldset [disabled]="couponSaving() || couponLoading()" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label class="text-sm">Coupon code
                    <input [(ngModel)]="newCouponCode" (ngModelChange)="couponMessage.set('')" placeholder="e.g. LEARN100" class="mt-2 w-full border rounded p-3 uppercase" />
                  </label>
                  <label class="text-sm">Discount type
                    <select [(ngModel)]="couponDiscountType" class="mt-2 w-full border rounded p-3">
                      <option value="amount">Fixed amount (₹)</option><option value="percent">Percentage (%)</option>
                    </select>
                  </label>
                  <label class="text-sm">{{ couponDiscountType === 'percent' ? 'Discount (%)' : 'Discount (₹)' }}
                    <input type="number" min="0.01" [max]="couponDiscountType === 'percent' ? 100 : null" [(ngModel)]="newCouponDiscount" class="mt-2 w-full border rounded p-3" />
                  </label>
                  <button type="button" (click)="saveCourseCoupon(true)" class="admin-action-primary self-end rounded px-4 py-3 bg-[#2563EB] !text-white font-semibold">
                    {{ couponSaving() ? 'Saving…' : 'Save & activate' }}
                  </button>
                </fieldset>
                @if (couponMessage()) { <p role="status" class="rounded p-3 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">{{ couponMessage() }}</p> }
                @if (couponError()) { <p role="alert" class="rounded p-3 bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200">{{ couponError() }} <button type="button" (click)="loadCourseCoupon()" class="underline">Reload saved coupon</button></p> }
                @if (savedCoupon(); as coupon) {
                  <p class="text-sm text-slate-600 dark:text-slate-300">Created {{ coupon.createdAt | date:'medium' }} · Used {{ coupon.timesUsed }} times</p>
                  <p class="text-xs text-slate-600 dark:text-slate-300">This coupon also appears in Admin → Coupons. Existing student enrollments remain valid when this coupon changes.</p>
                }
              </section>
            </div>
          }

          <!-- TAB 4: ENROLLED STUDENTS -->
          @if (activeTab() === 'students') {
            <div class="flex flex-col gap-6">
              <div class="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-[#1E293B] pb-5">
                <div>
                  <span class="font-['JetBrains_Mono'] text-[10px] uppercase tracking-[0.2em] text-[#3B82F6]">Course audience</span>
                  <h2 class="font-['Hanken_Grotesk'] text-2xl font-bold text-white mt-1">Enrolled students</h2>
                  <p class="font-['Inter'] text-xs text-[#a18d7b] mt-1">Enrollment date, latest activity, and curriculum progress for this course.</p>
                </div>
                <div class="relative w-full lg:w-72">
                  <span class="material-symbols-outlined absolute left-3 top-2.5 text-base text-[#a18d7b]">search</span>
                  <input [(ngModel)]="studentSearch" (ngModelChange)="scheduleStudentSearch()" placeholder="Search students" class="w-full bg-[#040810] border border-[#1E293B] focus:border-[#3B82F6] outline-none rounded-lg pl-10 pr-3 py-2.5 text-xs text-white" />
                </div>
              </div>

              @if (isLoadingStudents()) {
                <div class="space-y-3 animate-pulse">
                  @for (item of [1, 2, 3, 4, 5]; track item) {
                    <div class="h-16 rounded-lg bg-[#040810] border border-[#1E293B]"></div>
                  }
                </div>
              } @else if (courseStudents().length) {
                <div class="overflow-x-auto rounded-xl border border-[#1E293B]">
                  <table class="w-full min-w-[760px] text-left">
                    <thead class="bg-[#040810] font-['JetBrains_Mono'] text-[10px] uppercase tracking-wider text-[#a18d7b]">
                      <tr><th class="px-5 py-3">Student</th><th class="px-5 py-3">Enrolled</th><th class="px-5 py-3">Last visited</th><th class="px-5 py-3">Progress</th><th class="px-5 py-3">Completed</th></tr>
                    </thead>
                    <tbody class="divide-y divide-[#1E293B]">
                      @for (student of courseStudents(); track student.id) {
                        <tr class="bg-[#121A2B] hover:bg-[#172033] transition-colors">
                          <td class="px-5 py-4">
                            <div class="flex items-center gap-3"><span class="w-9 h-9 rounded-full bg-[#3B82F6]/15 text-[#3B82F6] grid place-items-center font-bold">{{ student.name.charAt(0).toUpperCase() }}</span><div><div class="text-sm font-semibold text-white">{{ student.name }}</div><div class="text-[11px] text-[#a18d7b]">{{ student.email }}</div></div></div>
                          </td>
                          <td class="px-5 py-4 text-xs text-[#d9c3af]">{{ student.enrolledAt | date:'mediumDate' }}</td>
                          <td class="px-5 py-4 text-xs text-[#d9c3af]">{{ student.lastVisited | date:'medium' }}</td>
                          <td class="px-5 py-4"><div class="flex items-center gap-3"><div class="h-2 w-28 rounded-full bg-[#040810] overflow-hidden"><div class="h-full bg-[#3B82F6] rounded-full" [style.width.%]="student.progressPercent"></div></div><span class="text-xs text-white">{{ student.progressPercent | number:'1.0-0' }}%</span></div></td>
                          <td class="px-5 py-4 font-['JetBrains_Mono'] text-xs text-[#3B82F6]">{{ student.completedLessons }} lessons</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              } @else {
                <div class="rounded-xl border border-dashed border-[#3B82F6]/40 bg-[#040810]/40 py-16 text-center"><span class="material-symbols-outlined text-4xl text-[#3B82F6]">group_off</span><h3 class="text-lg font-bold text-white mt-3">No enrolled students yet</h3><p class="text-xs text-[#a18d7b] mt-1">Students will appear here after a completed enrollment.</p></div>
              }
            </div>
          }

          <!-- TAB 5: PRICING -->
          @if (activeTab() === 'pricing') {
            <div class="flex flex-col gap-6 max-w-lg">
              <div class="border-b border-[#1E293B] pb-4">
                <h2 class="font-['Hanken_Grotesk'] text-2xl font-bold text-white">Pricing & Tier</h2>
                <p class="font-['Inter'] text-xs text-[#d9c3af] mt-1">Choose whether students pay once or access this course for free after signing in.</p>
              </div>

              <label class="flex items-start gap-3 border border-[#1E293B] bg-[#040810]/60 rounded-lg p-4 cursor-pointer">
                <input
                  type="checkbox"
                  [checked]="course()?.isFree"
                  (change)="toggleFreeCourse($event)"
                  class="mt-0.5 rounded bg-[#040810] border-[#1E293B] text-[#3B82F6] focus:ring-0"
                />
                <span>
                  <span class="block font-['Hanken_Grotesk'] text-sm font-bold text-white">Make this a free course</span>
                  <span class="block font-['Inter'] text-xs text-[#a18d7b] mt-1">Logged-in students can enroll directly. The course will not open a payment checkout.</span>
                </span>
              </label>

              @if (!course()?.isFree) {
                <div>
                <label for="course-price" class="block font-['JetBrains_Mono'] text-xs text-[#a18d7b] uppercase mb-1">Course Price (₹ INR)</label>
                <input
                  id="course-price"
                  type="number"
                  [ngModel]="course()?.price"
                  (ngModelChange)="updateCourseField('price', $event)"
                  class="w-full bg-[#040810] border border-[#1E293B] rounded px-4 py-2.5 text-sm text-[#3B82F6] font-['JetBrains_Mono'] font-bold"
                />
                </div>
              } @else {
                <div class="border border-[#3B82F6]/40 bg-[#3B82F6]/10 rounded-lg p-4 font-['JetBrains_Mono'] text-xs text-[#3B82F6]">
                  This course is free. Its price will be saved as ₹0.
                </div>
              }
            </div>
          }
          }
        </main>
      </div>
    </div>
  `,
  styles: [
    `
      /* "animate-in fade-in duration-200" above are Tailwind Animate
         utility classes — this project doesn't have that plugin installed,
         so without this the save badge used to just pop in with no
         animation at all. This gives the same effect with plain CSS. */
      .save-badge-in {
        animation: save-badge-in 220ms ease-out both;
      }
      @keyframes save-badge-in {
        from {
          opacity: 0;
          transform: translateY(-4px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .save-badge-in {
          animation: none;
        }
      }
    `,
  ],
})
export class CourseEditorComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private sanitizer = inject(DomSanitizer);
  private coursesService = inject(CoursesService);
  private adminService = inject(AdminService);

  course = signal<Course | null>(null);
  modules = signal<Module[]>([]);
  promoEmbedUrl = signal<SafeResourceUrl | null>(null);
  savedCoupon = signal<Coupon | null>(null);
  couponLoading = signal(false);
  couponSaving = signal(false);
  couponMessage = signal('');
  couponError = signal('');
  couponActive = false;
  couponDiscountType: 'amount' | 'percent' = 'amount';
  courseStudents = signal<CourseStudent[]>([]);
  isLoading = signal(true);
  isSaving = signal(false);
  isUploadingImage = signal(false);
  isUploadingVideo = signal(false);
  isLoadingStudents = signal(false);
  removingMedia = signal<'thumbnail' | 'promoVideoUrl' | null>(null);
  saveMessage = signal('');
  readonly suggestedCategories = [
    'Web Development',
    'AI & Agents',
    'AI Automation',
    'Data Engineering',
    'Software Architecture',
    'Cloud & DevOps',
  ];
  activeTab = signal<
    | 'curriculum'
    | 'landing'
    | 'intended'
    | 'pricing'
    | 'promotions'
    | 'students'
  >('curriculum');

  referralUrl = '';
  copiedLink = false;
  studentSearch = '';
  private studentSearchTimer?: ReturnType<typeof setTimeout>;

  newCouponCode = '';
  newCouponDiscount: number | null = 479;
  Math = Math;

  ngOnInit() {
    const courseId = this.route.snapshot.paramMap.get('id');
    if (courseId) {
      this.coursesService.getCourseById(courseId).subscribe({
        next: (c) => {
          this.course.set(c);
          this.modules.set(c.modules || []);
          this.loadCourseCoupon();
          this.promoEmbedUrl.set(this.toPromoEmbedUrl(c.promoVideoUrl));
          this.referralUrl = `https://courses.codingtechnyks.com/courses/${c.slug}?referralCode=3BDC`;
          this.isLoading.set(false);
        },
        error: () => this.isLoading.set(false),
      });
    } else this.isLoading.set(false);

  }

  togglePublishStatus() {
    const current = this.course();
    if (!current) return;
    const newStatus = current.status === 'LIVE' ? 'DRAFT' : 'LIVE';
    const updated: Course = {
      ...current,
      status: newStatus,
      isPublished: newStatus === 'LIVE',
    };
    this.course.set(updated);
    this.coursesService.saveCourse(updated).subscribe({
      next: () => {
        alert(
          `Course is now ${newStatus === 'LIVE' ? 'LIVE (Public)' : 'DRAFT (Private)'}! Changes saved.`,
        );
      },
    });
  }

  updateCourseField(field: keyof Course, value: any) {
    const current = this.course();
    if (!current) return;
    this.course.set({ ...current, [field]: value });
    if (field === 'promoVideoUrl') {
      this.promoEmbedUrl.set(this.toPromoEmbedUrl(String(value || '')));
    }
  }

  toggleFreeCourse(event: Event) {
    const isFree = (event.target as HTMLInputElement).checked;
    this.updateCourseField('isFree', isFree);
    if (isFree) this.updateCourseField('price', 0);
  }

  handleThumbnailFile(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please choose an image file.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('Please choose an image smaller than 10 MB.');
      return;
    }
    this.isUploadingImage.set(true);
    this.adminService.uploadCourseMedia('image', file).subscribe({
      next: ({ url }) => this.persistMediaField('thumbnail', url),
      error: (error) => {
        this.isUploadingImage.set(false);
        alert(
          error?.error?.message || 'The image upload failed. Please try again.',
        );
      },
    });
    (event.target as HTMLInputElement).value = '';
  }

  handlePromoVideoFile(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      alert('Please choose a video file.');
      return;
    }
    if (file.size > 250 * 1024 * 1024) {
      alert('Please choose an intro video smaller than 250 MB.');
      return;
    }
    this.isUploadingVideo.set(true);
    this.adminService.uploadCourseMedia('video', file).subscribe({
      next: ({ url }) => this.persistMediaField('promoVideoUrl', url),
      error: (error) => {
        this.isUploadingVideo.set(false);
        alert(
          error?.error?.message || 'The video upload failed. Please try again.',
        );
      },
    });
    (event.target as HTMLInputElement).value = '';
  }

  removeMedia(field: 'thumbnail' | 'promoVideoUrl') {
    const current = this.course();
    if (!current) return;
    const previousUrl = String(current[field] || '');
    const updated = { ...current, [field]: null } as Course;
    this.removingMedia.set(field);
    this.coursesService.saveCourse(updated).subscribe({
      next: (saved) => {
        this.course.set(saved);
        if (field === 'promoVideoUrl') this.promoEmbedUrl.set(null);
        if (this.isManagedUpload(previousUrl)) {
          this.adminService.removeCourseMedia(previousUrl).subscribe({
            next: () => this.removingMedia.set(null),
            error: () => this.removingMedia.set(null),
          });
        } else this.removingMedia.set(null);
        this.showSavedMessage('Media removed');
      },
      error: () => {
        this.removingMedia.set(null);
        alert('The media could not be removed. Please try again.');
      },
    });
  }

  isDirectPromoVideo(value?: string | null) {
    const url = String(value || '');
    return (
      url.startsWith('data:video/') ||
      /\.(?:mp4|webm|ogv|ogg|mov)(?:\?|$)/i.test(url)
    );
  }

  private persistMediaField(field: 'thumbnail' | 'promoVideoUrl', url: string) {
    const current = this.course();
    if (!current) return;
    const previousUrl = String(current[field] || '');
    const updated = { ...current, [field]: url } as Course;
    this.coursesService.saveCourse(updated).subscribe({
      next: (saved) => {
        this.course.set(saved);
        this.modules.set(saved.modules || this.modules());
        if (field === 'promoVideoUrl') {
          this.promoEmbedUrl.set(this.toPromoEmbedUrl(saved.promoVideoUrl));
          this.isUploadingVideo.set(false);
        } else this.isUploadingImage.set(false);
        if (
          previousUrl &&
          previousUrl !== url &&
          this.isManagedUpload(previousUrl)
        ) {
          this.adminService.removeCourseMedia(previousUrl).subscribe();
        }
        this.showSavedMessage(
          field === 'thumbnail'
            ? 'Image uploaded and saved'
            : 'Video uploaded and saved',
        );
      },
      error: () => {
        if (field === 'promoVideoUrl') this.isUploadingVideo.set(false);
        else this.isUploadingImage.set(false);
        this.adminService.removeCourseMedia(url).subscribe();
        alert(
          'The file uploaded, but the course could not be updated. Please try again.',
        );
      },
    });
  }

  private isManagedUpload(url: string) {
    return url.includes('/uploads/course-media/');
  }

  private toPromoEmbedUrl(value?: string | null): SafeResourceUrl | null {
    if (!value || this.isDirectPromoVideo(value)) return null;
    try {
      const url = new URL(value);
      if (url.hostname === 'youtu.be') {
        const id = url.pathname.split('/').filter(Boolean)[0];
        return id
          ? this.sanitizer.bypassSecurityTrustResourceUrl(
              this.youtubeEmbedUrl(id),
            )
          : null;
      }
      if (
        url.hostname === 'youtube.com' ||
        url.hostname.endsWith('.youtube.com')
      ) {
        const id =
          url.searchParams.get('v') ||
          url.pathname.match(/^\/(?:embed|shorts)\/([A-Za-z0-9_-]{11})/)?.[1];
        return id
          ? this.sanitizer.bypassSecurityTrustResourceUrl(
              this.youtubeEmbedUrl(id),
            )
          : null;
      }
      if (url.hostname === 'vimeo.com' || url.hostname.endsWith('.vimeo.com')) {
        const id = url.pathname
          .split('/')
          .filter(Boolean)
          .find((part) => /^\d+$/.test(part));
        return id
          ? this.sanitizer.bypassSecurityTrustResourceUrl(
              `https://player.vimeo.com/video/${id}`,
            )
          : null;
      }
    } catch {
      return null;
    }
    return null;
  }

  private youtubeEmbedUrl(videoId: string) {
    const params = new URLSearchParams({
      controls: '1',
      rel: '0',
      playsinline: '1',
      iv_load_policy: '3',
      cc_load_policy: '0',
      color: 'white',
    });
    return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
  }

  addSection() {
    const current = this.modules();
    const newMod: Module = {
      id: 'mod-' + Date.now(),
      title: `Section ${current.length + 1}: New Curriculum Section`,
      order: current.length + 1,
      lessons: [],
    };
    this.modules.set([...current, newMod]);
  }

  deleteSection(sIdx: number) {
    const current = this.modules();
    current.splice(sIdx, 1);
    this.modules.set([...current]);
  }

  addLesson(sIdx: number) {
    const current = this.modules();
    const target = current[sIdx];
    const newLesson: Lesson = {
      id: 'les-' + Date.now(),
      title: `Lecture ${target.lessons.length + 1}: New Topic`,
      duration: 600,
      order: target.lessons.length + 1,
      isFreePreview: false,
      videoAssetRef: '',
    };
    target.lessons.push(newLesson);
    this.modules.set([...current]);
  }

  deleteLesson(sIdx: number, lIdx: number) {
    const current = this.modules();
    current[sIdx].lessons.splice(lIdx, 1);
    this.modules.set([...current]);
  }

  updateLessonDuration(sIdx: number, lIdx: number, minutes: number) {
    const current = this.modules();
    const lesson = current[sIdx]?.lessons[lIdx];
    if (!lesson) return;
    lesson.duration = Math.max(0, Math.round(Number(minutes) || 0) * 60);
    this.modules.set([...current]);
  }

  copyReferralLink() {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(this.referralUrl);
      this.copiedLink = true;
      setTimeout(() => (this.copiedLink = false), 2000);
    }
  }

  loadCourseCoupon() {
    const id = this.course()?.id;
    if (!id || this.couponSaving()) return;
    this.couponLoading.set(true);
    this.couponError.set('');
    this.adminService.getCourseCoupon(id).subscribe({
      next: coupon => { this.setSavedCoupon(coupon); this.couponLoading.set(false); },
      error: error => { this.couponLoading.set(false); this.couponError.set(error?.error?.message || 'Could not load the saved coupon. Reload before editing.'); },
    });
  }

  private setSavedCoupon(coupon: Coupon | null) {
    this.savedCoupon.set(coupon);
    this.newCouponCode = coupon?.code || '';
    this.couponActive = coupon?.isActive === true;
    this.couponDiscountType = coupon?.discountPercent ? 'percent' : 'amount';
    this.newCouponDiscount = coupon?.discountPercent ?? coupon?.discountAmount ?? 479;
  }

  toggleCourseCoupon() {
    const coupon = this.savedCoupon();
    if (!coupon) return;
    // A toggle changes the saved record only; unsaved code edits need Save.
    this.persistCourseCoupon({ isActive: !coupon.isActive }, false);
  }

  saveCourseCoupon(active: boolean) {
    const discount = Number(this.newCouponDiscount);
    if (!this.newCouponCode.trim() || !Number.isFinite(discount) || discount <= 0 || (this.couponDiscountType === 'percent' && discount > 100)) {
      this.couponError.set('Enter a coupon code and a valid discount.');
      return;
    }
    this.persistCourseCoupon({
      code: this.newCouponCode.trim().toUpperCase(),
      discountAmount: this.couponDiscountType === 'amount' ? discount : null,
      discountPercent: this.couponDiscountType === 'percent' ? discount : null,
      isActive: active,
    }, true);
  }

  private persistCourseCoupon(payload: Partial<Coupon>, isSave: boolean) {
    const id = this.course()?.id;
    if (!id || this.couponSaving() || this.couponLoading()) return;
    this.couponSaving.set(true);
    this.couponMessage.set('');
    this.couponError.set('');
    this.adminService.saveCourseCoupon(id, payload).subscribe({
      next: coupon => {
        this.setSavedCoupon(coupon);
        this.couponSaving.set(false);
        this.couponMessage.set(isSave ? 'Coupon saved and activated successfully.' : coupon.isActive ? 'Coupon enabled successfully.' : 'Coupon disabled successfully.');
      },
      error: error => {
        this.couponSaving.set(false);
        this.couponError.set(error?.error?.message || 'Coupon was not saved. Please try again.');
      },
    });
  }

  openStudentsTab() {
    this.activeTab.set('students');
    this.loadCourseStudents();
  }

  scheduleStudentSearch() {
    if (this.studentSearchTimer) clearTimeout(this.studentSearchTimer);
    this.studentSearchTimer = setTimeout(() => this.loadCourseStudents(), 250);
  }

  private loadCourseStudents() {
    const courseId = this.course()?.id;
    if (!courseId) return;
    this.isLoadingStudents.set(true);
    this.adminService
      .getCourseStudents(courseId, this.studentSearch)
      .subscribe({
        next: (students) => {
          this.courseStudents.set(students);
          this.isLoadingStudents.set(false);
        },
        error: () => this.isLoadingStudents.set(false),
      });
  }

  saveAllChanges() {
    const current = this.course();
    if (!current) return;

    const updated: Course = {
      ...current,
      modules: this.modules(),
      isPublished: current.status === 'LIVE',
    };

    this.isSaving.set(true);
    this.coursesService.saveCourse(updated).subscribe({
      next: (saved) => {
        this.course.set(saved);
        this.modules.set(saved.modules || []);
        this.promoEmbedUrl.set(this.toPromoEmbedUrl(saved.promoVideoUrl));
        this.isSaving.set(false);
        const timeStr = new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
        this.showSavedMessage(
          `Course & curriculum saved at ${timeStr}! Live in store.`,
        );
      },
      error: (error) => {
        this.isSaving.set(false);
        alert(error?.error?.message || 'The course could not be saved.');
      },
    });
  }

  private showSavedMessage(message: string) {
    this.saveMessage.set(message);
    setTimeout(() => this.saveMessage.set(''), 6000);
  }

  deleteCurrentCourse() {
    const current = this.course();
    if (
      !current ||
      typeof window === 'undefined' ||
      !window.confirm('Are you sure you want to delete?')
    )
      return;

    this.coursesService.deleteCourse(current.id).subscribe({
      next: () => {
        alert('Course deleted successfully.');
        this.router.navigate(['/admin']);
      },
      error: () => alert('The course could not be deleted. Please try again.'),
    });
  }
}

import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';
import {
  AdminService,
  RevenueMetrics,
  Student,
  Coupon,
  MembershipPlan,
} from '../../core/services/admin.service';
import { CoursesService, Course } from '../../core/services/courses.service';
import {
  TemplatesService,
  AdminUiTemplate,
} from '../../core/services/templates.service';
import {
  ContactService,
  ContactMessage,
} from '../../core/services/contact.service';

import {
  SiteSettingsService,
  AnnouncementBarSettings,
} from '../../core/services/site-settings.service';
import { AdminCommunicationComponent } from './admin-communication.component';
import { AdminTemplatesComponent } from './admin-templates.component';
import { AdminTemplateOrdersComponent } from './admin-template-orders.component';
import { MediaUrlPipe } from '../../core/pipes/media-url.pipe';

type AdminTab =
  | 'courses'
  | 'templates'
  | 'template-orders'
  | 'revenue'
  | 'students'
  | 'coupons'
  | 'membership'
  | 'communication'
  | 'support'
  | 'settings';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    AdminCommunicationComponent,
    AdminTemplatesComponent,
    AdminTemplateOrdersComponent,
    MediaUrlPipe,
  ],
  template: `
    <div class="admin-shell mx-auto flex min-h-screen max-w-[1720px] items-start bg-slate-100 pt-16 text-slate-900 dark:bg-[#040810] dark:text-[#e0e3e5] sm:pt-20 lg:pt-24">
      <aside class="sticky top-16 z-20 h-[calc(100vh-4rem)] w-20 shrink-0 overflow-y-auto border-r border-slate-200 bg-white px-2 py-5 shadow-sm dark:border-white/10 dark:bg-[#080D18] sm:top-20 sm:h-[calc(100vh-5rem)] lg:top-24 lg:h-[calc(100vh-6rem)] md:w-64 md:px-4">
        <div class="mb-6 flex items-center gap-3 px-2">
          <span class="material-symbols-outlined rounded-xl bg-blue-600 p-2.5 !text-white">school</span>
          <div class="hidden min-w-0 md:block"><strong class="block truncate text-sm text-slate-950 dark:text-white">Instructor Studio</strong><span class="font-['JetBrains_Mono'] text-[9px] uppercase tracking-widest text-blue-600">Technyks Admin</span></div>
        </div>
        @for (group of adminNavigation; track group.label) {
          <p class="mb-2 mt-5 hidden px-3 font-['JetBrains_Mono'] text-[9px] font-bold uppercase tracking-[.18em] text-slate-400 md:block">{{ group.label }}</p>
          <nav class="space-y-1" [attr.aria-label]="group.label">
            @for (item of group.items; track item.id) {
              <button type="button" (click)="activeTab.set(item.id)" [attr.aria-label]="item.label" [attr.title]="item.label" [class.admin-side-active]="activeTab() === item.id" class="admin-side-link">
                <span class="material-symbols-outlined text-[20px]">{{ item.icon }}</span>
                <span class="hidden flex-1 text-left md:block">{{ item.label }}</span>
                @if (item.id === 'support' && unreadMessagesCount() > 0) {
                  <span class="rounded-full bg-blue-600 px-1.5 py-0.5 text-[9px] font-bold !text-white">{{ unreadMessagesCount() }}</span>
                }
              </button>
            }
          </nav>
        }
        <div class="mt-6 border-t border-slate-200 pt-4 dark:border-white/10">
          <a routerLink="/" class="admin-side-link" aria-label="View storefront" title="View storefront"><span class="material-symbols-outlined text-[20px]">storefront</span><span class="hidden md:block">View storefront</span></a>
        </div>
      </aside>

      <main class="min-w-0 flex-1 px-4 pb-16 pt-6 sm:px-6 lg:px-8">
      <div class="mb-8 flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 dark:border-[#1E293B] md:flex-row md:items-center">
        <div>
          <div class="mb-2 inline-flex w-fit items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3.5 py-1.5 font-['JetBrains_Mono'] text-xs font-bold text-blue-700 dark:border-[#3B82F6]/30 dark:bg-[#3B82F6]/10 dark:text-[#60A5FA]">
            <span class="material-symbols-outlined text-[16px]">dashboard</span>
            ADMIN CONTROL CENTER
          </div>
          <h1 class="font-['Hanken_Grotesk'] text-3xl font-bold text-slate-950 dark:text-white">{{ activeTitle() }}</h1>
        </div>
        @if (activeTab() === 'courses') {
          <button (click)="createNewCourse()" class="admin-action-primary flex w-fit items-center gap-2 bg-[#2563EB] px-6 py-3 font-['JetBrains_Mono'] text-xs font-bold uppercase !text-white shadow-lg hover:bg-[#1D4ED8]">
            <span class="material-symbols-outlined text-sm">add</span>
            New Course
          </button>
        }
      </div>

      @if (activeTab() === 'communication') {
        <app-admin-communication [courses]="publishedCourses()" />
      }

      @if (activeTab() === 'templates') {
        <app-admin-templates />
      }

      @if (activeTab() === 'template-orders') {
        <app-admin-template-orders />
      }

      <!-- TAB 1: UDEMY COURSES ROSTER (Screenshot 1) -->
      @if (activeTab() === 'courses') {
        <div class="flex flex-col gap-6">
          
          <!-- Filter & Search Action Bar (Screenshot 1 Top Control) -->
          <div class="flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#121A2B] technical-border p-4 rounded-lg">
            <div class="flex items-center gap-3 w-full sm:w-auto flex-grow max-w-md">
              <input
                type="text"
                [(ngModel)]="searchCourseQuery"
                placeholder="Search your courses..."
                class="w-full bg-[#040810] border border-[#1E293B] focus:border-[#3B82F6] focus:outline-none rounded px-4 py-2 text-xs text-white font-['Inter']"
              />
            </div>

            <div class="flex items-center gap-3 w-full sm:w-auto justify-end">
              <select
                [(ngModel)]="sortBy"
                class="bg-[#040810] border border-[#1E293B] rounded px-3 py-2 text-xs text-[#d9c3af] font-['JetBrains_Mono']"
              >
                <option value="Newest">Newest</option>
                <option value="Oldest">Oldest</option>
                <option value="Popular">Most Popular</option>
              </select>
            </div>
          </div>

          <!-- Course Cards Roster -->
          @if (isLoadingCourses()) {
            <div class="flex flex-col gap-4" aria-label="Loading courses">
              @for (row of [1, 2, 3]; track row) {
                <div class="bg-[#121A2B] border border-[#1E293B] rounded-lg p-5 flex flex-col md:flex-row gap-6 animate-pulse">
                  <div class="flex items-center gap-5 flex-grow">
                    <div class="w-36 h-20 rounded bg-[#202A3E] shrink-0"></div>
                    <div class="flex-grow max-w-lg space-y-3">
                      <div class="h-4 bg-[#202A3E] rounded w-3/4"></div>
                      <div class="h-3 bg-[#202A3E] rounded w-2/5"></div>
                    </div>
                  </div>
                  <div class="flex gap-5 items-center">
                    <div class="h-10 w-24 bg-[#202A3E] rounded"></div>
                    <div class="h-10 w-36 bg-[#202A3E] rounded"></div>
                  </div>
                </div>
              }
            </div>
          } @else if (filteredCourses().length) {
            <div class="flex flex-col gap-4">
              @for (course of filteredCourses(); track course.id) {
                <div class="bg-[#121A2B] border border-[#1E293B] hover:border-[#3B82F6] rounded-xl p-4 sm:p-5 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_auto] items-start xl:items-center gap-5 xl:gap-8 transition-all group shadow-xl">
                
                <!-- Left: Thumbnail & Title -->
                <div class="flex min-w-0 items-center gap-3 sm:gap-5">
                  <div class="relative w-24 h-16 sm:w-36 sm:h-20 rounded-lg overflow-hidden shrink-0 border border-[#1E293B]">
                    <img [src]="(course.thumbnail || '/assets/agentic-ai.jpg') | mediaUrl" [alt]="course.title" class="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  </div>

                  <div class="min-w-0 flex flex-col gap-1.5">
                    <h3 class="font-['Hanken_Grotesk'] text-sm sm:text-base font-bold text-white group-hover:text-[#3B82F6] transition-colors line-clamp-2">
                      {{ course.title }}
                    </h3>

                    <div class="flex items-center gap-3 font-['JetBrains_Mono'] text-[11px]">
                      <span
                        [class.bg-[#3B82F6]/20]="course.status === 'LIVE'"
                        [class.text-[#3B82F6]]="course.status === 'LIVE'"
                        [class.bg-[#3B82F6]/20]="course.status === 'DRAFT'"
                        [class.text-[#3B82F6]]="course.status === 'DRAFT'"
                        class="px-2 py-0.5 rounded font-bold uppercase border border-current"
                      >
                        {{ course.status || 'LIVE' }}
                      </span>
                      <span class="text-[#a18d7b]">{{ course.isPublished ? 'Public' : 'Private' }}</span>
                      <span class="text-[#1E293B]">|</span>
                      <span class="text-[#3B82F6]">{{ course.isFree ? 'FREE' : '₹' + course.price.toLocaleString('en-IN') }}</span>
                    </div>
                  </div>
                </div>

                <!-- Right: Stats & Action Button (Screenshot 1 Metrics) -->
                <div class="grid grid-cols-3 gap-3 sm:gap-5 xl:grid-cols-[104px_112px_86px_auto] w-full xl:w-auto items-stretch xl:items-center border-t xl:border-t-0 border-[#1E293B] pt-4 xl:pt-0">
                  <div class="min-w-0 self-stretch flex flex-col items-center xl:items-end justify-start text-center xl:text-right font-['JetBrains_Mono']">
                    <span class="h-5 inline-flex items-center text-sm font-bold text-[#3B82F6]">₹{{ (course.earnedThisMonth || 0).toLocaleString('en-IN') }}</span>
                    <span class="text-[10px] leading-4 text-[#a18d7b]">Earned<br class="hidden xl:block" /> this month</span>
                  </div>

                  <div class="min-w-0 self-stretch flex flex-col items-center xl:items-end justify-start text-center xl:text-right font-['JetBrains_Mono']">
                    <span class="h-5 inline-flex items-center text-sm font-bold text-white">{{ course.enrollmentsThisMonth || 0 }}</span>
                    <span class="text-[10px] leading-4 text-[#a18d7b]">Enrollments<br class="hidden xl:block" /> this month</span>
                  </div>

                    <div class="min-w-0 self-stretch flex flex-col items-center xl:items-end justify-start text-center xl:text-right font-['JetBrains_Mono']">
                      <div class="h-5 flex items-center justify-center xl:justify-end gap-1 text-[#3B82F6] text-xs font-bold">
                        <span>{{ course.rating ?? 0 }}</span>
                        <span class="material-symbols-outlined text-sm leading-none text-[#3B82F6]">star</span>
                      </div>
                      <span class="text-[10px] text-[#a18d7b]">{{ course.reviewCount || 0 }} reviews</span>
                    </div>

                  <div class="col-span-3 xl:col-span-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
                    <!-- Edit / Manage Course Action Button -->
                    <a
                      [routerLink]="['/admin/courses', course.id, 'manage']"
                      class="admin-action-primary text-center whitespace-nowrap font-['JetBrains_Mono'] text-xs font-bold !text-white bg-[#2563EB] hover:bg-[#1D4ED8] px-4 py-2.5 rounded-lg transition-all shadow"
                    >
                      Edit / manage course
                    </a>
                    <button
                      type="button"
                      (click)="deleteCourse(course)"
                      class="font-['JetBrains_Mono'] text-xs font-bold text-[#ffb4ab] border border-[#ffb4ab]/40 hover:bg-[#ffb4ab]/10 px-3 py-2.5 rounded transition-all"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                </div>
              }
            </div>
          } @else {
            <div class="bg-[#121A2B] border border-dashed border-[#3B82F6]/50 rounded-lg px-6 py-14 text-center">
              <span class="material-symbols-outlined text-4xl text-[#3B82F6] mb-3">school</span>
              <h2 class="font-['Hanken_Grotesk'] text-xl font-bold text-white mb-2">
                {{ publishedCourses().length ? 'No courses match your search' : 'No courses are live yet' }}
              </h2>
              <p class="font-['Inter'] text-sm text-[#a18d7b] max-w-lg mx-auto">
                {{ publishedCourses().length ? 'Try another title or slug.' : 'Create a course or add the JavaScript curriculum to start publishing your catalog.' }}
              </p>
            </div>
          }
        </div>
      }

      <!-- TAB 2: REVENUE ANALYTICS -->
      @if (activeTab() === 'revenue') {
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <div class="bg-[#121A2B] technical-border p-6 rounded">
            <div class="font-['JetBrains_Mono'] text-xs text-[#a18d7b] uppercase mb-1">Total Revenue</div>
            <div class="font-['JetBrains_Mono'] text-2xl font-bold text-[#3B82F6]">
              ₹{{ metrics()?.totalRevenue?.toLocaleString('en-IN') || 0 }}
            </div>
          </div>

          <div class="bg-[#121A2B] technical-border p-6 rounded">
            <div class="font-['JetBrains_Mono'] text-xs text-[#a18d7b] uppercase mb-1">Active Subscriptions</div>
            <div class="font-['JetBrains_Mono'] text-2xl font-bold text-[#3B82F6]">
              {{ metrics()?.activeSubscriptions || 0 }} Users
            </div>
          </div>

          <div class="bg-[#121A2B] technical-border p-6 rounded">
            <div class="font-['JetBrains_Mono'] text-xs text-[#a18d7b] uppercase mb-1">Churn Rate</div>
            <div class="font-['JetBrains_Mono'] text-2xl font-bold text-[#ffb4ab]">
              {{ metrics()?.churnRate || '0%' }}
            </div>
          </div>

          <div class="bg-[#121A2B] technical-border p-6 rounded">
            <div class="font-['JetBrains_Mono'] text-xs text-[#a18d7b] uppercase mb-1">Total Students</div>
            <div class="font-['JetBrains_Mono'] text-2xl font-bold text-white">
              {{ metrics()?.totalStudents || 0 }} Registered
            </div>
          </div>
        </div>
      }

      <!-- TAB 3: STUDENTS -->
      @if (activeTab() === 'students') {
        <div class="bg-white dark:bg-[#121A2B] technical-border rounded p-4 sm:p-6 flex flex-col gap-6 overflow-x-auto">
          <table class="w-full min-w-[680px] text-left font-['Inter'] text-xs text-slate-700 dark:text-[#d9c3af]">
            <thead class="font-['JetBrains_Mono'] text-[11px] uppercase text-slate-600 dark:text-[#a18d7b] bg-slate-50 dark:bg-[#040810]/60 border-b border-slate-200 dark:border-[#1E293B]">
              <tr>
                <th class="p-3">Name</th>
                <th class="p-3">Email</th>
                <th class="p-3">Role</th>
                <th class="p-3">Joined Date</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200 dark:divide-[#1E293B]/40">
              @for (student of students(); track student.id) {
                <tr class="hover:bg-slate-50 dark:hover:bg-white/[0.025] transition-colors">
                  <td class="p-3 font-semibold text-slate-950 dark:text-white">{{ student.name }}</td>
                  <td class="p-3 font-['JetBrains_Mono'] text-slate-700 dark:text-[#d9c3af]">{{ student.email }}</td>
                  <td class="p-3 font-['JetBrains_Mono'] font-semibold text-[#1D4ED8] dark:text-[#60A5FA]">{{ student.role }}</td>
                  <td class="p-3 font-['JetBrains_Mono'] text-slate-600 dark:text-[#a18d7b]">{{ student.createdAt | date:'mediumDate' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      <!-- TAB 4: COUPONS -->
      @if (activeTab() === 'coupons') {
        <!-- Guided coupon creation wizard -->
        <div class="mb-8 border border-[#1E293B] bg-[#040810]/60 rounded-lg p-6">
          <div class="flex items-start justify-between gap-4 mb-5">
            <div>
              <h3 class="font-['Hanken_Grotesk'] text-base font-bold text-white">Create a new coupon</h3>
              <p class="font-['Inter'] text-xs text-[#a18d7b] mt-1">Every coupon is locked to exactly one course or one UI template product, so it can never accidentally discount the wrong item — just like a unique product ID in an online store.</p>
            </div>
            @if (newCouponScope()) {
              <button type="button" (click)="resetCouponWizard()" class="shrink-0 font-['JetBrains_Mono'] text-[10px] uppercase text-[#a18d7b] hover:text-white transition-colors">Start over</button>
            }
          </div>

          <div class="flex items-center gap-2 mb-6 font-['JetBrains_Mono'] text-[10px] uppercase">
            @for (step of [1, 2, 3, 4]; track step) {
              <div class="flex items-center gap-2">
                <span class="w-6 h-6 flex items-center justify-center rounded-full border" [class.border-[#3B82F6]]="newCouponStep() >= step" [class.text-[#3B82F6]]="newCouponStep() >= step" [class.border-[#1E293B]]="newCouponStep() < step" [class.text-[#a18d7b]]="newCouponStep() < step">{{ step }}</span>
                @if (step < 4) { <span class="w-6 h-px" [class.bg-[#3B82F6]]="newCouponStep() > step" [class.bg-[#1E293B]]="newCouponStep() <= step"></span> }
              </div>
            }
          </div>

          <!-- Step 1: scope -->
          @if (newCouponStep() === 1) {
            <div>
              <p class="font-['Inter'] text-sm text-white mb-3">What is this coupon for?</p>
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button type="button" (click)="selectCouponScope('COURSE')" class="text-left p-4 rounded border border-[#1E293B] hover:border-[#3B82F6] transition-colors">
                  <span class="material-symbols-outlined text-[#3B82F6] mb-2 block">school</span>
                  <span class="font-['Hanken_Grotesk'] font-bold text-white block">A course</span>
                  <span class="font-['Inter'] text-[11px] text-[#a18d7b]">Locks the discount to one specific course.</span>
                </button>
                <button type="button" (click)="selectCouponScope('TEMPLATE')" class="text-left p-4 rounded border border-[#1E293B] hover:border-[#3B82F6] transition-colors">
                  <span class="material-symbols-outlined text-[#3B82F6] mb-2 block">web</span>
                  <span class="font-['Hanken_Grotesk'] font-bold text-white block">A UI template</span>
                  <span class="font-['Inter'] text-[11px] text-[#a18d7b]">Locks the discount to one specific template product.</span>
                </button>
                <button type="button" (click)="selectCouponScope('MEMBERSHIP')" class="text-left p-4 rounded border border-[#1E293B] hover:border-[#3B82F6] transition-colors">
                  <span class="material-symbols-outlined text-[#3B82F6] mb-2 block">workspace_premium</span>
                  <span class="font-['Hanken_Grotesk'] font-bold text-white block">Membership plans</span>
                  <span class="font-['Inter'] text-[11px] text-[#a18d7b]">Applies at membership checkout only.</span>
                </button>
              </div>
            </div>
          }

          <!-- Step 2: pick the specific product -->
          @if (newCouponStep() === 2 && newCouponScope() === 'COURSE') {
            <div>
              <p class="font-['Inter'] text-sm text-white mb-3">Which course should this coupon apply to?</p>
              @if (!publishedCourses().length) {
                <p class="font-['JetBrains_Mono'] text-xs text-[#a18d7b]">No courses yet — create one from the Courses tab first.</p>
              } @else {
                <select [(ngModel)]="newCouponCourseId" class="w-full max-w-md bg-[#121A2B] border border-[#1E293B] rounded px-3 py-2.5 text-sm text-white font-['JetBrains_Mono']">
                  <option value="" disabled>Select a course…</option>
                  @for (course of publishedCourses(); track course.id) {
                    <option [value]="course.id">{{ course.title }}</option>
                  }
                </select>
                <p class="font-['JetBrains_Mono'] text-[10px] text-[#a18d7b] mt-2">Unique product ID: {{ newCouponCourseId || '—' }}</p>
              }
              <div class="flex gap-3 mt-5">
                <button type="button" (click)="goToCouponStep(1)" class="font-['JetBrains_Mono'] text-xs text-[#a18d7b] hover:text-white">← Back</button>
                <button type="button" [disabled]="!newCouponCourseId" (click)="goToCouponStep(3)" class="ml-auto font-['JetBrains_Mono'] text-xs font-bold text-[#040810] bg-[#3B82F6] hover:bg-[#2563EB] disabled:opacity-40 px-5 py-2 rounded transition-colors">Continue →</button>
              </div>
            </div>
          }
          @if (newCouponStep() === 2 && newCouponScope() === 'TEMPLATE') {
            <div>
              <p class="font-['Inter'] text-sm text-white mb-3">Which UI template product should this coupon apply to?</p>
              @if (isLoadingAdminTemplates()) {
                <p class="font-['JetBrains_Mono'] text-xs text-[#a18d7b]">Loading templates…</p>
              } @else if (!adminTemplates().length) {
                <p class="font-['JetBrains_Mono'] text-xs text-[#a18d7b]">No UI template products yet — add one from the Templates tab first.</p>
              } @else {
                <select [(ngModel)]="newCouponTemplateId" class="w-full max-w-md bg-[#121A2B] border border-[#1E293B] rounded px-3 py-2.5 text-sm text-white font-['JetBrains_Mono']">
                  <option value="" disabled>Select a UI template…</option>
                  @for (tpl of adminTemplates(); track tpl.id) {
                    <option [value]="tpl.id">{{ tpl.title }}</option>
                  }
                </select>
                <p class="font-['JetBrains_Mono'] text-[10px] text-[#a18d7b] mt-2">Unique product ID: {{ newCouponTemplateId || '—' }}</p>
              }
              <div class="flex gap-3 mt-5">
                <button type="button" (click)="goToCouponStep(1)" class="font-['JetBrains_Mono'] text-xs text-[#a18d7b] hover:text-white">← Back</button>
                <button type="button" [disabled]="!newCouponTemplateId" (click)="goToCouponStep(3)" class="ml-auto font-['JetBrains_Mono'] text-xs font-bold text-[#040810] bg-[#3B82F6] hover:bg-[#2563EB] disabled:opacity-40 px-5 py-2 rounded transition-colors">Continue →</button>
              </div>
            </div>
          }

          <!-- Step 3: discount -->
          @if (newCouponStep() === 3) {
            <div>
              <p class="font-['Inter'] text-sm text-white mb-3">How much discount should this coupon give?</p>
              <div class="flex gap-3 mb-4">
                <button type="button" (click)="newCouponDiscountType.set('percent')" class="px-4 py-2 rounded font-['JetBrains_Mono'] text-xs font-bold border transition-colors" [class.border-[#3B82F6]]="newCouponDiscountType() === 'percent'" [class.text-[#3B82F6]]="newCouponDiscountType() === 'percent'" [class.border-[#1E293B]]="newCouponDiscountType() !== 'percent'" [class.text-[#a18d7b]]="newCouponDiscountType() !== 'percent'">Percentage off</button>
                <button type="button" (click)="newCouponDiscountType.set('amount')" class="px-4 py-2 rounded font-['JetBrains_Mono'] text-xs font-bold border transition-colors" [class.border-[#3B82F6]]="newCouponDiscountType() === 'amount'" [class.text-[#3B82F6]]="newCouponDiscountType() === 'amount'" [class.border-[#1E293B]]="newCouponDiscountType() !== 'amount'" [class.text-[#a18d7b]]="newCouponDiscountType() !== 'amount'">Fixed ₹ off</button>
              </div>
              <div class="flex items-center gap-2 max-w-xs">
                @if (newCouponDiscountType() === 'percent') {
                  <input type="number" min="1" max="100" [(ngModel)]="newCouponDiscountValue" placeholder="e.g. 90" class="w-full bg-[#121A2B] border border-[#1E293B] rounded px-3 py-2.5 text-sm text-white font-['JetBrains_Mono']" />
                  <span class="font-['JetBrains_Mono'] text-white">%</span>
                } @else {
                  <span class="font-['JetBrains_Mono'] text-white">₹</span>
                  <input type="number" min="1" [(ngModel)]="newCouponDiscountValue" placeholder="e.g. 500" class="w-full bg-[#121A2B] border border-[#1E293B] rounded px-3 py-2.5 text-sm text-white font-['JetBrains_Mono']" />
                }
              </div>
              <div class="flex gap-3 mt-5">
                <button type="button" (click)="goToCouponStep(newCouponScope() === 'MEMBERSHIP' ? 1 : 2)" class="font-['JetBrains_Mono'] text-xs text-[#a18d7b] hover:text-white">← Back</button>
                <button type="button" [disabled]="!isCouponDiscountValid()" (click)="goToCouponStep(4)" class="ml-auto font-['JetBrains_Mono'] text-xs font-bold text-[#040810] bg-[#3B82F6] hover:bg-[#2563EB] disabled:opacity-40 px-5 py-2 rounded transition-colors">Continue →</button>
              </div>
            </div>
          }

          <!-- Step 4: code + confirm -->
          @if (newCouponStep() === 4) {
            <div>
              <p class="font-['Inter'] text-sm text-white mb-3">What should the coupon code be?</p>
              <input type="text" [(ngModel)]="newCouponCodeInput" placeholder="e.g. LAUNCH90" class="w-full max-w-xs bg-[#121A2B] border border-[#1E293B] rounded px-3 py-2.5 text-sm text-white font-['JetBrains_Mono'] uppercase" />

              <div class="mt-5 p-4 rounded border border-[#1E293B] bg-[#0A1120] font-['JetBrains_Mono'] text-[11px] text-[#d9c3af] max-w-md">
                <div class="flex justify-between py-1"><span class="text-[#a18d7b]">Applies to</span><span class="text-white">{{ couponWizardTargetLabel() }}</span></div>
                <div class="flex justify-between py-1"><span class="text-[#a18d7b]">Discount</span><span class="text-white">{{ newCouponDiscountType() === 'percent' ? (newCouponDiscountValue + '%') : ('₹' + newCouponDiscountValue) }} off</span></div>
                <div class="flex justify-between py-1"><span class="text-[#a18d7b]">Code</span><span class="text-[#3B82F6] font-bold">{{ (newCouponCodeInput || '—').toUpperCase() }}</span></div>
              </div>

              @if (newCouponError()) { <p role="alert" class="mt-3 text-xs text-red-400">{{ newCouponError() }}</p> }
              @if (newCouponFeedback()) { <p role="status" class="mt-3 text-xs text-emerald-400">{{ newCouponFeedback() }}</p> }

              <div class="flex gap-3 mt-5">
                <button type="button" (click)="goToCouponStep(3)" class="font-['JetBrains_Mono'] text-xs text-[#a18d7b] hover:text-white">← Back</button>
                <button type="button" [disabled]="!newCouponCodeInput.trim() || creatingCoupon()" (click)="createCouponFromWizard()" class="ml-auto font-['JetBrains_Mono'] text-xs font-bold text-[#040810] bg-[#3B82F6] hover:bg-[#2563EB] disabled:opacity-40 px-5 py-2 rounded transition-colors">{{ creatingCoupon() ? 'Creating…' : 'Create coupon' }}</button>
              </div>
            </div>
          }
        </div>

        <div class="bg-[#121A2B] technical-border rounded p-6 overflow-x-auto">
          <h3 class="font-['Hanken_Grotesk'] text-base font-bold text-white mb-4">All coupons</h3>
          @if (couponFeedback()) { <p role="status" class="mb-4 text-sm text-emerald-700 dark:text-emerald-300">{{ couponFeedback() }}</p> }
          @if (couponError()) { <p role="alert" class="mb-4 text-sm text-red-700 dark:text-red-300">{{ couponError() }}</p> }
          <table class="w-full text-left font-['Inter'] text-xs text-[#d9c3af]">
            <thead class="font-['JetBrains_Mono'] text-[11px] uppercase text-[#a18d7b] bg-[#040810]/60 border-b border-[#1E293B]">
              <tr>
                <th class="p-3">Code</th>
                <th class="p-3">Discount</th>
                <th class="p-3">Times Used</th>
                <th class="p-3">Product / Created</th>
                <th class="p-3">Status</th>
                <th class="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[#1E293B]/40">
              @for (coupon of coupons(); track coupon.id) {
                <tr>
                  <td class="p-3"><input [ngModel]="coupon.code" (ngModelChange)="updateCouponField(coupon.id, 'code', $event)" class="w-40 border border-[#1E293B] bg-[#040810] px-2 py-1.5 font-['JetBrains_Mono'] font-bold uppercase text-[#3B82F6]" /></td>
                  <td class="p-3"><div class="flex items-center gap-2"><span class="font-['JetBrains_Mono'] text-[10px] text-[#a18d7b]">{{ coupon.scope }}</span>@if (coupon.discountPercent) {<input type="number" min="1" max="100" [ngModel]="coupon.discountPercent" (ngModelChange)="updateCouponField(coupon.id, 'discountPercent', $event)" class="w-20 border border-[#1E293B] bg-[#040810] px-2 py-1.5 font-['JetBrains_Mono'] text-white" /><span>%</span>} @else {<span>₹</span><input type="number" min="1" [ngModel]="coupon.discountAmount" (ngModelChange)="updateCouponField(coupon.id, 'discountAmount', $event)" class="w-24 border border-[#1E293B] bg-[#040810] px-2 py-1.5 font-['JetBrains_Mono'] text-white" />}</div></td>
                  <td class="p-3 font-['JetBrains_Mono'] text-[#3B82F6]">{{ coupon.timesUsed }} / {{ coupon.usageLimit ?? 'Unlimited' }}</td>
                  <td class="p-3"><div>{{ couponCourseName(coupon) }}</div><div class="mt-1 text-slate-600 dark:text-slate-300">{{ coupon.createdAt | date: 'mediumDate' }}</div></td>
                  <td class="p-3"><button type="button" role="switch" [attr.aria-checked]="coupon.isActive" [attr.aria-label]="'Enable ' + coupon.code" [disabled]="!!savingCouponId()" (click)="toggleCoupon(coupon)" class="rounded-full border px-3 py-1.5 font-semibold disabled:opacity-50" [class.text-emerald-700]="coupon.isActive" [class.dark:text-emerald-300]="coupon.isActive">{{ coupon.isActive ? 'Active' : 'Inactive' }}</button></td>
                  <td class="p-3 text-right">
                    <button (click)="saveCoupon(coupon)" [disabled]="!!savingCouponId()" class="mr-4 font-['JetBrains_Mono'] text-[11px] font-bold text-[#3B82F6] hover:underline disabled:opacity-50">
                      {{ savingCouponId() === coupon.id ? 'Saving…' : (lastSavedCouponId() === coupon.id ? '✓ Saved!' : 'Save') }}
                    </button>
                    <button (click)="deleteCoupon(coupon.id)" [disabled]="!!savingCouponId()" class="font-['JetBrains_Mono'] text-[11px] text-red-700 dark:text-red-300 hover:underline disabled:opacity-50">Delete</button>
                    @if (lastSavedCouponId() === coupon.id) {
                      <div class="text-[10px] font-['JetBrains_Mono'] text-emerald-700 dark:text-emerald-300 mt-1">✓ Saved at {{ lastSavedTime() }}</div>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      <!-- TAB 5: MEMBERSHIP PROGRAM -->
      @if (activeTab() === 'membership') {
        <div class="flex flex-col gap-6">
          <div class="flex items-start justify-between gap-4 border-b border-[#1E293B] pb-4">
            <div><h2 class="font-['Hanken_Grotesk'] text-2xl font-bold text-white">Membership Program</h2>
            <p class="font-['Inter'] text-xs text-[#d9c3af] mt-1">
              Edit the membership copy, price, features, and which courses each plan unlocks. Changes are stored in the database and used by the public membership page.
            </p></div><button type="button" (click)="createMembershipPlan()" [disabled]="creatingMembershipPlan()" class="admin-action-primary shrink-0 bg-[#2563EB] px-4 py-2.5 font-['JetBrains_Mono'] text-xs font-bold uppercase !text-white disabled:opacity-50">{{ creatingMembershipPlan() ? 'Creating…' : 'New plan' }}</button>
          </div>

          <div class="border border-[#1E293B] bg-[#040810]/60 rounded-lg p-5 flex flex-col gap-3">
            <div>
              <h3 class="font-['Hanken_Grotesk'] text-base font-bold text-white">Membership coupon</h3>
              <p class="font-['Inter'] text-xs text-[#a18d7b] mt-1">Membership coupons are locked to membership checkout and cannot be used on a course.</p>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input type="text" [(ngModel)]="newMembershipCouponCode" placeholder="MEMBERSHIP CODE" class="bg-[#121A2B] border border-[#1E293B] rounded px-3 py-2 text-xs text-white font-['JetBrains_Mono'] uppercase" />
              <input type="number" min="0" [(ngModel)]="newMembershipCouponDiscount" placeholder="Discount (₹)" class="bg-[#121A2B] border border-[#1E293B] rounded px-3 py-2 text-xs text-white font-['JetBrains_Mono']" />
              <button type="button" (click)="createMembershipCoupon()" class="font-['JetBrains_Mono'] text-xs font-bold text-[#040810] bg-[#3B82F6] hover:bg-[#2563EB] py-2 rounded transition-colors">Save membership coupon</button>
              @if (membershipCouponFeedback()) {
                <div class="sm:col-span-3 text-xs font-['JetBrains_Mono'] text-emerald-400 flex items-center gap-1.5 animate-in fade-in duration-200">
                  <span class="material-symbols-outlined text-sm">check_circle</span>
                  {{ membershipCouponFeedback() }}
                </div>
              }
            </div>
          </div>

          @if (membershipPlans().length) {
            <div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
              @for (plan of membershipPlans(); track plan.id) {
                <article class="border border-[#1E293B] bg-[#040810]/60 rounded-lg p-6 flex flex-col gap-4">
                  <div class="flex items-start justify-between gap-4">
                    <div>
                      <span class="font-['JetBrains_Mono'] text-[10px] uppercase text-[#3B82F6]">{{ plan.interval }} · {{ plan.slug }}</span>
                      <h3 class="font-['Hanken_Grotesk'] text-xl font-bold text-white mt-1">{{ plan.name }}</h3>
                    </div>
                    <label class="inline-flex items-center gap-2 font-['JetBrains_Mono'] text-[10px] uppercase text-[#d9c3af]">
                      <input type="checkbox" [checked]="plan.isActive" (change)="updateMembershipPlanField(plan.id, 'isActive', $any($event.target).checked)" class="rounded bg-[#040810] border-[#1E293B] text-[#3B82F6] focus:ring-0" />
                      Active
                    </label>
                  </div>

                  <label class="font-['Inter'] text-xs text-[#a18d7b]">Display name
                    <input type="text" [ngModel]="plan.name" (ngModelChange)="updateMembershipPlanField(plan.id, 'name', $event)" class="mt-1 w-full bg-[#040810] border border-[#1E293B] rounded px-3 py-2 text-sm text-white" />
                  </label>

                  <label class="font-['Inter'] text-xs text-[#a18d7b]">Membership description
                    <textarea rows="3" [ngModel]="plan.description || ''" (ngModelChange)="updateMembershipPlanField(plan.id, 'description', $event)" class="mt-1 w-full bg-[#040810] border border-[#1E293B] rounded px-3 py-2 text-sm text-white"></textarea>
                  </label>

                  <div class="grid grid-cols-1 gap-4">
                    <label class="font-['Inter'] text-xs text-[#a18d7b]">Price (₹)
                      <input type="number" min="0" [ngModel]="plan.price" (ngModelChange)="updateMembershipPlanField(plan.id, 'price', $event)" class="mt-1 w-full bg-[#040810] border border-[#1E293B] rounded px-3 py-2 text-sm text-[#3B82F6] font-bold" />
                    </label>

                    <!-- Item-by-Item Modern Features Editor -->
                    <div class="border border-[#1E293B] bg-[#040810] rounded-lg p-4 flex flex-col gap-3">
                      <div class="flex items-center justify-between">
                        <div>
                          <span class="font-['Hanken_Grotesk'] text-xs font-bold text-white uppercase tracking-wider">Plan Features</span>
                          <p class="font-['Inter'] text-[11px] text-[#a18d7b]">Shown to learners on the pricing & membership page</p>
                        </div>
                        <button
                          type="button"
                          (click)="addPlanFeature(plan.id)"
                          class="font-['JetBrains_Mono'] text-xs font-bold text-[#3B82F6] hover:text-[#60A5FA] bg-[#3B82F6]/10 hover:bg-[#3B82F6]/20 border border-[#3B82F6]/40 px-3 py-1.5 rounded flex items-center gap-1 transition-colors"
                        >
                          <span class="material-symbols-outlined text-sm">add</span>
                          Add Feature
                        </button>
                      </div>

                      <div class="flex flex-col gap-2.5 mt-1">
                        @for (feature of plan.features; track $index) {
                          <div class="flex items-center gap-2">
                            <span class="material-symbols-outlined text-sm text-emerald-400 shrink-0">check_circle</span>
                            <input
                              type="text"
                              [ngModel]="feature"
                              (ngModelChange)="updatePlanFeature(plan.id, $index, $event)"
                              placeholder="e.g. Unlimited access to every architecture course"
                              class="flex-1 bg-[#121A2B] border border-[#1E293B] focus:border-[#3B82F6] rounded px-3 py-1.5 text-xs text-white outline-none font-['Inter'] transition-colors"
                            />
                            <button
                              type="button"
                              (click)="removePlanFeature(plan.id, $index)"
                              class="text-red-400 hover:text-red-300 p-1.5 hover:bg-red-500/10 rounded transition-colors"
                              title="Delete feature"
                            >
                              <span class="material-symbols-outlined text-base leading-none">delete</span>
                            </button>
                          </div>
                        }
                      </div>
                    </div>
                  </div>

                  <label class="inline-flex items-center gap-2 font-['Inter'] text-xs text-[#d9c3af]">
                    <input type="checkbox" [checked]="plan.accessAllCourses" (change)="updateMembershipPlanField(plan.id, 'accessAllCourses', $any($event.target).checked)" class="rounded bg-[#040810] border-[#1E293B] text-[#3B82F6] focus:ring-0" />
                    Unlock all published courses
                  </label>

                  @if (!plan.accessAllCourses) {
                    <div class="border border-[#1E293B] rounded p-3 flex flex-col gap-2">
                      <span class="font-['JetBrains_Mono'] text-[10px] uppercase text-[#a18d7b]">Selected course access</span>
                      @for (course of publishedCourses(); track course.id) {
                        <label class="inline-flex items-center gap-2 font-['Inter'] text-xs text-[#d9c3af]">
                          <input type="checkbox" [checked]="hasPlanCourse(plan, course.id)" (change)="toggleMembershipCourse(plan.id, course.id, $any($event.target).checked)" class="rounded bg-[#040810] border-[#1E293B] text-[#3B82F6] focus:ring-0" />
                          {{ course.title }}
                        </label>
                      }
                    </div>
                  }

                  <div class="flex flex-col gap-2">
                    <div class="flex items-center gap-4">
                      <button type="button" (click)="saveMembershipPlan(plan)" [disabled]="savingMembershipPlanId() === plan.id" class="self-start bg-[#3B82F6] px-5 py-2.5 font-['JetBrains_Mono'] text-xs font-bold uppercase text-[#040810] hover:bg-[#2563eb] disabled:opacity-60 transition-all flex items-center gap-1.5">
                        <span class="material-symbols-outlined text-sm">{{ savingMembershipPlanId() === plan.id ? 'progress_activity' : (lastSavedPlanId() === plan.id ? 'check_circle' : 'save') }}</span>
                        {{ savingMembershipPlanId() === plan.id ? 'Saving...' : (lastSavedPlanId() === plan.id ? 'Saved!' : 'Save membership plan') }}
                      </button>
                      <button type="button" (click)="deleteMembershipPlan(plan)" class="font-['JetBrains_Mono'] text-[11px] text-[#ffb4ab] hover:underline">Delete plan</button>
                    </div>
                    @if (lastSavedPlanId() === plan.id) {
                      <div class="text-xs font-['JetBrains_Mono'] text-emerald-400 flex items-center gap-1.5 animate-in fade-in duration-200">
                        <span class="material-symbols-outlined text-sm">check_circle</span>
                        Plan saved successfully at {{ lastSavedTime() }}! Changes are live on the website.
                      </div>
                    }
                  </div>
                </article>
              }
            </div>
          } @else {
            <div class="border border-dashed border-[#3B82F6]/50 rounded-lg px-6 py-14 text-center font-['Inter'] text-sm text-[#a18d7b]">Membership plans are not available yet.</div>
          }
        </div>
      }

      <!-- TAB 6: SUPPORT & CONTACT INQUIRIES -->
      @if (activeTab() === 'support') {
        <div class="flex flex-col gap-6">
          <div class="flex items-start justify-between gap-4 border-b border-[#1E293B] pb-4">
            <div>
              <h2 class="font-['Hanken_Grotesk'] text-2xl font-bold text-white">Customer Support & Inquiries</h2>
              <p class="font-['Inter'] text-xs text-[#d9c3af] mt-1">
                Messages sent by students and prospective learners through the Contact form.
              </p>
            </div>
            <div class="font-['JetBrains_Mono'] text-xs text-[#a18d7b] bg-[#121A2B] px-3.5 py-1.5 rounded border border-[#1E293B]">
              Total Messages: {{ contactMessages().length }}
            </div>
          </div>

          @if (contactMessages().length) {
            <div class="grid grid-cols-1 gap-4">
              @for (msg of contactMessages(); track msg.id) {
                <div class="border border-slate-200 bg-white dark:border-[#1E293B] dark:bg-[#040810]/70 rounded-xl p-5 flex flex-col gap-3 transition-all hover:border-[#3B82F6]/50 shadow-sm dark:shadow-md">
                  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div class="flex items-center gap-3">
                      <span class="font-['Hanken_Grotesk'] text-base font-bold text-slate-900 dark:text-white">{{ msg.name }}</span>
                      <a [href]="'mailto:' + msg.email" class="font-['JetBrains_Mono'] text-xs text-[#2563EB] dark:text-[#3B82F6] hover:underline">{{ msg.email }}</a>
                    </div>
                    <div class="flex items-center gap-3">
                      <span
                        [class.bg-blue-50]="msg.status === 'NEW'"
                        [class.text-blue-700]="msg.status === 'NEW'"
                        [class.border-blue-200]="msg.status === 'NEW'"
                        [class.dark:bg-blue-900/40]="msg.status === 'NEW'"
                        [class.dark:text-blue-400]="msg.status === 'NEW'"
                        [class.dark:border-blue-500/30]="msg.status === 'NEW'"
                        [class.bg-emerald-50]="msg.status === 'RESOLVED'"
                        [class.text-emerald-700]="msg.status === 'RESOLVED'"
                        [class.border-emerald-200]="msg.status === 'RESOLVED'"
                        [class.dark:bg-emerald-900/40]="msg.status === 'RESOLVED'"
                        [class.dark:text-emerald-400]="msg.status === 'RESOLVED'"
                        [class.dark:border-emerald-500/30]="msg.status === 'RESOLVED'"
                        class="border px-2.5 py-0.5 rounded-full font-['JetBrains_Mono'] text-[10px] uppercase font-bold"
                      >
                        {{ msg.status }}
                      </span>
                      <span class="font-['JetBrains_Mono'] text-[11px] text-slate-500 dark:text-[#a18d7b]">{{ msg.createdAt | date:'medium' }}</span>
                    </div>
                  </div>

                  <div class="font-['JetBrains_Mono'] text-xs font-semibold text-[#1D4ED8] dark:text-[#60A5FA]">
                    Subject: {{ msg.subject }}
                  </div>

                  <p class="font-['Inter'] text-sm text-slate-700 dark:text-[#e0e3e5] leading-relaxed bg-slate-50 border border-slate-200 dark:bg-[#121A2B]/60 dark:border-[#1E293B] p-4 rounded-lg">
                    {{ msg.message }}
                  </p>

                  <div class="flex items-center justify-end gap-3 pt-2">
                    <a
                      [href]="'mailto:' + msg.email + '?subject=' + encodeUri('Re: ' + msg.subject)"
                      class="font-['JetBrains_Mono'] text-xs uppercase tracking-wider text-[#2563EB] border border-[#2563EB]/40 bg-blue-50/50 hover:bg-blue-100/60 dark:text-[#3B82F6] dark:border-[#3B82F6]/40 dark:bg-transparent dark:hover:bg-[#3B82F6]/10 px-3 py-1.5 rounded flex items-center gap-1.5 transition-colors font-medium"
                    >
                      <span class="material-symbols-outlined text-sm">reply</span>
                      Reply via Email
                    </a>

                    <button
                      (click)="toggleMessageStatus(msg.id)"
                      class="font-['JetBrains_Mono'] text-xs uppercase tracking-wider text-slate-700 border border-slate-300 bg-white hover:bg-slate-100 dark:text-slate-300 dark:border-slate-700 dark:bg-transparent dark:hover:bg-slate-800 px-3 py-1.5 rounded flex items-center gap-1.5 transition-colors font-medium"
                    >
                      <span class="material-symbols-outlined text-sm">
                        {{ msg.status === 'NEW' ? 'check_circle' : 'mark_chat_unread' }}
                      </span>
                      {{ msg.status === 'NEW' ? 'Mark Resolved' : 'Mark as New' }}
                    </button>

                    <button
                      (click)="deleteMessage(msg.id)"
                      class="font-['JetBrains_Mono'] text-xs uppercase tracking-wider text-red-600 border border-red-200 bg-red-50/50 hover:bg-red-100/60 dark:text-red-400 dark:border-red-500/30 dark:bg-transparent dark:hover:bg-red-500/10 px-3 py-1.5 rounded flex items-center gap-1.5 transition-colors font-medium"
                    >
                      <span class="material-symbols-outlined text-sm">delete</span>
                      Delete
                    </button>
                  </div>
                </div>
              }
            </div>
          } @else {
            <div class="border border-dashed border-[#1E293B] rounded-lg p-12 text-center font-['Inter'] text-sm text-[#a18d7b]">
              No contact inquiries received yet. Any messages submitted via the Contact page will appear here instantly.
            </div>
          }
        </div>
      }

      <!-- TAB 7: SITE SETTINGS & ANNOUNCEMENT BANNER -->
      @if (activeTab() === 'settings') {
        <div class="flex flex-col gap-8">
          <div class="border-b border-[#1E293B] pb-4">
            <h2 class="font-['Hanken_Grotesk'] text-2xl font-bold text-white">Site Settings & Banner Configuration</h2>
            <p class="font-['Inter'] text-xs text-[#d9c3af] mt-1">
              Customize hero typing topics, banner alerts, and global academy settings.
            </p>
          </div>

          <!-- Section 1: Hero Typing Animation Words -->
          <div class="border border-[#1E293B] bg-[#040810]/60 rounded-xl p-4 sm:p-6 flex flex-col gap-5">
            <div class="flex items-start justify-between gap-4">
              <div>
                <h3 class="font-['Hanken_Grotesk'] text-lg font-bold text-white flex items-center gap-2">
                  <span class="material-symbols-outlined text-[#3B82F6]">keyboard</span>
                  Hero Typing Animation Words
                </h3>
                <p class="font-['Inter'] text-xs text-[#a18d7b] mt-1">
                  Words that cycle dynamically in the homepage hero section: <em>"Learn [Word] | Think. Build. Innovate."</em>
                </p>
              </div>
            </div>

            <!-- Typing words chips/list -->
            <div class="flex flex-wrap items-center gap-2 min-h-[44px] p-3 bg-[#121A2B] border border-[#1E293B] rounded-lg">
              @for (word of editingTypingWords; track $index) {
                <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#3B82F6]/15 border border-[#3B82F6]/40 text-[#60A5FA] font-['JetBrains_Mono'] text-xs font-semibold">
                  {{ word }}
                  <button type="button" (click)="removeTypingWord($index)" class="text-slate-400 hover:text-white ml-1">
                    <span class="material-symbols-outlined text-xs">close</span>
                  </button>
                </span>
              }
            </div>

            <!-- Add new word input -->
            <div class="flex flex-col sm:flex-row gap-3 max-w-xl">
              <input
                type="text"
                [(ngModel)]="newTypingWordInput"
                (keyup.enter)="addTypingWord()"
                placeholder="Enter topic (e.g. Agentic AI, Python, React)..."
                class="flex-1 bg-[#121A2B] border border-[#1E293B] focus:border-[#3B82F6] rounded-lg px-3 py-2 text-xs text-white outline-none font-['Inter']"
              />
              <button
                type="button"
                (click)="addTypingWord()"
                class="font-['JetBrains_Mono'] text-xs font-bold uppercase !text-white bg-[#2563EB] hover:bg-[#1D4ED8] px-4 py-2 rounded-lg transition-colors flex items-center gap-1 shadow-sm"
              >
                <span class="material-symbols-outlined text-sm">add</span>
                Add Word
              </button>
            </div>
          </div>

          <!-- Section 2: Top Announcement Bar / Advertisement Banner -->
          <div class="border border-[#1E293B] bg-[#040810]/60 rounded-xl p-4 sm:p-6 flex flex-col gap-5">
            <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div>
                <h3 class="font-['Hanken_Grotesk'] text-lg font-bold text-white flex items-center gap-2">
                  <span class="material-symbols-outlined text-[#3B82F6]">campaign</span>
                  Top Announcement Bar (Advertisement / Offer Banner)
                </h3>
                <p class="font-['Inter'] text-xs text-[#a18d7b] mt-1">
                  Displays a persistent, high-converting banner at the very top of all pages across the website.
                </p>
              </div>

              <label class="admin-toggle inline-flex w-fit items-center gap-2 cursor-pointer rounded-full border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-[#121A2B] px-2.5 py-1.5">
                <input
                  type="checkbox"
                  [(ngModel)]="editingAnnouncementBar.enabled"
                  class="sr-only peer"
                />
                <div class="relative w-11 h-6 bg-slate-400 dark:bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#2563EB]"></div>
                <span class="font-['JetBrains_Mono'] text-[11px] font-bold uppercase text-slate-700 dark:text-white">
                  {{ editingAnnouncementBar.enabled ? 'Enabled' : 'Disabled' }}
                </span>
              </label>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="md:col-span-2">
                <label for="announcement-message" class="block font-['JetBrains_Mono'] text-xs text-[#a18d7b] uppercase mb-1">Banner Announcement Text</label>
                <input
                  id="announcement-message"
                  type="text"
                  [(ngModel)]="editingAnnouncementBar.message"
                  placeholder="e.g. 🔥 Special Launch Offer: Get 50% OFF on all courses! Use code TECHNYKS50"
                  class="w-full bg-[#121A2B] border border-[#1E293B] focus:border-[#3B82F6] rounded-lg px-4 py-2.5 text-xs text-white outline-none font-['Inter']"
                />
              </div>

              <div>
                <label for="announcement-badge" class="block font-['JetBrains_Mono'] text-xs text-[#a18d7b] uppercase mb-1">Badge Text (Optional)</label>
                <input
                  id="announcement-badge"
                  type="text"
                  [(ngModel)]="editingAnnouncementBar.badgeText"
                  placeholder="e.g. SPECIAL OFFER / NEW / 50% OFF"
                  class="w-full bg-[#121A2B] border border-[#1E293B] focus:border-[#3B82F6] rounded-lg px-4 py-2.5 text-xs text-white outline-none font-['JetBrains_Mono']"
                />
              </div>

              <div>
                <label for="announcement-theme" class="block font-['JetBrains_Mono'] text-xs text-[#a18d7b] uppercase mb-1">Banner Color Theme</label>
                <select
                  id="announcement-theme"
                  [(ngModel)]="editingAnnouncementBar.theme"
                  class="w-full bg-[#121A2B] border border-[#1E293B] focus:border-[#3B82F6] rounded-lg px-4 py-2.5 text-xs text-white outline-none font-['JetBrains_Mono']"
                >
                  <option value="blue">Royal Blue (Standard)</option>
                  <option value="amber">Amber / Gold (High Alert / Promo)</option>
                  <option value="emerald">Emerald Green (Discount / Launch)</option>
                  <option value="purple">Vibrant Purple</option>
                </select>
              </div>

              <div>
                <label for="announcement-button-text" class="block font-['JetBrains_Mono'] text-xs text-[#a18d7b] uppercase mb-1">Button Call-to-Action Text</label>
                <input
                  id="announcement-button-text"
                  type="text"
                  [(ngModel)]="editingAnnouncementBar.buttonText"
                  placeholder="e.g. Claim Offer →"
                  class="w-full bg-[#121A2B] border border-[#1E293B] focus:border-[#3B82F6] rounded-lg px-4 py-2.5 text-xs text-white outline-none font-['Inter']"
                />
              </div>

              <div>
                <label for="announcement-button-url" class="block font-['JetBrains_Mono'] text-xs text-[#a18d7b] uppercase mb-1">Button Destination Link / URL</label>
                <input
                  id="announcement-button-url"
                  type="text"
                  [(ngModel)]="editingAnnouncementBar.buttonUrl"
                  placeholder="e.g. /courses or /checkout?coupon=TECHNYKS50 or https://..."
                  class="w-full bg-[#121A2B] border border-[#1E293B] focus:border-[#3B82F6] rounded-lg px-4 py-2.5 text-xs text-white outline-none font-['JetBrains_Mono']"
                />
              </div>
            </div>
          </div>

          <!-- Save Settings Action Button -->
          <div class="flex flex-col sm:flex-row sm:items-center gap-3" aria-live="polite">
            <button
              type="button"
              (click)="saveSiteSettings()"
              [disabled]="isSavingSettings()"
              [class.settings-save-button-saving]="isSavingSettings()"
              [class.settings-save-button-saved]="!!settingsSavedFeedback()"
              class="settings-save-button w-full sm:w-auto justify-center font-['JetBrains_Mono'] text-xs font-bold uppercase !text-white bg-[#2563EB] hover:bg-[#1D4ED8] px-8 py-3.5 rounded-xl transition-all shadow-lg flex items-center gap-2 disabled:cursor-wait"
            >
              <span class="material-symbols-outlined text-sm" [class.animate-spin]="isSavingSettings()">{{ isSavingSettings() ? 'progress_activity' : (settingsSavedFeedback() ? 'check_circle' : 'save') }}</span>
              {{ isSavingSettings() ? 'Saving Settings...' : (settingsSavedFeedback() ? 'Settings Saved!' : 'Save All Settings') }}
            </button>

            @if (settingsSavedFeedback()) {
              <span class="settings-saved-feedback text-xs font-['JetBrains_Mono'] text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-700/50 px-3 py-2 rounded-lg flex items-center gap-1.5 animate-in fade-in duration-200">
                <span class="material-symbols-outlined text-sm">check_circle</span>
                {{ settingsSavedFeedback() }}
              </span>
            }
          </div>
        </div>
      }
      </main>
    </div>
  `,
})
export class AdminDashboardComponent implements OnInit {
  private adminService = inject(AdminService);
  private coursesService = inject(CoursesService);
  private templatesService = inject(TemplatesService);
  private contactService = inject(ContactService);
  private siteSettingsService = inject(SiteSettingsService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  readonly adminNavigation: Array<{
    label: string;
    items: Array<{ id: AdminTab; label: string; icon: string }>;
  }> = [
    {
      label: 'Learning business',
      items: [
        { id: 'courses', label: 'Courses', icon: 'play_lesson' },
        { id: 'revenue', label: 'Course sales', icon: 'monitoring' },
        { id: 'students', label: 'Students', icon: 'group' },
        { id: 'membership', label: 'Memberships', icon: 'workspace_premium' },
      ],
    },
    {
      label: 'Digital products',
      items: [
        { id: 'templates', label: 'UI templates', icon: 'inventory_2' },
        {
          id: 'template-orders',
          label: 'Template orders',
          icon: 'receipt_long',
        },
      ],
    },
    {
      label: 'Engagement',
      items: [
        { id: 'communication', label: 'Communication', icon: 'campaign' },
        { id: 'coupons', label: 'Coupons', icon: 'sell' },
        { id: 'support', label: 'Support', icon: 'support_agent' },
      ],
    },
    {
      label: 'System',
      items: [{ id: 'settings', label: 'Site settings', icon: 'tune' }],
    },
  ];
  activeTab = signal<AdminTab>('courses');
  activeTitle = computed(() => {
    const titles: Record<AdminTab, string> = {
      courses: 'Course Management',
      templates: 'UI Template Products',
      'template-orders': 'Template Orders & Sales',
      revenue: 'Course Sales & Analytics',
      students: 'Student Directory',
      coupons: 'Coupon Management',
      membership: 'Membership Program',
      communication: 'Communication Center',
      support: 'Customer Support',
      settings: 'Site Settings & Banner',
    };
    return titles[this.activeTab()];
  });
  metrics = signal<RevenueMetrics | null>(null);
  students = signal<Student[]>([]);
  coupons = signal<Coupon[]>([]);
  membershipPlans = signal<MembershipPlan[]>([]);
  contactMessages = signal<ContactMessage[]>([]);
  unreadMessagesCount = computed(
    () => this.contactMessages().filter((m) => m.status === 'NEW').length,
  );

  savingMembershipPlanId = signal<string | null>(null);
  savingCouponId = signal<string | null>(null);
  couponFeedback = signal('');
  couponError = signal('');
  lastSavedPlanId = signal<string | null>(null);
  lastSavedCouponId = signal<string | null>(null);
  lastSavedTime = signal<string>('');
  membershipCouponFeedback = signal<string>('');
  creatingMembershipPlan = signal(false);
  publishedCourses = signal<Course[]>([]);
  isLoadingCourses = signal(true);

  // Site Settings & Banners state
  editingTypingWords: string[] = [];
  newTypingWordInput = '';
  editingAnnouncementBar: AnnouncementBarSettings = {
    enabled: true,
    message:
      '🚀 Special Launch: Complete TypeScript & JavaScript Masterclasses are now LIVE!',
    buttonText: 'Explore Courses',
    buttonUrl: '/courses',
    badgeText: 'NEW',
    theme: 'blue',
  };
  isSavingSettings = signal(false);
  settingsSavedFeedback = signal('');

  searchCourseQuery = '';
  sortBy = 'Newest';
  newMembershipCouponCode = '';
  newMembershipCouponDiscount: number | null = 1000;

  // Guided "create a new coupon" wizard (Coupon Management tab)
  newCouponStep = signal(1);
  newCouponScope = signal<'COURSE' | 'TEMPLATE' | 'MEMBERSHIP' | null>(null);
  newCouponDiscountType = signal<'percent' | 'amount'>('percent');
  newCouponCourseId = '';
  newCouponTemplateId = '';
  newCouponDiscountValue: number | null = null;
  newCouponCodeInput = '';
  creatingCoupon = signal(false);
  newCouponFeedback = signal('');
  newCouponError = signal('');
  adminTemplates = signal<AdminUiTemplate[]>([]);
  isLoadingAdminTemplates = signal(false);

  ngOnInit() {
    const requestedTab = this.route.snapshot.queryParamMap.get(
      'tab',
    ) as AdminTab | null;
    if (
      requestedTab &&
      this.adminNavigation.some((group) =>
        group.items.some((item) => item.id === requestedTab),
      )
    ) {
      this.activeTab.set(requestedTab);
    }
    this.loadCourses();
    this.adminService.getMetrics().subscribe((data) => this.metrics.set(data));
    this.adminService
      .searchStudents('')
      .subscribe((data) => this.students.set(data));
    this.adminService
      .getCoupons()
      .subscribe({
        next: (data) => this.coupons.set(data),
        error: () =>
          this.couponError.set(
            'Coupons could not be loaded. Please refresh to retry.',
          ),
      });
    this.loadAdminTemplatesForCoupon();
    this.adminService
      .getMembershipPlans()
      .subscribe((data) => this.membershipPlans.set(data));
    this.contactService.messages$.subscribe((messages) =>
      this.contactMessages.set(messages),
    );
    this.contactService.getMessages().subscribe();

    const currentSettings = this.siteSettingsService.settings();
    this.editingTypingWords = [
      ...(currentSettings.typingWords || [
        'NN',
        'Full Stack',
        'Data Science',
        'Data Engineering',
      ]),
    ];
    this.editingAnnouncementBar = { ...currentSettings.announcementBar };
    this.siteSettingsService.fetchRemoteSettings().subscribe((remote) => {
      if (!remote) return;
      this.editingTypingWords = [...remote.typingWords];
      this.editingAnnouncementBar = { ...remote.announcementBar };
    });
  }

  addTypingWord() {
    const word = this.newTypingWordInput.trim();
    if (!word) return;
    if (!this.editingTypingWords.includes(word)) {
      this.editingTypingWords.push(word);
    }
    this.newTypingWordInput = '';
  }

  removeTypingWord(index: number) {
    this.editingTypingWords.splice(index, 1);
  }

  saveSiteSettings() {
    this.isSavingSettings.set(true);
    if (!this.editingTypingWords.length) {
      this.editingTypingWords = [
        'NN',
        'Full Stack',
        'Data Science',
        'Data Engineering',
      ];
    }

    this.siteSettingsService
      .updateSettings({
        typingWords: [...this.editingTypingWords],
        announcementBar: { ...this.editingAnnouncementBar },
      })
      .subscribe({
        next: (saved) => {
          this.editingTypingWords = [...saved.typingWords];
          this.editingAnnouncementBar = { ...saved.announcementBar };
          this.isSavingSettings.set(false);
          this.settingsSavedFeedback.set(
            'Settings and banner configuration saved for all visitors.',
          );
          setTimeout(() => this.settingsSavedFeedback.set(''), 5000);
        },
        error: (error) => {
          this.isSavingSettings.set(false);
          alert(
            error?.error?.message ||
              'The settings were kept in this browser, but the server could not save them. Please try again.',
          );
        },
      });
  }

  addPlanFeature(planId: string) {
    this.membershipPlans.update((plans) =>
      plans.map((plan) => {
        if (plan.id !== planId) return plan;
        const features = Array.isArray(plan.features) ? [...plan.features] : [];
        features.push('New included feature');
        return { ...plan, features, featuresText: features.join('\n') };
      }),
    );
  }

  removePlanFeature(planId: string, index: number) {
    this.membershipPlans.update((plans) =>
      plans.map((plan) => {
        if (plan.id !== planId) return plan;
        const features = Array.isArray(plan.features) ? [...plan.features] : [];
        features.splice(index, 1);
        return { ...plan, features, featuresText: features.join('\n') };
      }),
    );
  }

  updatePlanFeature(planId: string, index: number, value: string) {
    this.membershipPlans.update((plans) =>
      plans.map((plan) => {
        if (plan.id !== planId) return plan;
        const features = Array.isArray(plan.features) ? [...plan.features] : [];
        features[index] = value;
        return { ...plan, features, featuresText: features.join('\n') };
      }),
    );
  }

  loadCourses() {
    this.coursesService.getAllCoursesAdmin().subscribe({
      next: (data) => {
        this.publishedCourses.set(data);
        this.isLoadingCourses.set(false);
      },
      error: () => this.isLoadingCourses.set(false),
    });
  }

  filteredCourses(): Course[] {
    const q = this.searchCourseQuery.toLowerCase();
    const filtered = this.publishedCourses().filter(
      (c) =>
        c.title.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q),
    );
    return [...filtered].sort((a, b) => {
      if (this.sortBy === 'Oldest')
        return this.createdTime(a) - this.createdTime(b);
      if (this.sortBy === 'Popular')
        return (b.enrollmentsThisMonth || 0) - (a.enrollmentsThisMonth || 0);
      return this.createdTime(b) - this.createdTime(a);
    });
  }

  createNewCourse() {
    const newCourse: Course = {
      id: 'course-' + Date.now(),
      slug: 'new-course-' + Date.now(),
      title: 'New Architecture Course (Draft)',
      subtitle: 'Build high-performance software systems.',
      description: 'Comprehensive hands-on architectural masterclass.',
      thumbnail: '/assets/course-agentic-ai.png',
      price: 4999,
      isFree: false,
      currency: 'INR',
      level: 'Advanced',
      category: 'Software Architecture',
      status: 'DRAFT',
      isPublished: false,
      earnedThisMonth: 0,
      enrollmentsThisMonth: 0,
      rating: 0,
      modules: [],
    };

    this.coursesService.createCourse(newCourse).subscribe({
      next: (created) => {
        this.router.navigate(['/admin/courses', created.id, 'manage']);
      },
    });
  }

  featuresText(plan: MembershipPlan): string {
    return plan.featuresText ?? (plan.features || []).join('\n');
  }

  updateMembershipPlanField(planId: string, field: string, value: any) {
    this.membershipPlans.update((plans) =>
      plans.map((plan) =>
        plan.id === planId ? { ...plan, [field]: value } : plan,
      ),
    );
  }

  hasPlanCourse(plan: MembershipPlan, courseId: string): boolean {
    return (plan.courseAccess || []).some(
      (access) => access.courseId === courseId,
    );
  }

  toggleMembershipCourse(planId: string, courseId: string, selected: boolean) {
    this.membershipPlans.update((plans) =>
      plans.map((plan) => {
        if (plan.id !== planId) return plan;
        const current = new Set(
          (plan.courseAccess || []).map((access) => access.courseId),
        );
        if (selected) current.add(courseId);
        else current.delete(courseId);
        return {
          ...plan,
          courseAccess: [...current].map((id) => ({ courseId: id })),
        };
      }),
    );
  }

  saveMembershipPlan(plan: MembershipPlan) {
    this.savingMembershipPlanId.set(plan.id);
    this.adminService
      .updateMembershipPlan(plan.id, {
        name: plan.name,
        slug: plan.slug,
        description: plan.description || '',
        price: Number(plan.price) || 0,
        currency: plan.currency,
        interval: plan.interval,
        isFree: plan.isFree,
        isActive: plan.isActive,
        accessAllCourses: plan.accessAllCourses,
        featuresText: this.featuresText(plan),
        courseIds: (plan.courseAccess || []).map((access) => access.courseId),
      })
      .subscribe({
        next: (saved) => {
          this.membershipPlans.update((plans) =>
            plans.map((candidate) =>
              candidate.id === saved.id ? saved : candidate,
            ),
          );
          this.savingMembershipPlanId.set(null);
          this.lastSavedPlanId.set(saved.id);
          this.lastSavedTime.set(
            new Date().toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            }),
          );
          setTimeout(() => {
            if (this.lastSavedPlanId() === saved.id) {
              this.lastSavedPlanId.set(null);
            }
          }, 6000);
        },
        error: () => {
          this.savingMembershipPlanId.set(null);
          alert('The membership plan could not be saved. Please try again.');
        },
      });
  }

  createMembershipPlan() {
    this.creatingMembershipPlan.set(true);
    this.adminService
      .createMembershipPlan({
        name: 'New Membership Plan',
        slug: `membership-${Date.now().toString(36)}`,
        description: 'Describe the value and access included in this plan.',
        price: 999,
        currency: 'INR',
        interval: 'MONTHLY',
        isFree: false,
        isActive: false,
        accessAllCourses: true,
        features: ['All included courses'],
        courseIds: [],
      })
      .subscribe({
        next: (plan) => {
          this.membershipPlans.update((plans) => [...plans, plan]);
          this.creatingMembershipPlan.set(false);
        },
        error: (error) => {
          this.creatingMembershipPlan.set(false);
          alert(
            error?.error?.message ||
              'The membership plan could not be created.',
          );
        },
      });
  }

  deleteMembershipPlan(plan: MembershipPlan) {
    if (
      typeof window === 'undefined' ||
      !window.confirm(`Delete “${plan.name}”?`)
    )
      return;
    this.adminService.deleteMembershipPlan(plan.id).subscribe({
      next: () =>
        this.membershipPlans.update((plans) =>
          plans.filter((candidate) => candidate.id !== plan.id),
        ),
      error: (error) =>
        alert(
          error?.error?.message || 'The membership plan could not be deleted.',
        ),
    });
  }

  updateCouponField(id: string, field: keyof Coupon, value: unknown) {
    this.coupons.update((coupons) =>
      coupons.map((coupon) =>
        coupon.id === id ? { ...coupon, [field]: value } : coupon,
      ),
    );
  }

  saveCoupon(coupon: Coupon) {
    if (this.savingCouponId()) return;
    this.couponError.set('');
    this.couponFeedback.set('');
    this.savingCouponId.set(coupon.id);
    this.adminService.updateCoupon(coupon.id, coupon).subscribe({
      next: (saved) => {
        this.coupons.update((coupons) =>
          coupons.map((candidate) =>
            candidate.id === saved.id ? saved : candidate,
          ),
        );
        this.savingCouponId.set(null);
        this.lastSavedCouponId.set(saved.id);
        this.couponFeedback.set(
          `Coupon ${saved.code} saved. Status: ${saved.isActive ? 'Active' : 'Inactive'}.`,
        );
        this.lastSavedTime.set(
          new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }),
        );
      },
      error: (error) => {
        this.savingCouponId.set(null);
        this.couponError.set(
          error?.error?.message || 'The coupon could not be updated.',
        );
      },
    });
  }

  selectCouponScope(scope: 'COURSE' | 'TEMPLATE' | 'MEMBERSHIP') {
    this.newCouponScope.set(scope);
    this.newCouponCourseId = '';
    this.newCouponTemplateId = '';
    this.newCouponError.set('');
    if (scope === 'TEMPLATE' && !this.adminTemplates().length && !this.isLoadingAdminTemplates()) {
      this.loadAdminTemplatesForCoupon();
    }
    this.newCouponStep.set(scope === 'MEMBERSHIP' ? 3 : 2);
  }

  goToCouponStep(step: number) {
    this.newCouponError.set('');
    this.newCouponStep.set(step);
  }

  loadAdminTemplatesForCoupon() {
    this.isLoadingAdminTemplates.set(true);
    this.templatesService.listAdmin().subscribe({
      next: (data) => {
        this.adminTemplates.set(data);
        this.isLoadingAdminTemplates.set(false);
      },
      error: () => this.isLoadingAdminTemplates.set(false),
    });
  }

  isCouponDiscountValid(): boolean {
    const value = Number(this.newCouponDiscountValue);
    if (!Number.isFinite(value) || value <= 0) return false;
    if (this.newCouponDiscountType() === 'percent' && value > 100) return false;
    return true;
  }

  couponWizardTargetLabel(): string {
    const scope = this.newCouponScope();
    if (scope === 'COURSE') {
      return (
        this.publishedCourses().find((course) => course.id === this.newCouponCourseId)?.title ||
        'Selected course'
      );
    }
    if (scope === 'TEMPLATE') {
      return (
        this.adminTemplates().find((tpl) => tpl.id === this.newCouponTemplateId)?.title ||
        'Selected UI template'
      );
    }
    return 'All membership plans';
  }

  resetCouponWizard() {
    this.newCouponStep.set(1);
    this.newCouponScope.set(null);
    this.newCouponCourseId = '';
    this.newCouponTemplateId = '';
    this.newCouponDiscountType.set('percent');
    this.newCouponDiscountValue = null;
    this.newCouponCodeInput = '';
    this.newCouponError.set('');
    this.newCouponFeedback.set('');
  }

  createCouponFromWizard() {
    if (this.creatingCoupon()) return;
    const code = this.newCouponCodeInput.trim();
    const scope = this.newCouponScope();
    if (!code) { this.newCouponError.set('Enter a coupon code.'); return; }
    if (!scope) { this.newCouponError.set('Choose what this coupon is for.'); return; }
    if (scope === 'COURSE' && !this.newCouponCourseId) { this.newCouponError.set('Choose a course first.'); return; }
    if (scope === 'TEMPLATE' && !this.newCouponTemplateId) { this.newCouponError.set('Choose a UI template product first.'); return; }
    if (!this.isCouponDiscountValid()) { this.newCouponError.set('Enter a valid discount amount.'); return; }

    this.creatingCoupon.set(true);
    this.newCouponError.set('');
    const payload: any = {
      code,
      scope,
      ...(scope === 'COURSE' ? { courseId: this.newCouponCourseId } : {}),
      ...(scope === 'TEMPLATE' ? { templateProductId: this.newCouponTemplateId } : {}),
      ...(this.newCouponDiscountType() === 'percent'
        ? { discountPercent: Number(this.newCouponDiscountValue) }
        : { discountAmount: Number(this.newCouponDiscountValue) }),
    };
    this.adminService.createCoupon(payload).subscribe({
      next: (coupon) => {
        this.creatingCoupon.set(false);
        this.coupons.update((coupons) => [coupon, ...coupons]);
        this.newCouponFeedback.set(`Coupon "${coupon.code}" created and activated successfully!`);
        setTimeout(() => this.resetCouponWizard(), 2500);
      },
      error: (error) => {
        this.creatingCoupon.set(false);
        this.newCouponError.set(error?.error?.message || 'The coupon could not be created.');
      },
    });
  }

  createMembershipCoupon() {
    const code = this.newMembershipCouponCode.trim();
    if (!code) return;
    this.adminService
      .createCoupon({
        code,
        discountAmount: Number(this.newMembershipCouponDiscount) || 0,
        scope: 'MEMBERSHIP',
      })
      .subscribe({
        next: (coupon) => {
          this.coupons.update((coupons) => [coupon, ...coupons]);
          this.newMembershipCouponCode = '';
          this.membershipCouponFeedback.set(
            `Coupon "${coupon.code}" created and activated successfully!`,
          );
          setTimeout(() => this.membershipCouponFeedback.set(''), 6000);
        },
        error: (error) =>
          alert(
            error?.error?.message ||
              'The membership coupon could not be created.',
          ),
      });
  }

  couponCourseName(coupon: Coupon) {
    if (coupon.scope === 'MEMBERSHIP') return 'Membership';
    if (coupon.scope === 'TEMPLATE') {
      return (
        this.adminTemplates().find((tpl) => tpl.id === coupon.templateProductId)
          ?.title ||
        coupon.templateProductId ||
        'UI template'
      );
    }
    return (
      this.publishedCourses().find((course) => course.id === coupon.courseId)
        ?.title ||
      coupon.courseId ||
      'All courses'
    );
  }

  toggleCoupon(coupon: Coupon) {
    this.saveCoupon({ ...coupon, isActive: !coupon.isActive });
  }

  toggleMessageStatus(id: string) {
    this.contactService.toggleMessageStatus(id).subscribe();
  }

  deleteMessage(id: string) {
    if (
      typeof window !== 'undefined' &&
      !window.confirm('Delete this inquiry?')
    )
      return;
    this.contactService.deleteMessage(id).subscribe();
  }

  encodeUri(str: string): string {
    return encodeURIComponent(str);
  }

  private createdTime(course: Course): number {
    const createdAt = (course as Course & { createdAt?: string | Date })
      .createdAt;
    return createdAt ? new Date(createdAt).getTime() : 0;
  }

  deleteCoupon(id: string) {
    if (
      this.savingCouponId() ||
      !window.confirm(
        'Delete this coupon? Students who already enrolled will keep their access.',
      )
    )
      return;
    this.savingCouponId.set(id);
    this.couponError.set('');
    this.adminService.deleteCoupon(id).subscribe({
      next: () => {
        this.savingCouponId.set(null);
        this.couponFeedback.set(
          'Coupon deleted. Existing enrollments are unchanged.',
        );
        this.coupons.update((coupons) =>
          coupons.filter((coupon) => coupon.id !== id),
        );
      },
      error: (error) => {
        this.savingCouponId.set(null);
        this.couponError.set(
          error?.error?.message || 'Could not delete coupon.',
        );
      },
    });
  }

  deleteCourse(course: Course) {
    if (
      typeof window === 'undefined' ||
      !window.confirm('Are you sure you want to delete?')
    )
      return;

    this.coursesService.deleteCourse(course.id).subscribe({
      next: () => {
        this.publishedCourses.update((courses) =>
          courses.filter((candidate) => candidate.id !== course.id),
        );
        alert('Course deleted successfully.');
      },
      error: () => alert('The course could not be deleted. Please try again.'),
    });
  }
}

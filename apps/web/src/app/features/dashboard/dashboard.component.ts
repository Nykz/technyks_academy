import { Component, computed, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import {
  Certificate,
  EnrollmentsService,
  Enrollment,
} from '../../core/services/enrollments.service';
import { AuthService } from '../../core/services/auth.service';
import {
  TemplatePurchase,
  TemplatesService,
} from '../../core/services/templates.service';
import { MediaUrlPipe } from '../../core/pipes/media-url.pipe';
import { UserAvatarComponent } from '../../core/components/user-avatar/user-avatar.component';

type DashboardTab = 'all' | 'progress' | 'completed' | 'certificates' | 'templates';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, MediaUrlPipe, UserAvatarComponent],
  template: `
    <!-- "My learning" band, like Udemy -->
    <section style="background:#1c1d1f">
      <div class="mx-auto max-w-7xl px-4 pt-10 sm:px-6 md:px-10">
        <div class="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div class="flex items-center gap-4">
            <app-user-avatar [name]="authService.currentUser()?.name" [src]="authService.currentUser()?.avatarUrl" [size]="64" />
            <div>
              <p class="text-sm" style="color:#d1d7dc">Welcome back, {{ firstName() }}</p>
              <h1 class="font-['Hanken_Grotesk'] text-3xl font-bold sm:text-4xl" style="color:#ffffff">My learning</h1>
            </div>
          </div>
          <a routerLink="/account/profile" class="text-sm font-bold underline-offset-4 hover:underline" style="color:#c0c4fc">Edit profile</a>
        </div>
        <nav class="mt-8 flex gap-6 overflow-x-auto [scrollbar-width:none]" aria-label="My learning sections">
          @for (item of tabs; track item.id) {
            <button
              type="button"
              (click)="setTab(item.id)"
              class="whitespace-nowrap border-b-[3px] pb-3 text-sm font-bold transition-colors sm:text-base"
              [style.color]="tab() === item.id ? '#ffffff' : '#a1a7b3'"
              [style.border-color]="tab() === item.id ? '#ffffff' : 'transparent'"
              [attr.aria-current]="tab() === item.id ? 'page' : null"
            >
              {{ item.label }}
              @if (countFor(item.id) !== null) {
                <span class="ml-1 text-xs font-normal opacity-70">({{ countFor(item.id) }})</span>
              }
            </button>
          }
        </nav>
      </div>
    </section>

    <div class="mx-auto max-w-7xl px-4 pb-20 pt-8 sm:px-6 md:px-10">
      @if (certificateError()) {
        <p class="mb-6 rounded-lg !bg-rose-50 px-4 py-3 text-sm !text-rose-700" role="alert">{{ certificateError() }}</p>
      }

      @if (tab() === 'all' || tab() === 'progress' || tab() === 'completed') {
        @if (isLoading()) {
          <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            @for (i of [1, 2, 3, 4]; track i) {
              <div class="animate-pulse">
                <div class="aspect-video rounded bg-slate-200 dark:bg-white/10"></div>
                <div class="mt-3 h-4 w-3/4 rounded bg-slate-200 dark:bg-white/10"></div>
                <div class="mt-2 h-3 w-1/2 rounded bg-slate-200 dark:bg-white/10"></div>
              </div>
            }
          </div>
        } @else if (enrollments().length === 0) {
          <div class="mx-auto max-w-xl py-16 text-center">
            <span class="material-symbols-outlined text-6xl text-slate-300">school</span>
            <h2 class="mt-3 text-xl font-bold text-slate-950 dark:text-white">Start learning today</h2>
            <p class="mt-2 text-sm text-slate-600 dark:text-slate-400">When you enroll in a course, it will appear here.</p>
            <a routerLink="/courses" class="mt-6 inline-block rounded !bg-slate-900 px-6 py-3 text-sm font-bold !text-white hover:!bg-slate-700 dark:!bg-white dark:!text-slate-900">Browse courses</a>
          </div>
        } @else {
          <!-- Toolbar -->
          <div class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div class="flex flex-wrap gap-6 text-sm text-slate-600 dark:text-slate-400">
              <span><strong class="text-slate-950 dark:text-white">{{ enrollments().length }}</strong> enrolled</span>
              <span><strong class="text-slate-950 dark:text-white">{{ averageProgress() }}%</strong> average progress</span>
              <span><strong class="text-slate-950 dark:text-white">{{ completedCourses() }}</strong> completed</span>
            </div>
            <div class="flex flex-col gap-2 sm:flex-row">
              <label class="sr-only" for="course-sort">Sort by</label>
              <select id="course-sort" [value]="sort()" (change)="sort.set($any($event.target).value)" class="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 dark:border-white/20 dark:bg-[#0f172a] dark:text-slate-100">
                <option value="recent">Recently accessed</option>
                <option value="title">Title: A to Z</option>
                <option value="progress">Most progress</option>
              </select>
              <div class="relative">
                <label class="sr-only" for="course-search">Search my courses</label>
                <input id="course-search" type="search" [value]="search()" (input)="search.set($any($event.target).value)" placeholder="Search my courses" class="w-full rounded border border-slate-300 bg-white py-2 pl-3 pr-9 text-sm text-slate-800 dark:border-white/20 dark:bg-[#0f172a] dark:text-slate-100 sm:w-60" />
                <span class="material-symbols-outlined pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-lg text-slate-400">search</span>
              </div>
            </div>
          </div>

          @if (visibleEnrollments().length === 0) {
            <p class="py-12 text-center text-sm text-slate-600 dark:text-slate-400">
              {{ search() ? 'No courses match your search.' : tab() === 'completed' ? 'You have not completed a course yet. Keep going!' : 'Nothing here right now.' }}
            </p>
          } @else {
            <div class="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
              @for (enrollment of visibleEnrollments(); track enrollment.id) {
                <article class="group flex flex-col">
                  <a [routerLink]="['/courses', enrollment.course.slug, 'watch', getResumeLessonId(enrollment)]" class="relative block aspect-video overflow-hidden rounded border border-slate-200 bg-slate-900 dark:border-white/10" [attr.aria-label]="'Continue ' + enrollment.course.title">
                    <img [src]="(enrollment.course.thumbnail | mediaUrl) || '/assets/course-agentic-ai.png'" [alt]="''" class="h-full w-full object-cover transition-opacity group-hover:opacity-70" />
                    <span class="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                      <span class="flex h-14 w-14 items-center justify-center rounded-full shadow-lg" style="background:#ffffff;color:#1c1d1f">
                        <span class="material-symbols-outlined text-4xl">play_arrow</span>
                      </span>
                    </span>
                  </a>
                  <a [routerLink]="['/courses', enrollment.course.slug, 'watch', getResumeLessonId(enrollment)]" class="mt-3 line-clamp-2 text-base font-bold leading-snug text-slate-950 hover:underline dark:text-white">
                    {{ enrollment.course.title }}
                  </a>
                  <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">Technyks Academy · {{ getTotalLessons(enrollment) }} lessons</p>
                  <div class="mt-auto pt-3">
                    @if (getProgressPercent(enrollment) === 0) {
                      <a [routerLink]="['/courses', enrollment.course.slug, 'watch', getResumeLessonId(enrollment)]" class="text-xs font-bold uppercase tracking-wider text-blue-700 hover:underline dark:text-blue-400">Start course</a>
                    } @else {
                      <div class="h-1 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-white/10" role="progressbar" [attr.aria-valuenow]="getProgressPercent(enrollment)" aria-valuemin="0" aria-valuemax="100" [attr.aria-label]="enrollment.course.title + ' progress'">
                        <div class="h-full rounded-full !bg-[#2563EB]" [style.width.%]="getProgressPercent(enrollment)"></div>
                      </div>
                      <div class="mt-1.5 flex items-center justify-between text-xs">
                        <span class="text-slate-600 dark:text-slate-400">{{ getProgressPercent(enrollment) }}% complete</span>
                        @if (getProgressPercent(enrollment) === 100) {
                          <button type="button" (click)="openCertificate(enrollment.course.id)" [disabled]="certificateLoadingId() === enrollment.course.id" class="inline-flex items-center gap-1 font-bold text-blue-700 hover:underline disabled:opacity-60 dark:text-blue-400">
                            <span class="material-symbols-outlined text-sm">workspace_premium</span>
                            {{ certificateLoadingId() === enrollment.course.id ? 'Preparing…' : 'Certificate' }}
                          </button>
                        } @else {
                          <span class="text-slate-500 dark:text-slate-500">{{ getRemainingLessons(enrollment) }} left</span>
                        }
                      </div>
                    }
                  </div>
                </article>
              }
            </div>
          }
        }
      }

      @if (tab() === 'certificates') {
        @if (certificates().length === 0) {
          <div class="mx-auto max-w-xl py-16 text-center">
            <span class="material-symbols-outlined text-6xl text-slate-300">workspace_premium</span>
            <h2 class="mt-3 text-xl font-bold text-slate-950 dark:text-white">No certificates yet</h2>
            <p class="mt-2 text-sm text-slate-600 dark:text-slate-400">Finish every lesson of a course to earn its certificate. It is emailed to you and appears here.</p>
          </div>
        } @else {
          <div class="grid grid-cols-1 gap-5 md:grid-cols-2">
            @for (certificate of certificates(); track certificate.certificateNumber) {
              <article class="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#121A2B] sm:flex-row sm:items-center">
                <div class="flex h-16 w-16 shrink-0 items-center justify-center rounded-full !bg-amber-100 dark:!bg-amber-400/15">
                  <span class="material-symbols-outlined text-3xl !text-amber-600 dark:!text-amber-300">workspace_premium</span>
                </div>
                <div class="min-w-0 flex-1">
                  <h3 class="text-base font-bold leading-snug text-slate-950 dark:text-white">{{ certificate.courseTitle }}</h3>
                  <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Completed {{ certificate.issuedAt | date: 'd MMM y' }} · ID {{ certificate.certificateNumber }}
                  </p>
                  <div class="mt-3 flex flex-wrap gap-2">
                    <a [href]="certificate.downloadUrl" class="inline-flex items-center gap-1 rounded !bg-slate-900 px-3 py-2 text-xs font-bold !text-white hover:!bg-slate-700 dark:!bg-white dark:!text-slate-900">
                      <span class="material-symbols-outlined text-sm">download</span> Download PDF
                    </a>
                    <a [routerLink]="['/certificate', certificate.certificateNumber]" class="inline-flex items-center gap-1 rounded border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 hover:border-slate-900 dark:border-white/20 dark:text-slate-200">
                      <span class="material-symbols-outlined text-sm">verified</span> View &amp; share
                    </a>
                  </div>
                </div>
              </article>
            }
          </div>
        }
      }

      @if (tab() === 'templates') {
        @if (templatePurchases().length === 0) {
          <div class="mx-auto max-w-xl py-16 text-center">
            <span class="material-symbols-outlined text-6xl text-slate-300">web</span>
            <h2 class="mt-3 text-xl font-bold text-slate-950 dark:text-white">No UI templates yet</h2>
            <p class="mt-2 text-sm text-slate-600 dark:text-slate-400">Templates you buy stay here for download, forever.</p>
            <a routerLink="/templates" class="mt-6 inline-block rounded !bg-slate-900 px-6 py-3 text-sm font-bold !text-white dark:!bg-white dark:!text-slate-900">Browse templates</a>
          </div>
        } @else {
          <div class="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            @for (purchase of templatePurchases(); track purchase.id) {
              <article class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#121A2B]">
                <div class="aspect-[16/9] bg-slate-900">
                  @if (purchase.product.thumbnail) {
                    <img [src]="purchase.product.thumbnail | mediaUrl" [alt]="purchase.product.title" class="h-full w-full object-cover" />
                  }
                </div>
                <div class="p-5">
                  <div class="text-[11px] font-bold uppercase text-slate-500">Purchased {{ purchase.purchasedAt | date: 'mediumDate' }}</div>
                  <h3 class="mt-1 text-lg font-bold text-slate-950 dark:text-white">{{ purchase.product.title }}</h3>
                  @if (purchase.product.buyerMessage) {
                    <p class="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{{ purchase.product.buyerMessage }}</p>
                  }
                  <button (click)="downloadTemplate(purchase)" [disabled]="downloadingId() === purchase.product.id" class="mt-4 flex w-full items-center justify-center gap-2 rounded !bg-slate-900 py-3 text-sm font-bold !text-white hover:!bg-slate-700 disabled:opacity-50 dark:!bg-white dark:!text-slate-900">
                    <span class="material-symbols-outlined text-lg">{{ purchase.product.deliveryType === 'external' ? 'open_in_new' : 'download' }}</span>
                    {{ downloadingId() === purchase.product.id ? 'Preparing…' : purchase.product.downloadButtonText || 'Download files' }}
                  </button>
                </div>
              </article>
            }
          </div>
        }
        @if (downloadError()) {
          <p role="alert" class="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">{{ downloadError() }}</p>
        }
      }
    </div>
  `,
})
export class DashboardComponent implements OnInit {
  authService = inject(AuthService);
  private enrollmentsService = inject(EnrollmentsService);
  private templatesService = inject(TemplatesService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly tabs: { id: DashboardTab; label: string }[] = [
    { id: 'all', label: 'All courses' },
    { id: 'progress', label: 'In progress' },
    { id: 'completed', label: 'Completed' },
    { id: 'certificates', label: 'Certificates' },
    { id: 'templates', label: 'UI templates' },
  ];
  tab = signal<DashboardTab>('all');
  search = signal('');
  sort = signal<'recent' | 'title' | 'progress'>('recent');

  enrollments = signal<Enrollment[]>([]);
  isLoading = signal(true);
  templatePurchases = signal<TemplatePurchase[]>([]);
  downloadingId = signal<string | null>(null);
  certificates = signal<Certificate[]>([]);
  certificateLoadingId = signal<string | null>(null);
  certificateError = signal('');
  downloadError = signal('');

  readonly firstName = computed(
    () => String(this.authService.currentUser()?.name || '').trim().split(/\s+/)[0] || 'there',
  );

  readonly visibleEnrollments = computed(() => {
    const query = this.search().trim().toLowerCase();
    const tab = this.tab();
    const list = this.enrollments().filter((enrollment) => {
      const progress = this.getProgressPercent(enrollment);
      if (tab === 'progress' && progress === 100) return false;
      if (tab === 'completed' && progress !== 100) return false;
      return !query || enrollment.course.title.toLowerCase().includes(query);
    });
    const sort = this.sort();
    return [...list].sort((a, b) =>
      sort === 'title'
        ? a.course.title.localeCompare(b.course.title)
        : sort === 'progress'
          ? this.getProgressPercent(b) - this.getProgressPercent(a)
          : +new Date(b.updatedAt || 0) - +new Date(a.updatedAt || 0),
    );
  });

  countFor(tab: DashboardTab): number | null {
    if (tab === 'certificates') return this.certificates().length || null;
    if (tab === 'templates') return this.templatePurchases().length || null;
    return null;
  }

  setTab(tab: DashboardTab) {
    this.tab.set(tab);
    this.router.navigate([], { fragment: tab === 'all' ? undefined : tab, replaceUrl: true });
  }

  ngOnInit() {
    this.route.fragment.subscribe((fragment) => {
      if (this.tabs.some((item) => item.id === fragment)) this.tab.set(fragment as DashboardTab);
    });
    this.enrollmentsService.getMyEnrollments().subscribe({
      next: (data) => {
        this.enrollments.set(data);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });
    this.loadCertificates();
    this.templatesService
      .purchases()
      .subscribe({ next: (items) => this.templatePurchases.set(items) });
  }

  getResumeLessonId(enrollment: Enrollment): string {
    const lessons = (enrollment.course.modules || []).flatMap(
      (module) => module.lessons || [],
    );
    // Older course saves regenerated lesson IDs. Never route an enrolled
    // student to a stale lesson; resume it only when it still exists.
    if (
      enrollment.lastWatchedLessonId &&
      lessons.some((lesson) => lesson.id === enrollment.lastWatchedLessonId)
    ) {
      return enrollment.lastWatchedLessonId;
    }
    if (enrollment.course.modules?.[0]?.lessons?.[0]?.id) {
      return enrollment.course.modules[0].lessons[0].id;
    }
    return 'les-1';
  }

  getTotalLessons(enrollment: Enrollment): number {
    return (
      enrollment.course.modules?.reduce(
        (total, module) => total + (module.lessons?.length || 0),
        0,
      ) || 0
    );
  }

  getCompletedLessons(enrollment: Enrollment): number {
    const totalLessons = this.getTotalLessons(enrollment);
    const completedLessonIds = new Set(enrollment.completedLessonIds || []);
    return totalLessons ? Math.min(totalLessons, completedLessonIds.size) : 0;
  }

  getProgressPercent(enrollment: Enrollment): number {
    const totalLessons = this.getTotalLessons(enrollment);
    if (totalLessons) {
      return Math.round(
        (this.getCompletedLessons(enrollment) / totalLessons) * 100,
      );
    }
    return Math.max(
      0,
      Math.min(100, Math.round(Number(enrollment.progressPercent) || 0)),
    );
  }

  getRemainingLessons(enrollment: Enrollment): number {
    return Math.max(
      0,
      this.getTotalLessons(enrollment) - this.getCompletedLessons(enrollment),
    );
  }

  getLastLessonTitle(enrollment: Enrollment): string {
    if (!enrollment.lastWatchedLessonId) return 'Not started yet';
    for (const module of enrollment.course.modules || []) {
      const lesson = module.lessons?.find(
        (item) => item.id === enrollment.lastWatchedLessonId,
      );
      if (lesson) return `Last viewed: ${lesson.title}`;
    }
    return 'Continue your course';
  }

  averageProgress(): number {
    const courses = this.enrollments();
    if (!courses.length) return 0;
    return Math.round(
      courses.reduce(
        (total, enrollment) => total + this.getProgressPercent(enrollment),
        0,
      ) / courses.length,
    );
  }

  completedCourses(): number {
    return this.enrollments().filter(
      (enrollment) => this.getProgressPercent(enrollment) === 100,
    ).length;
  }

  private loadCertificates() {
    this.enrollmentsService.getMyCertificates().subscribe({
      next: (items) => this.certificates.set(items || []),
      error: () => this.certificates.set([]),
    });
  }

  /** Issues the certificate if needed, then opens the PDF in a new tab. */
  openCertificate(courseId: string) {
    // Open the tab now (inside the click) so pop-up blockers allow it.
    const tab = window.open('', '_blank');
    this.certificateLoadingId.set(courseId);
    this.certificateError.set('');
    this.enrollmentsService.getCertificate(courseId).subscribe({
      next: (certificate) => {
        this.certificateLoadingId.set(null);
        if (tab) tab.location.href = certificate.pdfUrl;
        else window.location.assign(certificate.downloadUrl);
        this.loadCertificates();
      },
      error: (error) => {
        tab?.close();
        this.certificateLoadingId.set(null);
        this.certificateError.set(
          error?.error?.message || 'Your certificate could not be prepared. Please try again.',
        );
      },
    });
  }

  downloadTemplate(purchase: TemplatePurchase) {
    this.downloadingId.set(purchase.product.id);
    this.downloadError.set('');
    this.templatesService.delivery(purchase.product.id).subscribe({
      next: (delivery) => {
        if (delivery.type === 'external' && delivery.url) {
          this.downloadingId.set(null);
          window.location.assign(delivery.url);
          return;
        }
        this.templatesService.download(purchase.product.id).subscribe({
          next: (blob) => {
            this.downloadingId.set(null);
            this.templatesService.saveBlob(
              blob,
              delivery.fileName || `${purchase.product.slug}.zip`,
            );
          },
          error: () => this.showDownloadError(),
        });
      },
      error: () => this.showDownloadError(),
    });
  }

  private showDownloadError() {
    this.downloadingId.set(null);
    this.downloadError.set(
      'The download could not be opened. Please retry or contact support.',
    );
  }
}

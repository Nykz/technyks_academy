import { DatePipe } from '@angular/common';
import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Course } from '../../core/services/courses.service';
import {
  AdminReview,
  AdminReviewsService,
} from '../../core/services/admin-reviews.service';

/** Admin > Reviews: find and remove abusive or spam course reviews. */
@Component({
  selector: 'app-admin-reviews',
  imports: [FormsModule, DatePipe],
  template: `
    <section class="flex flex-col gap-5">
      <div class="rounded-xl border border-slate-200 bg-white p-4 dark:border-[#26334B] dark:bg-[#101827] sm:p-5">
        <div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_240px_160px_auto]">
          <label class="flex flex-col gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
            Search
            <input id="review-search" type="search" [(ngModel)]="search" (keyup.enter)="load()"
              placeholder="Words in the review, student name or email"
              class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-[#26334B] dark:bg-[#0B1220] dark:text-white" />
          </label>
          <label class="flex flex-col gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
            Course
            <select id="review-course" [(ngModel)]="courseId" (ngModelChange)="load()"
              class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-[#26334B] dark:bg-[#0B1220] dark:text-white">
              <option value="">All courses</option>
              @for (course of courses(); track course.id) {
                <option [value]="course.id">{{ course.title }}</option>
              }
            </select>
          </label>
          <label class="flex flex-col gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
            Rating
            <select id="review-rating" [(ngModel)]="rating" (ngModelChange)="load()"
              class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-[#26334B] dark:bg-[#0B1220] dark:text-white">
              <option [ngValue]="null">Any</option>
              @for (stars of [5, 4, 3, 2, 1]; track stars) {
                <option [ngValue]="stars">{{ stars }} star{{ stars === 1 ? '' : 's' }}</option>
              }
            </select>
          </label>
          <button type="button" (click)="load()"
            class="self-end rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold !text-white hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400">
            Search
          </button>
        </div>
        <p class="mt-3 text-xs text-slate-500 dark:text-slate-400" role="status">
          @if (isLoading()) { Loading reviews… }
          @else { {{ reviews().length }} review{{ reviews().length === 1 ? '' : 's' }}{{ lowRatedCount() ? ' · ' + lowRatedCount() + ' rated 1–2 stars' : '' }} }
        </p>
      </div>

      @if (error()) {
        <p class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{{ error() }}</p>
      }

      @for (review of reviews(); track review.id) {
        <article class="rounded-xl border border-slate-200 bg-white p-4 dark:border-[#26334B] dark:bg-[#101827] sm:p-5">
          <header class="flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="text-sm font-semibold text-slate-900 dark:text-white">
                {{ review.user.name }}
                <span class="font-normal text-slate-500 dark:text-slate-400">· {{ review.user.email }}</span>
              </p>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                {{ review.course?.title || 'Deleted course' }} · {{ review.createdAt | date: 'mediumDate' }}
              </p>
            </div>
            <span class="rounded-full px-2.5 py-1 text-xs font-bold"
              [class]="review.rating <= 2 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'"
              [attr.aria-label]="review.rating + ' out of 5 stars'">
              {{ stars(review.rating) }}
            </span>
          </header>
          <p class="mt-3 whitespace-pre-line break-words text-sm leading-relaxed text-slate-700 dark:text-slate-200">{{ review.comment }}</p>
          <footer class="mt-4 flex flex-wrap items-center justify-end gap-2">
            @if (confirmingId() === review.id) {
              <span class="text-xs text-slate-600 dark:text-slate-300">Delete this review permanently?</span>
              <button type="button" (click)="confirmingId.set(null)"
                class="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-[#26334B] dark:text-slate-200 dark:hover:bg-white/5">
                Keep
              </button>
              <button type="button" (click)="remove(review)" [disabled]="deletingId() === review.id"
                class="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold !text-white hover:bg-red-700 disabled:opacity-60">
                {{ deletingId() === review.id ? 'Deleting…' : 'Confirm delete' }}
              </button>
            } @else {
              <button type="button" (click)="confirmingId.set(review.id)"
                [attr.aria-label]="'Delete review by ' + review.user.name"
                class="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950">
                Delete
              </button>
            }
          </footer>
        </article>
      } @empty {
        @if (!isLoading()) {
          <p class="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500 dark:border-[#26334B] dark:bg-[#101827] dark:text-slate-400">
            No reviews match these filters.
          </p>
        }
      }
    </section>
  `,
})
export class AdminReviewsComponent implements OnInit {
  private readonly reviewsService = inject(AdminReviewsService);

  readonly courses = input<Course[]>([]);

  readonly reviews = signal<AdminReview[]>([]);
  readonly isLoading = signal(true);
  readonly error = signal('');
  readonly confirmingId = signal<string | null>(null);
  readonly deletingId = signal<string | null>(null);
  readonly lowRatedCount = computed(
    () => this.reviews().filter((review) => review.rating <= 2).length,
  );

  search = '';
  courseId = '';
  rating: number | null = null;

  ngOnInit() {
    this.load();
  }

  stars(rating: number) {
    const filled = Math.max(0, Math.min(5, Math.round(rating)));
    return '★'.repeat(filled) + '☆'.repeat(5 - filled);
  }

  load() {
    this.isLoading.set(true);
    this.error.set('');
    this.reviewsService
      .list({ search: this.search, courseId: this.courseId, rating: this.rating })
      .subscribe({
        next: (reviews) => {
          this.reviews.set(reviews);
          this.isLoading.set(false);
        },
        error: (error) => {
          this.isLoading.set(false);
          this.error.set(error?.error?.message || 'Reviews could not be loaded. Try again.');
        },
      });
  }

  remove(review: AdminReview) {
    this.deletingId.set(review.id);
    this.reviewsService.remove(review.id).subscribe({
      next: () => {
        this.reviews.update((items) => items.filter((item) => item.id !== review.id));
        this.deletingId.set(null);
        this.confirmingId.set(null);
      },
      error: (error) => {
        this.deletingId.set(null);
        this.error.set(error?.error?.message || 'The review could not be deleted. Try again.');
      },
    });
  }
}

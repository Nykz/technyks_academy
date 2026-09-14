import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  Observable,
  catchError,
  of,
  map,
  BehaviorSubject,
  tap,
  defer,
  throwError,
} from 'rxjs';
import { JAVASCRIPT_COURSE } from '../data/javascript-course';
import { TYPESCRIPT_COURSE } from '../data/typescript-course';

export interface Lesson {
  id: string;
  title: string;
  description?: string;
  videoAssetRef?: string;
  duration: number;
  order: number;
  isFreePreview: boolean;
}

export interface Module {
  id: string;
  title: string;
  order: number;
  lessons: Lesson[];
}

export interface CourseReview {
  id: string;
  rating: number;
  comment: string;
  user: {
    name: string;
    avatarUrl?: string | null;
  };
  createdAt: string;
  updatedAt?: string;
}

export interface Course {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  thumbnail?: string | null;
  promoVideoUrl?: string | null;
  price: number;
  isFree: boolean;
  currency: string;
  level: string;
  category: string;
  status?: 'LIVE' | 'DRAFT' | 'BANNED';
  isPublished: boolean;
  isArchived?: boolean;
  earnedThisMonth?: number;
  enrollmentsThisMonth?: number;
  rating?: number;
  reviewCount?: number;
  reviews?: CourseReview[];
  modules: Module[];
}

const STORAGE_KEY = 'technyks_courses_store_v2';
const LEGACY_STORAGE_KEY = 'technyks_courses_store';
const METRICS_MIGRATION_KEY = 'technyks_course_metrics_v1';
const BUILT_IN_COURSES_MIGRATION_KEY = 'technyks_builtin_courses_live_v1';
const ARCHIVED_FALLBACK_COURSE_IDS_KEY =
  'technyks_archived_fallback_courses_v1';
const LEGACY_DEMO_COURSE_IDS = new Set([
  'course-n8n-1',
  'course-vibe-2',
  'course-agent-3',
  'course-mern-4',
  'course_1',
  'course_2',
  'course_3',
]);

@Injectable({
  providedIn: 'root',
})
export class CoursesService {
  private http = inject(HttpClient);
  private coursesSubject = new BehaviorSubject<Course[]>(
    this.getStoredCourses(),
  );

  courses$ = this.coursesSubject.asObservable();

  private getStoredCourses(): Course[] {
    if (typeof localStorage !== 'undefined') {
      const storedEntries = [STORAGE_KEY, LEGACY_STORAGE_KEY].map((key) => {
        const raw = localStorage.getItem(key);
        if (raw === null) return { raw: null, courses: [] as any[] };
        try {
          const stored = JSON.parse(raw);
          return { raw, courses: Array.isArray(stored) ? stored : [] };
        } catch {
          return { raw, courses: [] as any[] };
        }
      });
      const hasStoredRoster = storedEntries.some((entry) => entry.raw !== null);
      const resetLegacyMetrics =
        localStorage.getItem(METRICS_MIGRATION_KEY) !== '1';
      const migrateBuiltInCourses =
        localStorage.getItem(BUILT_IN_COURSES_MIGRATION_KEY) !== '1';
      const builtInCourses = [JAVASCRIPT_COURSE, TYPESCRIPT_COURSE];
      const stored = storedEntries
        .flatMap((entry) => entry.courses)
        .map((course) => {
          const builtIn = builtInCourses.find(
            (candidate) => candidate.id === course.id,
          );
          return this.normaliseCourse({
            ...course,
            ...(migrateBuiltInCourses && builtIn
              ? {
                  level: ['Beginner', 'Intermediate', 'Advanced'].includes(
                    course.level,
                  )
                    ? course.level
                    : builtIn.level,
                  status: 'LIVE',
                  isPublished: true,
                  modules:
                    Array.isArray(course.modules) && course.modules.length
                      ? course.modules
                      : builtIn.modules,
                }
              : {}),
            ...(resetLegacyMetrics
              ? {
                  earnedThisMonth: 0,
                  rating: 0,
                }
              : {}),
          });
        });
      if (resetLegacyMetrics) localStorage.setItem(METRICS_MIGRATION_KEY, '1');
      if (migrateBuiltInCourses) {
        localStorage.setItem(BUILT_IN_COURSES_MIGRATION_KEY, '1');
      }
      const unique = stored.filter(
        (course, index, all) =>
          all.findIndex(
            (candidate) =>
              candidate.id === course.id || candidate.slug === course.slug,
          ) === index,
      );
      const migrated = unique.filter(
        (course) => !LEGACY_DEMO_COURSE_IDS.has(course.id),
      );
      const archivedFallbackIds = this.getArchivedFallbackCourseIds();
      let roster = hasStoredRoster ? migrated : [];
      for (const builtIn of builtInCourses) {
        if (
          !archivedFallbackIds.has(builtIn.id) &&
          !roster.some((course) => course.id === builtIn.id)
        ) {
          roster = [this.normaliseCourse(builtIn), ...roster];
        }
      }
      if (hasStoredRoster) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(roster));
        localStorage.removeItem(LEGACY_STORAGE_KEY);
      }
      return roster;
    }
    return [
      this.normaliseCourse(JAVASCRIPT_COURSE),
      this.normaliseCourse(TYPESCRIPT_COURSE),
    ];
  }

  private hasStoredRoster(): boolean {
    if (typeof localStorage === 'undefined') return false;
    return [STORAGE_KEY, LEGACY_STORAGE_KEY].some(
      (key) => localStorage.getItem(key) !== null,
    );
  }

  private getAdminFallbackCourses(): Course[] {
    const stored = this.getStoredCourses();
    const archivedFallbackIds = this.getArchivedFallbackCourseIds();
    let result = [...stored];
    for (const builtIn of [JAVASCRIPT_COURSE, TYPESCRIPT_COURSE]) {
      if (
        !archivedFallbackIds.has(builtIn.id) &&
        !result.some((course) => course.id === builtIn.id)
      ) {
        result = [this.normaliseCourse(builtIn), ...result];
      }
    }
    return result;
  }

  private getArchivedFallbackCourseIds(): Set<string> {
    if (typeof localStorage === 'undefined') return new Set<string>();
    try {
      const stored = JSON.parse(
        localStorage.getItem(ARCHIVED_FALLBACK_COURSE_IDS_KEY) || '[]',
      );
      return new Set(Array.isArray(stored) ? stored : []);
    } catch {
      return new Set<string>();
    }
  }

  private archiveFallbackCourse(id: string) {
    if (typeof localStorage === 'undefined') return;
    const ids = this.getArchivedFallbackCourseIds();
    ids.add(id);
    localStorage.setItem(
      ARCHIVED_FALLBACK_COURSE_IDS_KEY,
      JSON.stringify([...ids]),
    );
  }

  private saveStoredCourses(courses: Course[]) {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(courses));
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    }
    this.coursesSubject.next(courses);
  }

  getCourses(includeDrafts = false): Observable<Course[]> {
    const fallback = () => {
      const courses = includeDrafts
        ? this.getAdminFallbackCourses()
        : this.getStoredCourses();
      return includeDrafts
        ? courses
        : courses.filter(
            (course) => course.status === 'LIVE' || course.isPublished,
          );
    };
    const request$ = includeDrafts
      ? this.http.get<any[]>('/api/admin/courses')
      : this.http.get<any[]>('/api/courses');

    return defer(() =>
      typeof window === 'undefined' ? of(fallback()) : request$,
    ).pipe(
      map((courses) => {
        const normalised = courses.map((course) =>
          this.normaliseCourse(course),
        );
        return includeDrafts ? this.mergeAdminDrafts(normalised) : normalised;
      }),
      tap((courses) => this.syncServerCourses(courses, includeDrafts)),
      catchError((error) =>
        this.isApiUnavailable(error) ? of(fallback()) : throwError(() => error),
      ),
    );
  }

  getAllCoursesAdmin(): Observable<Course[]> {
    return this.getCourses(true);
  }

  getCourseBySlug(slug: string): Observable<Course> {
    const fallback = () => {
      const found = this.getStoredCourses().find(
        (course) =>
          course.slug === slug &&
          (course.isPublished || course.status === 'LIVE'),
      );
      if (found) return of(found);
      if (slug === TYPESCRIPT_COURSE.slug || slug === TYPESCRIPT_COURSE.id) {
        return of(this.normaliseCourse(TYPESCRIPT_COURSE));
      }
      if (slug === JAVASCRIPT_COURSE.slug || slug === JAVASCRIPT_COURSE.id) {
        return of(this.normaliseCourse(JAVASCRIPT_COURSE));
      }
      return throwError(() => new Error('Course not found'));
    };

    return defer(() =>
      typeof window === 'undefined'
        ? fallback()
        : this.http.get<any>(`/api/courses/${encodeURIComponent(slug)}`),
    ).pipe(
      map((course) => this.normaliseCourse(course)),
      tap((course) => this.cacheCourses([course])),
      catchError((error) =>
        this.isCourseNotFound(error)
          ? throwError(() => error)
          : this.isApiUnavailable(error)
            ? fallback()
            : throwError(() => error),
      ),
    );
  }

  getPublicCourseById(id: string): Observable<Course> {
    return this.http.get<Course>(`/api/courses/by-id/${encodeURIComponent(id)}`).pipe(
      map(course => this.normaliseCourse(course)),
    );
  }

  getCourseById(id: string): Observable<Course> {
    const fallback = () => {
      const found = this.getStoredCourses().find((course) => course.id === id);
      return found
        ? of(found)
        : throwError(() => new Error('Course not found'));
    };

    return defer(() =>
      typeof window === 'undefined'
        ? fallback()
        : this.http.get<any>(`/api/admin/courses/${encodeURIComponent(id)}`),
    ).pipe(
      map((course) => this.normaliseCourse(course)),
      tap((course) => this.cacheCourses([course])),
      catchError((error) =>
        this.isCourseNotFound(error)
          ? throwError(() => error)
          : this.isApiUnavailable(error)
            ? fallback()
            : throwError(() => error),
      ),
    );
  }

  submitReview(
    courseId: string,
    payload: { rating: number; comment: string },
  ): Observable<CourseReview> {
    return this.http.post<CourseReview>(
      `/api/courses/${encodeURIComponent(courseId)}/reviews`,
      payload,
    );
  }

  saveCourse(course: Course): Observable<Course> {
    const prepared = this.normaliseCourse({
      ...course,
      status: course.status || (course.isPublished ? 'LIVE' : 'DRAFT'),
    });
    const fallback = () => {
      const courses = this.getStoredCourses();
      const idx = courses.findIndex(
        (candidate) => candidate.id === prepared.id,
      );
      if (idx !== -1) courses[idx] = prepared;
      else courses.unshift(prepared);
      this.saveStoredCourses(courses);
      return of(prepared);
    };

    return defer(() =>
      typeof window === 'undefined'
        ? fallback()
        : this.http.patch<any>(
            `/api/admin/courses/${encodeURIComponent(prepared.id)}`,
            prepared,
          ),
    ).pipe(
      map((saved) => this.normaliseCourse(saved)),
      tap((saved) => this.cacheCourses([saved])),
      catchError((error) =>
        this.isApiUnavailable(error) ? fallback() : throwError(() => error),
      ),
    );
  }

  createCourse(payload: Partial<Course>): Observable<Course> {
    const localCourse = this.normaliseCourse({
      ...payload,
      id: payload.id || `course-${Date.now()}`,
      status: payload.status || 'DRAFT',
      isPublished: payload.status === 'LIVE',
      createdAt:
        (payload as Course & { createdAt?: string }).createdAt ||
        new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const fallback = () => {
      const courses = this.getStoredCourses().filter(
        (course) => course.id !== localCourse.id,
      );
      courses.unshift(localCourse);
      this.saveStoredCourses(courses);
      return of(localCourse);
    };

    return defer(() =>
      typeof window === 'undefined'
        ? fallback()
        : this.http.post<any>('/api/admin/courses', payload),
    ).pipe(
      map((created) => this.normaliseCourse(created)),
      tap((created) => this.cacheCourses([created])),
      catchError((error) =>
        this.isApiUnavailable(error) ? fallback() : throwError(() => error),
      ),
    );
  }

  importJavaScriptCourse(): Observable<Course> {
    const localCourse = this.normaliseCourse(JAVASCRIPT_COURSE);
    const fallback = () => {
      const current = this.getStoredCourses();
      const existing = current.find((course) => course.id === localCourse.id);
      if (existing) return of(existing);
      this.saveStoredCourses([localCourse, ...current]);
      return of(localCourse);
    };

    return defer(() =>
      typeof window === 'undefined'
        ? fallback()
        : this.http.post<any>('/api/admin/courses/import-javascript', {}),
    ).pipe(
      map((course) => this.normaliseCourse(course)),
      tap((course) => this.cacheCourses([course])),
      catchError((error) =>
        this.isApiUnavailable(error) ? fallback() : throwError(() => error),
      ),
    );
  }

  deleteCourse(id: string): Observable<boolean> {
    const fallback = () => {
      this.archiveFallbackCourse(id);
      const courses = this.getStoredCourses().filter(
        (course) => course.id !== id,
      );
      this.saveStoredCourses(courses);
      return of(true);
    };

    return defer(() =>
      typeof window === 'undefined'
        ? fallback()
        : this.http.delete(`/api/admin/courses/${encodeURIComponent(id)}`),
    ).pipe(
      map(() => true),
      tap(() =>
        this.saveStoredCourses(
          this.getStoredCourses().filter((course) => course.id !== id),
        ),
      ),
      // A course can be present in the local admin roster while the API has
      // no matching row (for example, a draft created during an API outage).
      // Treat that already-absent server record as an idempotent delete.
      catchError((error) =>
        this.isApiUnavailable(error) ? fallback() : throwError(() => error),
      ),
    );
  }

  private isApiUnavailable(error: any): boolean {
    // A static Hostinger deployment can return index.html with HTTP 200 for
    // an /api URL when its SPA rewrite is active. Angular surfaces that as a
    // JSON parsing error, so handle it like the other unavailable-API cases
    // until the NestJS service is connected to the production host.
    return (
      error?.status === 0 ||
      error?.status === 404 ||
      (error?.status === 200 &&
        /parse|json/i.test(String(error?.message || '')))
    );
  }

  private isCourseNotFound(error: any): boolean {
    return (
      error?.status === 404 &&
      /\/api\/(?:courses|admin\/courses)\//.test(String(error?.url || ''))
    );
  }

  private syncServerCourses(courses: Course[], includeDrafts: boolean) {
    // Do not turn a public-catalog API outage into a persisted empty roster.
    // Otherwise a visitor opening /courses before /admin would prevent the
    // static admin fallback from showing the built-in draft course.
    if (!includeDrafts && !courses.length && !this.hasStoredRoster()) return;

    const current = this.getStoredCourses();
    const serverIds = new Set(courses.map((course) => course.id));
    const localDrafts = current.filter(
      (course) =>
        !serverIds.has(course.id) &&
        !course.isPublished &&
        course.status === 'DRAFT',
    );
    this.saveStoredCourses(
      includeDrafts ? courses : [...localDrafts, ...courses],
    );
  }

  private cacheCourses(courses: Course[]) {
    if (!courses.length) return;
    const current = this.getStoredCourses();
    for (const course of courses) {
      const index = current.findIndex(
        (candidate) => candidate.id === course.id,
      );
      if (index === -1) current.unshift(course);
      else current[index] = course;
    }
    this.saveStoredCourses(current);
  }

  private mergeAdminDrafts(serverCourses: Course[]): Course[] {
    const serverIds = new Set(serverCourses.map((course) => course.id));
    const localDrafts = this.getStoredCourses().filter(
      (course) => !course.isPublished && course.status === 'DRAFT',
    );
    return [
      ...localDrafts.filter((course) => !serverIds.has(course.id)),
      ...serverCourses,
    ];
  }

  private normaliseCourse(course: any): Course {
    const status = course.status || (course.isPublished ? 'LIVE' : 'DRAFT');
    const slug = course.slug || this.slugify(course.title || 'new-course');
    return {
      ...course,
      id: course.id,
      slug,
      title: course.title || 'Untitled Course',
      subtitle: course.subtitle || '',
      description: course.description || '',
      thumbnail: this.normaliseThumbnail(course.thumbnail),
      promoVideoUrl: this.normaliseMediaUrl(course.promoVideoUrl),
      price: Number(course.price || 0),
      isFree: Boolean(course.isFree ?? Number(course.price || 0) === 0),
      currency: course.currency || 'INR',
      level: course.level || 'Intermediate',
      category:
        String(course.category || 'Web Development').trim() ||
        'Web Development',
      status,
      isPublished: status === 'LIVE',
      isArchived: Boolean(course.isArchived),
      earnedThisMonth: Number(course.earnedThisMonth ?? 0),
      enrollmentsThisMonth: Number(course.enrollmentsThisMonth ?? 0),
      rating: Number(course.rating ?? 0),
      reviewCount: Number(course.reviewCount ?? course.reviews?.length ?? 0),
      reviews: Array.isArray(course.reviews)
        ? course.reviews.map((review: any) => ({
            id: review.id,
            rating: Number(review.rating || 0),
            comment: review.comment || '',
            user: {
              name: review.user?.name || 'Student',
              avatarUrl: review.user?.avatarUrl || null,
            },
            createdAt: review.createdAt,
            updatedAt: review.updatedAt,
          }))
        : [],
      modules: (course.modules || []).map(
        (module: any, moduleIndex: number) => ({
          ...module,
          id: module.id || `module-${moduleIndex + 1}`,
          title: module.title || `Section ${moduleIndex + 1}`,
          order: moduleIndex + 1,
          lessons: (module.lessons || []).map(
            (lesson: any, lessonIndex: number) => ({
              ...lesson,
              id: lesson.id || `lesson-${moduleIndex + 1}-${lessonIndex + 1}`,
              title: lesson.title || `Lecture ${lessonIndex + 1}`,
              videoAssetRef: this.cleanVideoAssetRef(lesson.videoAssetRef),
              duration: Number(lesson.duration || 0),
              order: lessonIndex + 1,
              isFreePreview: Boolean(lesson.isFreePreview),
            }),
          ),
        }),
      ),
    };
  }

  private slugify(value: string) {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  private normaliseThumbnail(thumbnail?: string): string | undefined {
    const current = String(thumbnail || '').trim();
    return current || undefined;
  }

  private cleanVideoAssetRef(value: unknown): string | undefined {
    const ref = String(value || '').trim();
    return ref && !/^demo(?:[_-]|$)/i.test(ref) ? ref : undefined;
  }

  private normaliseMediaUrl(value: unknown): string | undefined {
    const url = String(value || '').trim();
    return url || undefined;
  }
}

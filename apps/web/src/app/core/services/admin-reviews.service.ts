import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

export interface AdminReview {
  id: string;
  rating: number;
  comment: string;
  createdAt: string;
  updatedAt: string;
  user: { name: string; email: string };
  course: { id: string; title: string; slug: string } | null;
}

export interface AdminReviewFilters {
  search?: string;
  courseId?: string;
  rating?: number | null;
}

@Injectable({ providedIn: 'root' })
export class AdminReviewsService {
  private readonly http = inject(HttpClient);

  list(filters: AdminReviewFilters = {}) {
    let params = new HttpParams();
    if (filters.search?.trim()) params = params.set('search', filters.search.trim());
    if (filters.courseId) params = params.set('courseId', filters.courseId);
    if (filters.rating) params = params.set('rating', String(filters.rating));
    return this.http.get<AdminReview[]>('/api/admin/reviews', { params });
  }

  remove(id: string) {
    return this.http.delete<{ success: boolean }>(
      `/api/admin/reviews/${encodeURIComponent(id)}`,
    );
  }
}

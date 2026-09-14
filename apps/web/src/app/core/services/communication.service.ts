import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';

export interface CourseReply {
  id: string;
  body: string;
  isInstructor: boolean;
  user: { id: string; name: string; avatarUrl?: string | null };
  createdAt: string;
  updatedAt?: string;
}

export interface CourseQuestion {
  id: string;
  courseId: string;
  lessonId?: string | null;
  title: string;
  body: string;
  status: 'OPEN' | 'ANSWERED' | 'RESOLVED';
  user: { id: string; name: string; avatarUrl?: string | null };
  courseTitle: string;
  lessonTitle?: string | null;
  replies: CourseReply[];
  createdAt: string;
  updatedAt: string;
}

export interface CourseAnnouncement {
  id: string;
  title: string;
  body: string;
  targetCourseIds: string[];
  targetCourses: string[];
  sendEmail: boolean;
  emailStatus:
    | 'NOT_REQUESTED'
    | 'QUEUED'
    | 'SENT'
    | 'FAILED'
    | 'NOT_CONFIGURED'
    | 'NO_RECIPIENTS';
  recipientCount: number;
  authorName: string;
  createdAt: string;
  updatedAt?: string;
}

export interface EmailConfiguration {
  provider: string;
  configured: boolean;
  from: string | null;
  replyTo: string | null;
  sendingDomain: string | null;
  requirements: string[];
}

@Injectable({ providedIn: 'root' })
export class CommunicationService {
  private http = inject(HttpClient);

  getCourseQuestions(
    courseId: string,
    options: { scope?: 'ALL' | 'CURRENT'; lessonId?: string } = {},
  ) {
    let params = new HttpParams().set('scope', options.scope || 'ALL');
    if (options.lessonId) params = params.set('lessonId', options.lessonId);
    return this.http.get<CourseQuestion[]>(
      `/api/communication/courses/${encodeURIComponent(courseId)}/questions`,
      { params },
    );
  }

  createQuestion(
    courseId: string,
    payload: { lessonId?: string; title: string; body: string },
  ) {
    return this.http.post<CourseQuestion>(
      `/api/communication/courses/${encodeURIComponent(courseId)}/questions`,
      payload,
    );
  }

  replyToQuestion(questionId: string, body: string) {
    return this.http.post<CourseQuestion>(
      `/api/communication/questions/${encodeURIComponent(questionId)}/replies`,
      { body },
    );
  }

  getCourseAnnouncements(courseId: string) {
    return this.http.get<CourseAnnouncement[]>(
      `/api/communication/courses/${encodeURIComponent(courseId)}/announcements`,
    );
  }

  getAdminQuestions(filters: {
    courseId?: string;
    status?: string;
    search?: string;
  }) {
    let params = new HttpParams();
    if (filters.courseId) params = params.set('courseId', filters.courseId);
    if (filters.status) params = params.set('status', filters.status);
    if (filters.search) params = params.set('search', filters.search);
    return this.http.get<CourseQuestion[]>(
      '/api/admin/communication/questions',
      {
        params,
      },
    );
  }

  replyAsInstructor(questionId: string, body: string) {
    return this.http.post<CourseQuestion>(
      `/api/admin/communication/questions/${encodeURIComponent(questionId)}/replies`,
      { body },
    );
  }

  updateQuestionStatus(
    questionId: string,
    status: 'OPEN' | 'ANSWERED' | 'RESOLVED',
  ) {
    return this.http.patch<CourseQuestion>(
      `/api/admin/communication/questions/${encodeURIComponent(questionId)}/status`,
      { status },
    );
  }

  getAdminAnnouncements() {
    return this.http.get<CourseAnnouncement[]>(
      '/api/admin/communication/announcements',
    );
  }

  getEmailConfiguration() {
    return this.http.get<EmailConfiguration>(
      '/api/admin/communication/email-configuration',
    );
  }

  createAnnouncement(payload: {
    title: string;
    body: string;
    targetCourseIds: string[];
    sendEmail: boolean;
  }) {
    return this.http.post<CourseAnnouncement>(
      '/api/admin/communication/announcements',
      payload,
    );
  }

  deleteAnnouncement(id: string) {
    return this.http.delete<{ success: boolean }>(
      `/api/admin/communication/announcements/${encodeURIComponent(id)}`,
    );
  }
}

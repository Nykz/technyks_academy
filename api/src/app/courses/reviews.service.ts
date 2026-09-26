import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const REVIEW_INCLUDE = {
  user: {
    select: {
      name: true,
      avatarUrl: true,
    },
  },
};

@Injectable()
export class ReviewsService {
  constructor(private prisma: PrismaService) {}

  async listForCourse(courseId: string) {
    if (this.prisma.isDbConnected) {
      try {
        const reviews = await this.prisma.review.findMany({
          where: { courseId },
          include: REVIEW_INCLUDE,
          orderBy: { createdAt: 'desc' },
        });
        return reviews.map((review) => this.toPublicReview(review));
      } catch {
        // Use the local adapter when the database is unavailable.
      }
    }

    return this.prisma.inMemoryReviews
      .filter((review) => review.courseId === courseId)
      .sort(
        (a, b) =>
          new Date(b.createdAt || 0).getTime() -
          new Date(a.createdAt || 0).getTime(),
      )
      .map((review) => this.toPublicReview(review));
  }

  async upsertReview(
    userId: string,
    courseId: string,
    dto: { rating?: number; comment?: string },
  ) {
    const rating = Math.round(Number(dto.rating));
    const comment = String(dto.comment || '').trim();
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new BadRequestException('Rating must be a whole number from 1 to 5.');
    }
    if (comment.length < 10) {
      throw new BadRequestException('Review must be at least 10 characters long.');
    }
    if (comment.length > 2_000) {
      throw new BadRequestException('Review must be 2,000 characters or fewer.');
    }

    const course = await this.findCourse(courseId);
    if (!course) throw new NotFoundException('Course not found.');

    const enrolled = await this.isEnrolled(userId, course.id);
    if (!enrolled) {
      throw new ForbiddenException('Enroll in this course before leaving a review.');
    }

    if (this.prisma.isDbConnected) {
      try {
        const review = await this.prisma.review.upsert({
          where: { userId_courseId: { userId, courseId: course.id } },
          create: { userId, courseId: course.id, rating, comment },
          update: { rating, comment },
          include: REVIEW_INCLUDE,
        });
        return this.toPublicReview(review);
      } catch {
        // Use the local adapter when the database write is unavailable.
      }
    }

    const user = this.prisma.inMemoryUsers.find((candidate) => candidate.id === userId);
    const existing = this.prisma.inMemoryReviews.find(
      (review) => review.userId === userId && review.courseId === course.id,
    );
    if (existing) {
      Object.assign(existing, { rating, comment, updatedAt: new Date() });
      return this.toPublicReview({
        ...existing,
        user: existing.user || { name: user?.name || 'Student', avatarUrl: user?.avatarUrl },
      });
    }

    const review = {
      id: `review_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      userId,
      courseId: course.id,
      rating,
      comment,
      user: { name: user?.name || 'Student', avatarUrl: user?.avatarUrl || null },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.prisma.inMemoryReviews.unshift(review);
    return this.toPublicReview(review);
  }

  /** Every review with its student and course, newest first (admin only). */
  async listForAdmin(filters: { search?: string; courseId?: string; rating?: number } = {}) {
    const search = String(filters.search || '').trim().toLowerCase();
    const rating = Number(filters.rating) || 0;
    let rows: any[];
    if (this.prisma.isDbConnected) {
      rows = await this.prisma.review.findMany({
        where: {
          ...(filters.courseId ? { courseId: filters.courseId } : {}),
          ...(rating ? { rating } : {}),
        },
        include: {
          user: { select: { name: true, email: true, avatarUrl: true } },
          course: { select: { id: true, title: true, slug: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
    } else {
      rows = this.prisma.inMemoryReviews
        .filter((review) => !filters.courseId || review.courseId === filters.courseId)
        .filter((review) => !rating || Number(review.rating) === rating)
        .map((review) => {
          const user = this.prisma.inMemoryUsers.find((candidate) => candidate.id === review.userId);
          const course = this.prisma.inMemoryCourses.find((candidate) => candidate.id === review.courseId);
          return {
            ...review,
            user: { name: user?.name || review.user?.name || 'Student', email: user?.email || '', avatarUrl: user?.avatarUrl || null },
            course: course ? { id: course.id, title: course.title, slug: course.slug } : null,
          };
        })
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    }
    return rows
      .map((review) => ({
        id: review.id,
        rating: Number(review.rating || 0),
        comment: review.comment || '',
        createdAt: review.createdAt,
        updatedAt: review.updatedAt,
        user: { name: review.user?.name || 'Student', email: review.user?.email || '' },
        course: review.course
          ? { id: review.course.id, title: review.course.title, slug: review.course.slug }
          : null,
      }))
      .filter(
        (review) =>
          !search ||
          `${review.comment} ${review.user.name} ${review.user.email} ${review.course?.title || ''}`
            .toLowerCase()
            .includes(search),
      );
  }

  /** Removes a review, e.g. abusive or spam content (admin only). */
  async deleteReview(id: string) {
    if (this.prisma.isDbConnected) {
      const deleted = await this.prisma.review.deleteMany({ where: { id } });
      if (!deleted.count) throw new NotFoundException('Review not found.');
      return { success: true };
    }
    const before = this.prisma.inMemoryReviews.length;
    this.prisma.inMemoryReviews = this.prisma.inMemoryReviews.filter((review) => review.id !== id);
    if (this.prisma.inMemoryReviews.length === before) throw new NotFoundException('Review not found.');
    return { success: true };
  }

  private async findCourse(id: string) {
    if (this.prisma.isDbConnected) {
      try {
        const course = await this.prisma.course.findUnique({
          where: { id },
          select: { id: true },
        });
        if (course) return course;
      } catch {
        // Use the local adapter below.
      }
    }
    return this.prisma.inMemoryCourses.find((course) => course.id === id);
  }

  private async isEnrolled(userId: string, courseId: string) {
    if (this.prisma.isDbConnected) {
      try {
        const enrollment = await this.prisma.enrollment.findUnique({
          where: { userId_courseId: { userId, courseId } },
          select: { id: true },
        });
        if (enrollment) return true;
      } catch {
        // Use the local adapter below.
      }
    }
    return this.prisma.inMemoryEnrollments.some(
      (enrollment) =>
        enrollment.userId === userId && enrollment.courseId === courseId,
    );
  }

  private toPublicReview(review: any) {
    return {
      id: review.id,
      rating: Number(review.rating || 0),
      comment: review.comment || '',
      user: {
        name: review.user?.name || 'Student',
        avatarUrl: review.user?.avatarUrl || null,
      },
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
    };
  }
}

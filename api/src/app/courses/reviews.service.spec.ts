import { ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';
import { ReviewsService } from './reviews.service';

describe('ReviewsService', () => {
  let service: ReviewsService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      isDbConnected: false,
      inMemoryCourses: [{ id: 'course_1', slug: 'typescript-course' }],
      inMemoryEnrollments: [
        { id: 'enrollment_1', userId: 'student_1', courseId: 'course_1' },
      ],
      inMemoryUsers: [
        { id: 'student_1', name: 'Asha', avatarUrl: null },
        { id: 'student_2', name: 'Rahul', avatarUrl: null },
      ],
      inMemoryReviews: [],
    };
    service = new ReviewsService(prisma);
  });

  it('creates and updates one durable review per enrolled student', async () => {
    const created = await service.upsertReview('student_1', 'course_1', {
      rating: 5,
      comment: 'A clear and genuinely useful TypeScript course.',
    });
    const updated = await service.upsertReview('student_1', 'course_1', {
      rating: 4,
      comment: 'Still excellent after completing every module.',
    });

    expect(created.user.name).toBe('Asha');
    expect(updated.id).toBe(created.id);
    expect(updated.rating).toBe(4);
    expect(prisma.inMemoryReviews).toHaveLength(1);
    await expect(service.listForCourse('course_1')).resolves.toMatchObject([
      { id: created.id, rating: 4, user: { name: 'Asha' } },
    ]);
  });

  it('rejects reviews from users without a course enrollment', async () => {
    await expect(
      service.upsertReview('student_2', 'course_1', {
        rating: 5,
        comment: 'This review must not be published without enrollment.',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('ReviewsService - admin moderation', () => {
  const makeService = () => {
    const prisma: any = {
      isDbConnected: false,
      inMemoryUsers: [
        { id: 'u1', name: 'Asha', email: 'asha@example.com' },
        { id: 'u2', name: 'Ravi', email: 'ravi@example.com' },
      ],
      inMemoryCourses: [{ id: 'c1', title: 'Vibe Coding', slug: 'vibe-coding' }],
      inMemoryReviews: [
        { id: 'r1', userId: 'u1', courseId: 'c1', rating: 5, comment: 'Excellent course, very clear.', createdAt: new Date('2026-09-01') },
        { id: 'r2', userId: 'u2', courseId: 'c1', rating: 1, comment: 'Spam spam buy followers now', createdAt: new Date('2026-09-02') },
      ],
    };
    return { service: new ReviewsService(prisma), prisma };
  };

  it('lists reviews newest first with student and course details', async () => {
    const { service } = makeService();
    const reviews = await service.listForAdmin();
    expect(reviews.map((review) => review.id)).toEqual(['r2', 'r1']);
    expect(reviews[0]).toMatchObject({
      user: { name: 'Ravi', email: 'ravi@example.com' },
      course: { id: 'c1', title: 'Vibe Coding' },
    });
  });

  it('filters by words, student email and star rating', async () => {
    const { service } = makeService();
    expect((await service.listForAdmin({ search: 'spam' })).map((r) => r.id)).toEqual(['r2']);
    expect((await service.listForAdmin({ search: 'asha@example' })).map((r) => r.id)).toEqual(['r1']);
    expect((await service.listForAdmin({ rating: 1 })).map((r) => r.id)).toEqual(['r2']);
  });

  it('deletes a review and reports a missing one', async () => {
    const { service, prisma } = makeService();
    await service.deleteReview('r2');
    expect(prisma.inMemoryReviews.map((r: any) => r.id)).toEqual(['r1']);
    await expect(service.deleteReview('r2')).rejects.toThrow('Review not found.');
  });
});

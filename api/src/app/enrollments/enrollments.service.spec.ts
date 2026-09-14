import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EnrollmentsService } from './enrollments.service';

describe('EnrollmentsService - Progress Tracking', () => {
  let service: EnrollmentsService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      isDbConnected: true,
      inMemoryCourses: [],
      inMemoryEnrollments: [],
      inMemoryCertificates: [],
      enrollment: {
        findUnique: vi.fn(),
        update: vi.fn(),
        findMany: vi.fn(),
        upsert: vi.fn(),
      },
      course: {
        findUnique: vi.fn(),
      },
      certificate: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
    };
    service = new EnrollmentsService(mockPrisma);
  });

  it('should persist a free-course enrollment idempotently for the user', async () => {
    mockPrisma.enrollment.findUnique.mockResolvedValue(null);
    mockPrisma.course.findUnique.mockResolvedValue({
      id: 'course_free',
      isFree: true,
      price: 0,
    });
    mockPrisma.enrollment.upsert.mockResolvedValue({
      id: 'enr_free',
      userId: 'user_1',
      courseId: 'course_free',
      progressPercent: 0,
      completedLessonIds: [],
    });

    const result = await service.enrollInFreeCourse('user_1', 'course_free');

    expect(mockPrisma.enrollment.upsert).toHaveBeenCalledWith({
      where: {
        userId_courseId: { userId: 'user_1', courseId: 'course_free' },
      },
      create: {
        userId: 'user_1',
        courseId: 'course_free',
        progressPercent: 0,
        completedLessonIds: [],
      },
      update: {},
    });
    expect(result.courseId).toBe('course_free');
  });

  it('returns an existing enrollment even after the course becomes paid', async () => {
    const owned = {
      id: 'enr_owned',
      userId: 'user_1',
      courseId: 'course_paid',
    };
    mockPrisma.enrollment.findUnique.mockResolvedValue(owned);

    await expect(
      service.enrollInFreeCourse('user_1', 'course_paid'),
    ).resolves.toBe(owned);
    expect(mockPrisma.course.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.enrollment.upsert).not.toHaveBeenCalled();
  });

  it('checks permanent ownership without consulting the current course price', async () => {
    const owned = {
      id: 'enr_owned',
      userId: 'user_1',
      courseId: 'course_now_paid',
    };
    mockPrisma.enrollment.findUnique.mockResolvedValue(owned);

    await expect(
      service.getCourseAccess('user_1', 'course_now_paid'),
    ).resolves.toEqual({ enrolled: true, enrollment: owned });
    expect(mockPrisma.course.findUnique).not.toHaveBeenCalled();
  });

  it('should calculate 50% progress accurately when 1 of 2 lessons completed', async () => {
    mockPrisma.enrollment.findUnique.mockResolvedValue({
      id: 'enr_1',
      userId: 'user_1',
      courseId: 'course_1',
      completedLessonIds: [],
    });

    mockPrisma.course.findUnique.mockResolvedValue({
      id: 'course_1',
      modules: [{ lessons: [{ id: 'les_1' }, { id: 'les_2' }] }],
    });

    const result = await service.updateProgress('user_1', {
      courseId: 'course_1',
      lessonId: 'les_1',
      isCompleted: true,
    });

    expect(result.progressPercent).toBe(50);
    expect(result.completedLessonIds).toEqual(['les_1']);
  });

  it('should trigger certificate generation upon 100% course completion', async () => {
    mockPrisma.enrollment.findUnique.mockResolvedValue({
      id: 'enr_1',
      userId: 'user_1',
      courseId: 'course_1',
      completedLessonIds: ['les_1'],
    });

    mockPrisma.course.findUnique.mockResolvedValue({
      id: 'course_1',
      modules: [{ lessons: [{ id: 'les_1' }, { id: 'les_2' }] }],
    });

    const result = await service.updateProgress('user_1', {
      courseId: 'course_1',
      lessonId: 'les_2',
      isCompleted: true,
    });

    expect(result.progressPercent).toBe(100);
  });
});

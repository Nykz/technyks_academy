import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminService } from './admin.service';

describe('AdminService - course deletion', () => {
  let service: AdminService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      isDbConnected: true,
      course: { update: vi.fn().mockResolvedValue({ id: 'course_1', isArchived: true }) },
      $transaction: vi.fn(
        async (callback: (transaction: any) => Promise<unknown>) =>
          callback(prisma),
      ),
      inMemoryCourses: [],
      inMemoryEnrollments: [],
      inMemoryCertificates: [],
      inMemoryPayments: [],
      inMemoryContactMessages: [],
    };
    service = new AdminService(prisma);
  });

  it('archives a database course without destroying enrollment history', async () => {
    await expect(service.deleteCourse('course_1')).resolves.toEqual({
      success: true,
      deleted: true,
    });

    expect(prisma.course.update).toHaveBeenCalledWith({
      where: { id: 'course_1' },
      data: { isArchived: true, isPublished: false },
    });
  });

  it('archives the course while retaining local enrollment and payment records', async () => {
    prisma.isDbConnected = false;
    prisma.inMemoryCourses = [{ id: 'course_1' }, { id: 'course_2' }];
    prisma.inMemoryEnrollments = [
      { courseId: 'course_1' },
      { courseId: 'course_2' },
    ];
    prisma.inMemoryCertificates = [{ courseId: 'course_1' }];
    prisma.inMemoryPayments = [{ courseId: 'course_1', status: 'SUCCESS' }];

    await expect(service.deleteCourse('course_1')).resolves.toEqual({
      success: true,
      deleted: true,
    });

    expect(prisma.inMemoryCourses[0]).toMatchObject({ id: 'course_1', isArchived: true, isPublished: false });
    expect(prisma.inMemoryEnrollments).toHaveLength(2);
    expect(prisma.inMemoryCertificates).toEqual([{ courseId: 'course_1' }]);
    expect(prisma.inMemoryPayments).toEqual([{ courseId: 'course_1', status: 'SUCCESS' }]);
  });

  it('treats a missing local course as an already-completed delete', async () => {
    prisma.isDbConnected = false;

    await expect(service.deleteCourse('missing_course')).resolves.toEqual({
      success: true,
      deleted: false,
    });
  });

  it('imports the complete JavaScript curriculum idempotently in the local adapter', async () => {
    prisma.isDbConnected = false;

    const first = await service.importJavascriptCourse();
    const second = await service.importJavascriptCourse();

    expect(first.id).toBe('course-javascript-2026');
    expect(first.modules).toHaveLength(12);
    expect(first.modules.flatMap((module: any) => module.lessons)).toHaveLength(
      81,
    );
    expect(second.id).toBe(first.id);
    expect(prisma.inMemoryCourses).toHaveLength(1);
  });

  it('preserves module and lesson IDs when saving curriculum changes', () => {
    const modules = (service as any).toPrismaModules([
      {
        id: 'module_stable',
        title: 'Foundations',
        order: 1,
        lessons: [
          {
            id: 'lesson_stable',
            title: 'Introduction',
            description: null,
            videoAssetRef: 'youtube:abcdefghijk',
            duration: 120,
            order: 1,
            isFreePreview: false,
          },
        ],
      },
    ]);

    expect(modules[0]).toMatchObject({ id: 'module_stable' });
    expect(modules[0].lessons.create[0]).toMatchObject({ id: 'lesson_stable' });
  });

  it('creates, updates, and deletes a coupon through database operations', async () => {
    const coupon = { id: 'coupon_1', code: 'SAVE500', discountAmount: 500, scope: 'COURSE', courseId: 'course_1' };
    prisma.coupon = {
      create: vi.fn().mockResolvedValue(coupon),
      findUnique: vi.fn().mockResolvedValue(coupon),
      update: vi.fn().mockResolvedValue({ ...coupon, discountAmount: 600 }),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      delete: vi.fn().mockResolvedValue(coupon),
    };

    await expect(service.createCoupon({ code: 'save500', discountAmount: 500, scope: 'COURSE', courseId: 'course_1' })).resolves.toEqual(coupon);
    await expect(service.updateCoupon('coupon_1', { ...coupon, discountAmount: 600 })).resolves.toMatchObject({ discountAmount: 600 });
    await expect(service.deleteCoupon('coupon_1')).resolves.toEqual({ success: true });
    expect(prisma.coupon.create).toHaveBeenCalledOnce();
    expect(prisma.coupon.update).toHaveBeenCalledOnce();
    expect(prisma.coupon.delete).toHaveBeenCalledOnce();
  });

  it('uses one stable coupon record for repeated course coupon saves', async () => {
    const createdAt = new Date('2025-09-01T10:00:00Z');
    prisma.course.findUnique = vi.fn().mockResolvedValue({ id: 'course_1' });
    prisma.coupon = {
      findFirst: vi.fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'course_coupon_course_1', code: 'OLD', courseId: 'course_1', scope: 'COURSE', isActive: true, timesUsed: 4, createdAt }),
      upsert: vi.fn()
        .mockResolvedValueOnce({ id: 'course_coupon_course_1', code: 'FIRST' })
        .mockResolvedValueOnce({ id: 'course_coupon_course_1', code: 'UPDATED', timesUsed: 4, createdAt }),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    };

    await service.saveCourseCoupon('course_1', { code: 'FIRST', discountAmount: 100, isActive: true });
    const updated = await service.saveCourseCoupon('course_1', { code: 'UPDATED', discountAmount: 200, isActive: false });

    expect(prisma.coupon.upsert).toHaveBeenNthCalledWith(1, expect.objectContaining({ where: { id: 'course_coupon_course_1' } }));
    expect(prisma.coupon.upsert).toHaveBeenNthCalledWith(2, expect.objectContaining({ where: { id: 'course_coupon_course_1' } }));
    expect(updated).toMatchObject({ id: 'course_coupon_course_1', timesUsed: 4, createdAt });
  });

  it('creates and deletes an unused membership plan in the database', async () => {
    const plan = { id: 'plan_1', name: 'Team Monthly', slug: 'team-monthly', price: 2499, accessAllCourses: true, courseAccess: [] };
    prisma.membershipPlan = {
      create: vi.fn().mockResolvedValue(plan),
      delete: vi.fn().mockResolvedValue(plan),
    };
    prisma.subscription = { count: vi.fn().mockResolvedValue(0) };

    await expect(service.createMembershipPlan({ name: 'Team Monthly', slug: 'team-monthly', price: 2499, interval: 'MONTHLY', features: ['All courses'] })).resolves.toEqual(plan);
    await expect(service.deleteMembershipPlan('plan_1')).resolves.toEqual({ success: true });
  });

  it('lists, resolves, and deletes support messages in the local adapter', async () => {
    prisma.isDbConnected = false;
    prisma.inMemoryContactMessages = [
      {
        id: 'contact_1',
        name: 'Asha',
        email: 'asha@example.com',
        subject: 'Course access',
        message: 'Please help me access the next lesson.',
        status: 'NEW',
        createdAt: new Date('2026-09-01T10:00:00Z'),
      },
    ];

    await expect(service.getContactMessages()).resolves.toHaveLength(1);
    await expect(
      service.updateContactMessageStatus('contact_1', 'RESOLVED'),
    ).resolves.toMatchObject({ status: 'RESOLVED' });
    await expect(service.deleteContactMessage('contact_1')).resolves.toEqual({
      success: true,
    });
    expect(prisma.inMemoryContactMessages).toHaveLength(0);
  });
});

import { ServiceUnavailableException } from '@nestjs/common';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JAVASCRIPT_COURSE } from '../courses/javascript-course.data';

const COURSE_INCLUDE = {
  modules: {
    include: { lessons: { orderBy: { order: 'asc' as const } } },
    orderBy: { order: 'asc' as const },
  },
  reviews: {
    include: { user: { select: { name: true, avatarUrl: true } } },
    orderBy: { createdAt: 'desc' as const },
  },
};

const DEFAULT_COUPONS = [
  {
    id: 'c1',
    code: 'TECHNYKS50',
    discountPercent: 50,
    usageLimit: 100,
    timesUsed: 0,
    isActive: true,
    scope: 'COURSE',
    courseId: null,
  },
  {
    id: 'c2',
    code: 'ARCH20',
    discountPercent: 20,
    usageLimit: 500,
    timesUsed: 0,
    isActive: true,
    scope: 'COURSE',
    courseId: null,
  },
];

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(private prisma: PrismaService) {}

  async getRevenueMetrics() {
    let payments: any[] = [];
    let activeSubscriptions = 0;
    let canceledSubscriptions = 0;
    let totalStudents = 0;

    if (this.prisma.isDbConnected) {
      try {
        payments = await this.prisma.payment.findMany({
          where: { status: 'SUCCESS' },
          include: { course: true },
        });
        activeSubscriptions = await this.prisma.subscription.count({
          where: { status: 'ACTIVE' },
        });
        canceledSubscriptions = await this.prisma.subscription.count({
          where: { status: 'CANCELED' },
        });
        totalStudents = await this.prisma.user.count({
          where: { role: 'STUDENT' },
        });
      } catch {
        payments = this.prisma.inMemoryPayments.filter(
          (payment) => payment.status === 'SUCCESS',
        );
        activeSubscriptions = this.prisma.inMemorySubscriptions.filter(
          (subscription) => subscription.status === 'ACTIVE',
        ).length;
        canceledSubscriptions = this.prisma.inMemorySubscriptions.filter(
          (subscription) => subscription.status === 'CANCELED',
        ).length;
        totalStudents = this.prisma.inMemoryUsers.filter(
          (user) => user.role === 'STUDENT',
        ).length;
      }
    } else {
      payments = this.prisma.inMemoryPayments.filter(
        (payment) => payment.status === 'SUCCESS',
      );
      activeSubscriptions = this.prisma.inMemorySubscriptions.filter(
        (subscription) => subscription.status === 'ACTIVE',
      ).length;
      canceledSubscriptions = this.prisma.inMemorySubscriptions.filter(
        (subscription) => subscription.status === 'CANCELED',
      ).length;
      totalStudents = this.prisma.inMemoryUsers.filter(
        (user) => user.role === 'STUDENT',
      ).length;
    }

    const totalRevenue = payments.reduce(
      (sum, payment) => sum + Number(payment.amount || 0),
      0,
    );
    const courseSalesMap: Record<
      string,
      { title: string; count: number; totalAmount: number }
    > = {};
    for (const payment of payments) {
      const title = payment.course?.title || 'Membership Subscription';
      courseSalesMap[title] ??= { title, count: 0, totalAmount: 0 };
      courseSalesMap[title].count += 1;
      courseSalesMap[title].totalAmount += Number(payment.amount || 0);
    }

    const subscriptionCount = activeSubscriptions + canceledSubscriptions;
    const churnRate =
      subscriptionCount === 0
        ? '0%'
        : `${Math.round((canceledSubscriptions / subscriptionCount) * 100)}%`;

    return {
      totalRevenue: Math.round(totalRevenue),
      activeSubscriptions,
      churnRate,
      totalStudents,
      salesByCourse: Object.values(courseSalesMap),
    };
  }

  async searchStudents(query?: string) {
    const q = (query || '').toLowerCase().trim();
    let users: any[] = this.prisma.inMemoryUsers;
    let usingDatabaseUsers = false;

    if (this.prisma.isDbConnected) {
      try {
        users = (await this.prisma.user.findMany({
          where: q
            ? {
                OR: [
                  { name: { contains: q, mode: 'insensitive' } },
                  { email: { contains: q, mode: 'insensitive' } },
                ],
              }
            : undefined,
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            createdAt: true,
            _count: { select: { enrollments: true, subscriptions: true } },
          },
          orderBy: { createdAt: 'desc' },
        })) as any[];
        usingDatabaseUsers = true;
      } catch {
        // Keep using the in-memory adapter.
      }
    }

    const filteredUsers = usingDatabaseUsers
      ? users
      : users.filter(
          (user) =>
            !q ||
            user.name.toLowerCase().includes(q) ||
            user.email.toLowerCase().includes(q),
        );

    return filteredUsers.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt || new Date(),
      _count: user._count || {
        enrollments: this.prisma.inMemoryEnrollments.filter(
          (enrollment) => enrollment.userId === user.id,
        ).length,
        subscriptions: this.prisma.inMemorySubscriptions.filter(
          (subscription) => subscription.userId === user.id,
        ).length,
      },
    }));
  }

  async getAllCourses() {
    let courses: any[];
    if (this.prisma.isDbConnected) {
      try {
        courses = await this.prisma.course.findMany({
          where: { isArchived: false },
          include: COURSE_INCLUDE,
          orderBy: { createdAt: 'desc' },
        });
        return this.withCourseMetrics(courses);
      } catch {
        throw new ServiceUnavailableException('Your data could not be loaded or saved. Please retry shortly.');
      }
    }

    courses = this.prisma.inMemoryCourses
      .filter((course) => !course.isArchived)
      .sort((a, b) => {
        return (
          new Date(b.createdAt || 0).getTime() -
          new Date(a.createdAt || 0).getTime()
        );
      });
    return this.withCourseMetrics(courses);
  }

  async getCourseById(id: string) {
    if (this.prisma.isDbConnected) {
      try {
        const course = await this.prisma.course.findFirst({
          where: { id, isArchived: false },
          include: COURSE_INCLUDE,
        });
        if (course) return (await this.withCourseMetrics([course]))[0];
        throw new NotFoundException('Course not found.');
      } catch (error) {
        if (error instanceof NotFoundException) throw error;
        // Use the local adapter if the database becomes unavailable.
      }
    }

    const course = this.prisma.inMemoryCourses.find(
      (candidate) => candidate.id === id && !candidate.isArchived,
    );
    if (!course) throw new NotFoundException('Course not found.');
    return (await this.withCourseMetrics([course]))[0];
  }

  async getCourseStudents(courseId: string, query?: string) {
    const q = String(query || '')
      .trim()
      .toLowerCase();
    if (this.prisma.isDbConnected) {
      try {
        const course = await this.prisma.course.findUnique({
          where: { id: courseId },
          select: { id: true },
        });
        if (!course) throw new NotFoundException('Course not found.');

        const enrollments = await this.prisma.enrollment.findMany({
          where: {
            courseId,
            ...(q
              ? {
                  user: {
                    OR: [{ name: { contains: q } }, { email: { contains: q } }],
                  },
                }
              : {}),
          },
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        });
        return enrollments.map((enrollment) => ({
          id: enrollment.id,
          userId: enrollment.user.id,
          name: enrollment.user.name,
          email: enrollment.user.email,
          avatarUrl: enrollment.user.avatarUrl,
          enrolledAt: enrollment.createdAt,
          lastVisited: enrollment.updatedAt,
          progressPercent: Number(enrollment.progressPercent || 0),
          completedLessons: Array.isArray(enrollment.completedLessonIds)
            ? enrollment.completedLessonIds.length
            : 0,
        }));
      } catch (error) {
        if (error instanceof NotFoundException) throw error;
        // Use the local adapter below.
      }
    }

    const users = new Map(
      this.prisma.inMemoryUsers.map((user) => [user.id, user]),
    );
    return this.prisma.inMemoryEnrollments
      .filter((enrollment) => enrollment.courseId === courseId)
      .map((enrollment) => ({ enrollment, user: users.get(enrollment.userId) }))
      .filter(
        ({ user }) =>
          user &&
          (!q ||
            String(user.name || '')
              .toLowerCase()
              .includes(q) ||
            String(user.email || '')
              .toLowerCase()
              .includes(q)),
      )
      .map(({ enrollment, user }: any) => ({
        id: enrollment.id,
        userId: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl || null,
        enrolledAt: enrollment.createdAt,
        lastVisited: enrollment.updatedAt,
        progressPercent: Number(enrollment.progressPercent || 0),
        completedLessons: (enrollment.completedLessonIds || []).length,
      }));
  }

  async getMembershipPlans() {
    if (this.prisma.isDbConnected) {
      try {
        return await this.prisma.membershipPlan.findMany({
          include: { courseAccess: { select: { courseId: true } } },
          orderBy: { price: 'asc' },
        });
      } catch {
        throw new ServiceUnavailableException('Your data could not be loaded or saved. Please retry shortly.');
      }
    }
    return [...(this.prisma.inMemoryMembershipPlans || [])].sort(
      (a, b) => Number(a.price || 0) - Number(b.price || 0),
    );
  }

  async createMembershipPlan(dto: any) {
    const fields = this.normaliseMembershipPlan(dto);
    if (this.prisma.isDbConnected) {
      try {
        return await this.prisma.membershipPlan.create({
          data: {
            ...fields.data,
            courseAccess:
              !fields.data.accessAllCourses && fields.courseIds.length
                ? { create: fields.courseIds.map((courseId) => ({ courseId })) }
                : undefined,
          } as any,
          include: { courseAccess: { select: { courseId: true } } },
        });
      } catch (error: any) {
        if (error?.code === 'P2002') {
          throw new BadRequestException(
            'A membership plan with this slug already exists.',
          );
        }
        throw new BadRequestException('Membership plan could not be created.');
      }
    }

    const plan = {
      id: `plan_${Date.now().toString(36)}`,
      ...fields.data,
      courseAccess: fields.data.accessAllCourses
        ? []
        : fields.courseIds.map((courseId) => ({ courseId })),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.prisma.inMemoryMembershipPlans.push(plan);
    return plan;
  }

  async updateMembershipPlan(id: string, dto: any) {
    const { data, courseIds } = this.normaliseMembershipPlan(dto);

    if (this.prisma.isDbConnected) {
      try {
        return await this.prisma.$transaction(async (transaction: any) => {
          await transaction.membershipCourseAccess.deleteMany({
            where: { planId: id },
          });
          if (!data.accessAllCourses && courseIds.length) {
            await transaction.membershipCourseAccess.createMany({
              data: courseIds.map((courseId) => ({ planId: id, courseId })),
              skipDuplicates: true,
            });
          }
          return transaction.membershipPlan.update({
            where: { id },
            data,
            include: { courseAccess: { select: { courseId: true } } },
          });
        });
      } catch (error: any) {
        if (error?.code === 'P2025')
          throw new NotFoundException('Membership plan not found.');
        if (error?.code === 'P2002')
          throw new BadRequestException(
            'A membership plan with this slug already exists.',
          );
        throw new BadRequestException('Membership plan could not be updated.');
      }
    }

    const plan = this.prisma.inMemoryMembershipPlans.find(
      (candidate) => candidate.id === id,
    );
    if (!plan) throw new NotFoundException('Membership plan not found.');
    Object.assign(plan, data, {
      courseAccess: data.accessAllCourses
        ? []
        : courseIds.map((courseId) => ({ courseId })),
      updatedAt: new Date(),
    });
    return plan;
  }

  async deleteMembershipPlan(id: string) {
    if (this.prisma.isDbConnected) {
      const subscriptions = await this.prisma.subscription.count({
        where: { planId: id },
      });
      if (subscriptions > 0) {
        throw new BadRequestException(
          'This plan has subscription history and cannot be deleted. Deactivate it instead.',
        );
      }
      try {
        await this.prisma.membershipPlan.delete({ where: { id } });
        return { success: true };
      } catch (error: any) {
        if (error?.code === 'P2025')
          throw new NotFoundException('Membership plan not found.');
        throw new BadRequestException('Membership plan could not be deleted.');
      }
    }
    const before = this.prisma.inMemoryMembershipPlans.length;
    this.prisma.inMemoryMembershipPlans =
      this.prisma.inMemoryMembershipPlans.filter((plan) => plan.id !== id);
    if (before === this.prisma.inMemoryMembershipPlans.length)
      throw new NotFoundException('Membership plan not found.');
    return { success: true };
  }

  async createCourse(dto: any) {
    const fields = await this.normaliseCourse(dto);

    if (this.prisma.isDbConnected) {
      try {
        return await this.prisma.course.create({
          data: {
            slug: fields.slug,
            title: fields.title,
            subtitle: fields.subtitle,
            description: fields.description,
            thumbnail: fields.thumbnail,
            promoVideoUrl: fields.promoVideoUrl,
            price: fields.price,
            isFree: fields.isFree,
            currency: fields.currency,
            level: fields.level,
            category: fields.category,
            isPublished: fields.isPublished,
            isArchived: false,
            modules: { create: this.toPrismaModules(fields.modules) },
          } as any,
          include: COURSE_INCLUDE,
        });
      } catch (error: any) {
        if (error?.code === 'P2002')
          throw new BadRequestException(
            'A course with this slug already exists.',
          );
        throw new BadRequestException('Course could not be created.');
      }
    }

    const course = {
      id: `course_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      ...fields,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.prisma.inMemoryCourses.unshift(course);
    return course;
  }

  async importJavascriptCourse() {
    const template = JAVASCRIPT_COURSE as typeof JAVASCRIPT_COURSE & {
      promoVideoUrl?: string;
    };

    if (this.prisma.isDbConnected) {
      try {
        const existing = await this.prisma.course.findUnique({
          where: { id: template.id },
          include: COURSE_INCLUDE,
        });
        if (existing) return (await this.withCourseMetrics([existing]))[0];

        const course = await this.prisma.course.create({
          data: {
            id: template.id,
            slug: template.slug,
            title: template.title,
            subtitle: template.subtitle,
            description: template.description,
            thumbnail: template.thumbnail,
            promoVideoUrl: template.promoVideoUrl ?? null,
            price: template.price,
            isFree: template.isFree ?? Number(template.price || 0) === 0,
            currency: template.currency,
            level: template.level,
            category: template.category,
            isPublished: template.isPublished,
            modules: {
              create: template.modules.map((module) => ({
                id: module.id,
                title: module.title,
                order: module.order,
                lessons: {
                  create: module.lessons.map((lesson) => ({
                    id: lesson.id,
                    title: lesson.title,
                    duration: lesson.duration,
                    order: lesson.order,
                    isFreePreview: lesson.isFreePreview,
                    videoAssetRef: lesson.videoAssetRef,
                  })),
                },
              })),
            },
          } as any,
          include: COURSE_INCLUDE,
        });
        return course;
      } catch (error: any) {
        if (error?.code !== 'P2002') {
          this.logger.error(
            `JavaScript course import failed: ${error?.message || 'unknown database error'}`,
          );
          throw new BadRequestException(
            'The JavaScript course could not be imported.',
          );
        }
        const existing = await this.prisma.course.findUnique({
          where: { id: template.id },
          include: COURSE_INCLUDE,
        });
        if (existing) return (await this.withCourseMetrics([existing]))[0];
      }
    }

    const existing = this.prisma.inMemoryCourses.find(
      (course) => course.id === template.id,
    );
    if (existing) return existing;

    const course = {
      ...template,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.prisma.inMemoryCourses.unshift(course);
    return course;
  }

  async updateCourse(id: string, dto: any) {
    const current = await this.getCourseById(id);
    const fields = await this.normaliseCourse(dto, id, current);

    if (this.prisma.isDbConnected) {
      try {
        return await this.prisma.course.update({
          where: { id },
          data: {
            slug: fields.slug,
            title: fields.title,
            subtitle: fields.subtitle,
            description: fields.description,
            thumbnail: fields.thumbnail,
            promoVideoUrl: fields.promoVideoUrl,
            price: fields.price,
            isFree: fields.isFree,
            currency: fields.currency,
            level: fields.level,
            category: fields.category,
            isPublished: fields.isPublished,
            modules: {
              deleteMany: {},
              create: this.toPrismaModules(fields.modules),
            },
          } as any,
          include: COURSE_INCLUDE,
        });
      } catch (error: any) {
        if (error?.code === 'P2002')
          throw new BadRequestException(
            'A course with this slug already exists.',
          );
        if (error?.code === 'P2025')
          throw new NotFoundException('Course not found.');
        throw new BadRequestException('Course could not be updated.');
      }
    }

    const index = this.prisma.inMemoryCourses.findIndex(
      (course) => course.id === id,
    );
    if (index === -1) throw new NotFoundException('Course not found.');

    const updated = {
      ...current,
      ...fields,
      id,
      createdAt: current.createdAt || new Date(),
      updatedAt: new Date(),
    };
    this.prisma.inMemoryCourses[index] = updated;
    return updated;
  }

  async deleteCourse(id: string) {
    if (this.prisma.isDbConnected) {
      try {
        // Course deletion is an archive operation. The catalog hides it
        // immediately, while enrollment progress, certificates, reviews, and
        // payment history remain available for reporting and support.
        await this.prisma.course.update({
          where: { id },
          data: { isArchived: true, isPublished: false },
        });
        this.removeInMemoryCourse(id);
        return { success: true, deleted: true };
      } catch (error: any) {
        if (error?.code === 'P2025') {
          this.removeInMemoryCourse(id);
          return { success: true, deleted: false };
        }
        this.logger.error(
          `Course deletion failed for ${id}: ${error?.message || 'unknown database error'}`,
          error?.stack,
        );
        throw new BadRequestException('Course could not be archived.');
      }
    }

    const course = this.prisma.inMemoryCourses.find(
      (candidate) => candidate.id === id,
    );
    if (!course || course.isArchived) return { success: true, deleted: false };
    course.isArchived = true;
    course.isPublished = false;
    course.updatedAt = new Date();
    return { success: true, deleted: true };
  }

  async createCoupon(dto: any) {
    const data = { ...this.normaliseCoupon(dto), timesUsed: 0 };

    if (this.prisma.isDbConnected) {
      try {
        return await this.prisma.coupon.create({ data: data as any });
      } catch (error: any) {
        if (error?.code === 'P2002')
          throw new BadRequestException('This coupon code already exists.');
        throw new BadRequestException('Coupon could not be created.');
      }
    }

    const coupon = {
      id: `coup_${Date.now().toString(36)}`,
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.prisma.inMemoryCoupons.unshift(coupon);
    return coupon;
  }

  async getCourseCoupon(courseId: string) {
    if (this.prisma.isDbConnected) {
      return this.prisma.coupon.findFirst({
        where: { courseId, scope: 'COURSE' },
        orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      });
    }
    return this.prisma.inMemoryCoupons.filter(c => c.courseId === courseId && c.scope === 'COURSE')
      .sort((a, b) => Number(Boolean(b.isActive)) - Number(Boolean(a.isActive)) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() || b.id.localeCompare(a.id))[0] || null;
  }

  async saveCourseCoupon(courseId: string, dto: any) {
    const course = this.prisma.isDbConnected
      ? await this.prisma.course.findUnique({ where: { id: courseId }, select: { id: true } })
      : this.prisma.inMemoryCourses.find(c => c.id === courseId);
    if (!course) throw new NotFoundException('Course not found.');
    const current = await this.getCourseCoupon(courseId);
    const data = this.normaliseCoupon({ ...dto, scope: 'COURSE', courseId }, current);
    // Stable ID makes repeated/concurrent first saves address the same record.
    const id = current?.id || `course_coupon_${courseId}`;
    if (this.prisma.isDbConnected) {
      try {
        return await this.prisma.$transaction(async (database) => {
          const saved = await database.coupon.upsert({
            where: { id }, create: { id, ...data, timesUsed: 0 } as any, update: data as any,
          });
          await database.coupon.updateMany({
            where: { courseId, scope: 'COURSE', id: { not: id } },
            data: { isActive: false },
          });
          return saved;
        });
      } catch (error: any) {
        if (error?.code === 'P2002') throw new BadRequestException('This coupon code is already used by another coupon.');
        throw new ServiceUnavailableException('Coupon was not saved. Please retry.');
      }
    }
    if (this.prisma.inMemoryCoupons.some(c => c.id !== id && c.code === data.code)) throw new BadRequestException('This coupon code is already used by another coupon.');
    this.prisma.inMemoryCoupons
      .filter(c => c.id !== id && c.courseId === courseId && c.scope === 'COURSE')
      .forEach(c => { c.isActive = false; c.updatedAt = new Date(); });
    if (current) { Object.assign(current, data, { updatedAt: new Date() }); return current; }
    const coupon = { id, ...data, timesUsed: 0, createdAt: new Date(), updatedAt: new Date() };
    this.prisma.inMemoryCoupons.unshift(coupon);
    return coupon;
  }

  async updateCoupon(id: string, dto: any) {
    if (this.prisma.isDbConnected) {
      const current = await this.prisma.coupon.findUnique({ where: { id } });
      if (!current) throw new NotFoundException('Coupon not found.');
      const data = this.normaliseCoupon(dto, current);
      try {
        return await this.prisma.$transaction(async (database) => {
          const updated = await database.coupon.update({
            where: { id },
            data: data as any,
          });
          if (updated.scope === 'COURSE' && updated.courseId && updated.isActive) {
            await database.coupon.updateMany({
              where: {
                courseId: updated.courseId,
                scope: 'COURSE',
                id: { not: updated.id },
              },
              data: { isActive: false },
            });
          }
          return updated;
        });
      } catch (error: any) {
        if (error?.code === 'P2002')
          throw new BadRequestException('This coupon code already exists.');
        throw new BadRequestException('Coupon could not be updated.');
      }
    }
    const coupon = this.prisma.inMemoryCoupons.find(
      (candidate) => candidate.id === id,
    );
    if (!coupon) throw new NotFoundException('Coupon not found.');
    Object.assign(coupon, this.normaliseCoupon(dto, coupon), {
      updatedAt: new Date(),
    });
    if (coupon.scope === 'COURSE' && coupon.courseId && coupon.isActive) {
      this.prisma.inMemoryCoupons
        .filter(candidate => candidate.id !== id && candidate.courseId === coupon.courseId && candidate.scope === 'COURSE')
        .forEach(candidate => { candidate.isActive = false; candidate.updatedAt = new Date(); });
    }
    return coupon;
  }

  async getAllCoupons() {
    if (this.prisma.isDbConnected) {
      try {
        return await this.prisma.coupon.findMany({
          orderBy: { createdAt: 'desc' },
        });
      } catch {
        throw new ServiceUnavailableException('Your data could not be loaded or saved. Please retry shortly.');
      }
    }

    if (this.prisma.inMemoryCoupons.length === 0) {
      this.prisma.inMemoryCoupons = DEFAULT_COUPONS.map((coupon) => ({
        ...coupon,
        createdAt: new Date(),
      }));
    }
    return this.prisma.inMemoryCoupons;
  }

  async deleteCoupon(id: string) {
    if (this.prisma.isDbConnected) {
      try {
        await this.prisma.coupon.delete({ where: { id } });
        return { success: true };
      } catch (error: any) {
        if (error?.code === 'P2025')
          throw new NotFoundException('Coupon not found.');
        throw new BadRequestException('Coupon could not be deleted.');
      }
    }

    this.prisma.inMemoryCoupons = this.prisma.inMemoryCoupons.filter(
      (coupon) => coupon.id !== id,
    );
    return { success: true };
  }

  async getContactMessages() {
    if (this.prisma.isDbConnected) {
      try {
        return await this.prisma.contactMessage.findMany({
          orderBy: { createdAt: 'desc' },
        });
      } catch {
        throw new ServiceUnavailableException('Your data could not be loaded or saved. Please retry shortly.');
      }
    }

    return [...this.prisma.inMemoryContactMessages].sort(
      (a, b) =>
        new Date(b.createdAt || 0).getTime() -
        new Date(a.createdAt || 0).getTime(),
    );
  }

  async updateContactMessageStatus(id: string, requestedStatus?: string) {
    const status = String(requestedStatus || '').toUpperCase();
    if (!['NEW', 'RESOLVED'].includes(status)) {
      throw new BadRequestException(
        'Contact message status must be NEW or RESOLVED.',
      );
    }

    if (this.prisma.isDbConnected) {
      try {
        return await this.prisma.contactMessage.update({
          where: { id },
          data: { status },
        });
      } catch (error: any) {
        if (error?.code === 'P2025') {
          throw new NotFoundException('Contact message not found.');
        }
        throw new BadRequestException('Contact message could not be updated.');
      }
    }

    const message = this.prisma.inMemoryContactMessages.find(
      (candidate) => candidate.id === id,
    );
    if (!message) throw new NotFoundException('Contact message not found.');
    message.status = status;
    message.updatedAt = new Date();
    return message;
  }

  async deleteContactMessage(id: string) {
    if (this.prisma.isDbConnected) {
      try {
        await this.prisma.contactMessage.delete({ where: { id } });
        return { success: true };
      } catch (error: any) {
        if (error?.code === 'P2025') {
          throw new NotFoundException('Contact message not found.');
        }
        throw new BadRequestException('Contact message could not be deleted.');
      }
    }

    const originalLength = this.prisma.inMemoryContactMessages.length;
    this.prisma.inMemoryContactMessages =
      this.prisma.inMemoryContactMessages.filter(
        (message) => message.id !== id,
      );
    if (this.prisma.inMemoryContactMessages.length === originalLength) {
      throw new NotFoundException('Contact message not found.');
    }
    return { success: true };
  }

  private normaliseMembershipPlan(dto: any) {
    const name = String(dto.name || '').trim();
    if (!name)
      throw new BadRequestException('Membership plan name is required.');
    const slug = String(dto.slug || name)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    if (!slug)
      throw new BadRequestException('Membership plan slug is required.');
    const price = Number(dto.price);
    if (!Number.isFinite(price) || price < 0)
      throw new BadRequestException(
        'Membership price must be a non-negative number.',
      );
    const features = Array.isArray(dto.features)
      ? dto.features
          .map((feature: any) => String(feature).trim())
          .filter(Boolean)
      : String(dto.featuresText || '')
          .split('\n')
          .map((feature) => feature.trim())
          .filter(Boolean);
    const accessAllCourses = dto.accessAllCourses !== false;
    const courseIds = Array.isArray(dto.courseIds)
      ? ([
          ...new Set(
            dto.courseIds
              .map((courseId: any) => String(courseId).trim())
              .filter(Boolean),
          ),
        ] as string[])
      : [];
    return {
      data: {
        name,
        slug,
        description: String(dto.description || '').trim() || null,
        price,
        currency: String(dto.currency || 'INR')
          .trim()
          .toUpperCase(),
        interval:
          String(dto.interval || 'MONTHLY').toUpperCase() === 'ANNUAL'
            ? 'ANNUAL'
            : 'MONTHLY',
        isFree: dto.isFree === true || price === 0,
        features,
        isActive: dto.isActive !== false,
        accessAllCourses,
      },
      courseIds,
    };
  }

  private normaliseCoupon(dto: any, current?: any) {
    const code = String(dto.code ?? current?.code ?? '')
      .trim()
      .toUpperCase();
    if (!code) throw new BadRequestException('Coupon code is required.');
    const percentValue = dto.discountPercent !== undefined ? dto.discountPercent : current?.discountPercent;
    const amountValue = dto.discountAmount !== undefined ? dto.discountAmount : current?.discountAmount;
    const discountPercent =
      percentValue === null || percentValue === '' || percentValue === undefined
        ? null
        : Number(percentValue);
    const discountAmount =
      amountValue === null || amountValue === '' || amountValue === undefined
        ? null
        : Number(amountValue);
    if (discountPercent === null && discountAmount === null)
      throw new BadRequestException('Enter a percentage or fixed discount.');
    if (discountPercent !== null && discountAmount !== null) throw new BadRequestException('Choose either a percentage or a fixed discount.');
    if (
      discountPercent !== null &&
      (!Number.isFinite(discountPercent) ||
        discountPercent <= 0 ||
        discountPercent > 100)
    )
      throw new BadRequestException(
        'Percentage discount must be between 1 and 100.',
      );
    if (
      discountAmount !== null &&
      (!Number.isFinite(discountAmount) || discountAmount <= 0)
    )
      throw new BadRequestException(
        'Fixed discount must be greater than zero.',
      );
    const requestedScope = String(dto.scope ?? current?.scope ?? 'COURSE').toUpperCase();
    const scope =
      requestedScope === 'MEMBERSHIP'
        ? 'MEMBERSHIP'
        : requestedScope === 'TEMPLATE'
          ? 'TEMPLATE'
          : 'COURSE';
    const courseId =
      dto.courseId !== undefined
        ? dto.courseId || null
        : current?.courseId || null;
    const templateProductId =
      dto.templateProductId !== undefined
        ? dto.templateProductId || null
        : current?.templateProductId || null;
    if (scope === 'COURSE' && !courseId)
      throw new BadRequestException(
        'Course coupons must be locked to a course.',
      );
    if (scope === 'MEMBERSHIP' && courseId)
      throw new BadRequestException(
        'Membership coupons cannot be attached to a course.',
      );
    if (scope === 'TEMPLATE' && !templateProductId)
      throw new BadRequestException(
        'Template coupons must be locked to a UI template product.',
      );
    const usageValue = dto.usageLimit !== undefined ? dto.usageLimit : current?.usageLimit;
    const usageLimit =
      usageValue === null || usageValue === '' || usageValue === undefined
        ? null
        : Number(usageValue);
    if (usageLimit !== null && (!Number.isInteger(usageLimit) || usageLimit < 1)) throw new BadRequestException('Usage limit must be a positive whole number.');
    return {
      code,
      discountPercent,
      discountAmount,
      scope,
      courseId: scope === 'COURSE' ? courseId : null,
      templateProductId: scope === 'TEMPLATE' ? templateProductId : null,
      usageLimit,
      isActive: dto.isActive ?? current?.isActive ?? true,
    };
  }

  private async normaliseCourse(dto: any, existingId?: string, current?: any) {
    const title = String(dto.title ?? current?.title ?? '').trim();
    if (!title) throw new BadRequestException('Course title is required.');

    const requestedPrice = Number(dto.price ?? current?.price ?? 0);
    if (!Number.isFinite(requestedPrice) || requestedPrice < 0)
      throw new BadRequestException(
        'Course price must be a non-negative number.',
      );
    const isFree = Boolean(
      dto.isFree ?? current?.isFree ?? requestedPrice === 0,
    );
    const price = isFree ? 0 : requestedPrice;

    const requestedSlug = String(dto.slug ?? current?.slug ?? title);
    const slug = await this.uniqueSlug(requestedSlug, existingId);
    const modules = this.normaliseModules(
      dto.modules ?? current?.modules ?? [],
    );

    return {
      slug,
      title,
      subtitle: String(dto.subtitle ?? current?.subtitle ?? '').trim(),
      description: String(dto.description ?? current?.description ?? '').trim(),
      thumbnail: this.cleanThumbnail(
        Object.prototype.hasOwnProperty.call(dto, 'thumbnail')
          ? dto.thumbnail
          : current?.thumbnail,
      ),
      promoVideoUrl: this.cleanPromoVideoUrl(
        Object.prototype.hasOwnProperty.call(dto, 'promoVideoUrl')
          ? dto.promoVideoUrl
          : current?.promoVideoUrl,
      ),
      price,
      isFree,
      currency: String(
        dto.currency ?? current?.currency ?? 'INR',
      ).toUpperCase(),
      level: String(dto.level ?? current?.level ?? 'Intermediate'),
      category:
        String(dto.category ?? current?.category ?? 'Web Development').trim() ||
        'Web Development',
      isPublished: Boolean(
        dto.isPublished ??
          (dto.status
            ? dto.status === 'LIVE'
            : (current?.isPublished ?? false)),
      ),
      modules,
    };
  }

  private async withCourseMetrics(courses: any[]) {
    if (!courses.length) return courses;

    const courseIds = courses.map((course) => course.id).filter(Boolean);
    const monthStart = new Date();
    monthStart.setHours(0, 0, 0, 0);
    monthStart.setDate(1);

    let payments: any[] = [];
    let enrollments: any[] = [];

    if (this.prisma.isDbConnected) {
      try {
        [payments, enrollments] = await Promise.all([
          this.prisma.payment.findMany({
            where: {
              courseId: { in: courseIds },
              status: 'SUCCESS',
              createdAt: { gte: monthStart },
            },
            select: { courseId: true, amount: true, createdAt: true },
          }),
          this.prisma.enrollment.findMany({
            where: {
              courseId: { in: courseIds },
              createdAt: { gte: monthStart },
            },
            select: { courseId: true, createdAt: true },
          }),
        ]);
      } catch {
        payments = this.prisma.inMemoryPayments;
        enrollments = this.prisma.inMemoryEnrollments;
      }
    } else {
      payments = this.prisma.inMemoryPayments;
      enrollments = this.prisma.inMemoryEnrollments;
    }

    const revenueByCourse = new Map<string, number>();
    for (const payment of payments) {
      if (
        payment.courseId &&
        payment.status === 'SUCCESS' &&
        new Date(payment.createdAt || 0).getTime() >= monthStart.getTime()
      ) {
        revenueByCourse.set(
          payment.courseId,
          (revenueByCourse.get(payment.courseId) || 0) +
            Number(payment.amount || 0),
        );
      }
    }

    const enrollmentsByCourse = new Map<string, number>();
    for (const enrollment of enrollments) {
      if (
        enrollment.courseId &&
        new Date(enrollment.createdAt || 0).getTime() >= monthStart.getTime()
      ) {
        enrollmentsByCourse.set(
          enrollment.courseId,
          (enrollmentsByCourse.get(enrollment.courseId) || 0) + 1,
        );
      }
    }

    return courses.map((course) => {
      const reviews = Array.isArray(course.reviews) ? course.reviews : [];
      const rating = reviews.length
        ? Number(
            (
              reviews.reduce(
                (total: number, review: any) =>
                  total + Number(review.rating || 0),
                0,
              ) / reviews.length
            ).toFixed(1),
          )
        : 0;
      return {
        ...course,
        isFree: Boolean(course.isFree ?? Number(course.price || 0) === 0),
        rating,
        reviewCount: reviews.length,
        earnedThisMonth: Math.round(revenueByCourse.get(course.id) || 0),
        enrollmentsThisMonth: enrollmentsByCourse.get(course.id) || 0,
      };
    });
  }

  private normaliseModules(modules: any[]) {
    return (Array.isArray(modules) ? modules : []).map(
      (module, moduleIndex) => ({
        id: module.id || `module_${Date.now().toString(36)}_${moduleIndex + 1}`,
        title: String(module.title || `Section ${moduleIndex + 1}`).trim(),
        order: moduleIndex + 1,
        lessons: (Array.isArray(module.lessons) ? module.lessons : []).map(
          (lesson: any, lessonIndex: number) => ({
            id:
              lesson.id ||
              `lesson_${Date.now().toString(36)}_${moduleIndex + 1}_${lessonIndex + 1}`,
            title: String(lesson.title || `Lecture ${lessonIndex + 1}`).trim(),
            description: lesson.description ? String(lesson.description) : null,
            videoAssetRef: this.cleanVideoAssetRef(lesson.videoAssetRef),
            duration: Math.max(0, Number(lesson.duration) || 0),
            order: lessonIndex + 1,
            isFreePreview: Boolean(lesson.isFreePreview),
          }),
        ),
      }),
    );
  }

  private toPrismaModules(modules: any[]) {
    return modules.map((module) => ({
      // Keep curriculum identities stable when an administrator edits a
      // course. Enrollments store the last watched lesson ID, so replacing
      // every module/lesson ID on each save would send returning students to
      // a lesson that no longer exists even though their enrollment remains.
      id: module.id,
      title: module.title,
      order: module.order,
      lessons: {
        create: (module.lessons || []).map((lesson: any) => ({
          id: lesson.id,
          title: lesson.title,
          description: lesson.description,
          videoAssetRef: lesson.videoAssetRef,
          duration: lesson.duration,
          order: lesson.order,
          isFreePreview: lesson.isFreePreview,
        })),
      },
    }));
  }

  private async uniqueSlug(value: string, existingId?: string) {
    const base = this.slugify(value) || `course-${Date.now().toString(36)}`;
    let slug = base;
    let suffix = 2;
    while (await this.slugExists(slug, existingId))
      slug = `${base}-${suffix++}`;
    return slug;
  }

  private async slugExists(slug: string, existingId?: string) {
    if (this.prisma.isDbConnected) {
      try {
        const existing = await this.prisma.course.findUnique({
          where: { slug },
          select: { id: true },
        });
        return Boolean(existing && existing.id !== existingId);
      } catch {
        // Check the local adapter below.
      }
    }
    return this.prisma.inMemoryCourses.some(
      (course) => course.slug === slug && course.id !== existingId,
    );
  }

  private slugify(value: string) {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  private cleanVideoAssetRef(value: unknown): string | null {
    const ref = String(value || '').trim();
    return ref && !/^demo(?:[_-]|$)/i.test(ref) ? ref : null;
  }

  private cleanPromoVideoUrl(value: unknown): string | null {
    const url = String(value || '').trim();
    if (!url) return null;
    if (url.length > 12_000_000) {
      throw new BadRequestException(
        'Promotional video files must be 8 MB or smaller.',
      );
    }
    // Uploaded files are stored server-side and referenced by the relative
    // /uploads/... path returned by MediaService — accept that the same way
    // cleanThumbnail() already does, so a locally-uploaded intro video can
    // actually be saved (previously only data: URIs and absolute http(s)
    // links were accepted here, which silently rejected every file upload).
    if (url.startsWith('data:video/') || url.startsWith('/')) return url;
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error('Unsupported protocol');
      }
      return parsed.toString();
    } catch {
      throw new BadRequestException(
        'Promotional video must be a valid YouTube, Vimeo, or video URL.',
      );
    }
  }

  private cleanThumbnail(value: unknown): string | null {
    const thumbnail = String(value || '').trim();
    if (!thumbnail) return null;
    if (thumbnail.length > 8_000_000) {
      throw new BadRequestException('Course images must be 4 MB or smaller.');
    }
    if (thumbnail.startsWith('data:image/') || thumbnail.startsWith('/'))
      return thumbnail;
    try {
      const parsed = new URL(thumbnail);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error('Unsupported protocol');
      }
      return parsed.toString();
    } catch {
      throw new BadRequestException(
        'Course thumbnail must be a valid image URL or uploaded image.',
      );
    }
  }

  private removeInMemoryCourse(id: string) {
    const course = this.prisma.inMemoryCourses.find(
      (candidate) => candidate.id === id,
    );
    if (course) {
      course.isArchived = true;
      course.isPublished = false;
      course.updatedAt = new Date();
    }
  }
}

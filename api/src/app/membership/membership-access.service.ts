import { Global, Injectable, Logger, Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ActivePlan {
  planId: string;
  name: string;
  accessAllCourses: boolean;
  courseIds: string[];
  currentPeriodEnd: Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** How long one paid period of a plan lasts. */
export function membershipPeriodEnd(interval: string, from: Date): Date {
  const end = new Date(from);
  if (String(interval).toUpperCase() === 'MONTHLY') end.setMonth(end.getMonth() + 1);
  else end.setFullYear(end.getFullYear() + 1);
  // Never shorter than the plan promises if the month rolls over oddly.
  return end.getTime() > from.getTime() ? end : new Date(from.getTime() + 30 * DAY_MS);
}

/**
 * A course that came with a membership counts only while that membership is
 * active. Courses bought or enrolled on their own have no plan and always count.
 */
export function enrollmentAllowed(enrollment: any, activePlanIds: Set<string>) {
  return Boolean(enrollment) && (!enrollment.membershipPlanId || activePlanIds.has(enrollment.membershipPlanId));
}

/**
 * Membership access. An active member gets a normal enrollment (tagged with
 * the plan) for every course the plan covers, so lessons, progress,
 * certificates and the dashboard work exactly as for a bought course.
 */
@Injectable()
export class MembershipAccessService {
  private readonly logger = new Logger(MembershipAccessService.name);

  constructor(private prisma: PrismaService) {}

  /** Plans the user can learn with right now. */
  async activePlans(userId: string): Promise<ActivePlan[]> {
    const now = new Date();
    if (this.prisma.isDbConnected) {
      const subscriptions = await this.prisma.subscription.findMany({
        where: { userId, status: 'ACTIVE', currentPeriodEnd: { gt: now } },
        include: { plan: { include: { courseAccess: { select: { courseId: true } } } } },
        orderBy: { currentPeriodEnd: 'desc' },
      });
      return subscriptions.map((subscription: any) => ({
        planId: subscription.planId,
        name: subscription.plan?.name || 'Membership',
        accessAllCourses: subscription.plan?.accessAllCourses !== false,
        courseIds: (subscription.plan?.courseAccess || []).map((item: any) => item.courseId),
        currentPeriodEnd: subscription.currentPeriodEnd,
      }));
    }
    return this.prisma.inMemorySubscriptions
      .filter((item) => item.userId === userId && item.status === 'ACTIVE' && new Date(item.currentPeriodEnd) > now)
      .map((item) => {
        const plan = this.prisma.inMemoryMembershipPlans.find((candidate) => candidate.id === item.planId) || {};
        return {
          planId: item.planId,
          name: plan.name || 'Membership',
          accessAllCourses: plan.accessAllCourses !== false,
          courseIds: plan.courseIds || (plan.courseAccess || []).map((access: any) => access.courseId),
          currentPeriodEnd: new Date(item.currentPeriodEnd),
        };
      });
  }

  /**
   * Makes sure an active member has an enrollment for every covered course
   * (keeping existing progress) and returns the active plan IDs. Never throws:
   * a hiccup here must not lock anyone out of courses they bought.
   */
  async sync(userId: string): Promise<Set<string>> {
    let plans: ActivePlan[] = [];
    try {
      plans = await this.activePlans(userId);
      if (!plans.length) return new Set();
      const coverAll = plans.find((plan) => plan.accessAllCourses);
      if (this.prisma.isDbConnected) {
        const courses = await this.prisma.course.findMany({
          where: {
            isPublished: true,
            isArchived: false,
            ...(coverAll ? {} : { id: { in: [...new Set(plans.flatMap((plan) => plan.courseIds))] } }),
          },
          select: { id: true },
        });
        const planFor = (courseId: string) =>
          (coverAll || plans.find((plan) => plan.courseIds.includes(courseId)))!.planId;
        if (courses.length) {
          await this.prisma.enrollment.createMany({
            data: courses.map((course: any) => ({
              userId,
              courseId: course.id,
              membershipPlanId: planFor(course.id),
              progressPercent: 0,
              completedLessonIds: [],
            })) as any,
            skipDuplicates: true,
          });
          // Renewed on a different plan: move access (and progress) to it.
          const activeIds = plans.map((plan) => plan.planId);
          const stale = await this.prisma.enrollment.findMany({
            where: {
              userId,
              courseId: { in: courses.map((course: any) => course.id) },
              membershipPlanId: { not: null, notIn: activeIds },
            } as any,
            select: { id: true, courseId: true },
          });
          for (const enrollment of stale) {
            await this.prisma.enrollment.update({
              where: { id: enrollment.id },
              data: { membershipPlanId: planFor(enrollment.courseId) } as any,
            });
          }
        }
      } else {
        const courses = this.prisma.inMemoryCourses.filter(
          (course) =>
            course.isPublished !== false &&
            !course.isArchived &&
            (coverAll || plans.some((plan) => plan.courseIds.includes(course.id))),
        );
        for (const course of courses) {
          if (this.prisma.inMemoryEnrollments.some((item) => item.userId === userId && item.courseId === course.id)) continue;
          this.prisma.inMemoryEnrollments.push({
            id: `enrollment_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
            userId,
            courseId: course.id,
            membershipPlanId: (coverAll || plans.find((plan) => plan.courseIds.includes(course.id)))!.planId,
            progressPercent: 0,
            completedLessonIds: [],
            course,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
      }
    } catch (error: any) {
      this.logger.warn(`Could not sync membership courses for ${userId}: ${error?.message || error}`);
    }
    return new Set(plans.map((plan) => plan.planId));
  }
}

@Global()
@Module({
  providers: [MembershipAccessService],
  exports: [MembershipAccessService],
})
export class MembershipModule {}

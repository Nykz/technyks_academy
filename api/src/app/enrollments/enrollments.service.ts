import { ServiceUnavailableException } from '@nestjs/common';
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EnrollmentsService {
  constructor(private prisma: PrismaService) {}

  async getMyEnrollments(userId: string) {
    if (this.prisma.isDbConnected) {
      try {
        return await this.prisma.enrollment.findMany({
          where: { userId },
          include: {
            course: {
              include: {
                modules: {
                  include: {
                    lessons: {
                      select: {
                        id: true,
                        title: true,
                        duration: true,
                        order: true,
                        isFreePreview: true,
                      },
                    },
                  },
                  orderBy: { order: 'asc' },
                },
              },
            },
          },
          orderBy: { updatedAt: 'desc' },
        });
      } catch {
        throw new ServiceUnavailableException(
          'Your data could not be loaded or saved. Please retry shortly.',
        );
      }
    }

    return this.prisma.inMemoryEnrollments
      .filter((enrollment) => enrollment.userId === userId)
      .map((enrollment) => ({
        ...enrollment,
        course:
          enrollment.course ||
          this.prisma.inMemoryCourses.find(
            (course) => course.id === enrollment.courseId,
          ),
      }))
      .filter((enrollment) => enrollment.course);
  }

  async getCourseAccess(userId: string, courseId: string) {
    let enrollment: any = null;
    if (this.prisma.isDbConnected) {
      try {
        enrollment = await this.prisma.enrollment.findUnique({
          where: { userId_courseId: { userId, courseId } },
        });
      } catch {
        throw new ServiceUnavailableException(
          'Your course access could not be verified. Please retry shortly.',
        );
      }
    } else {
      enrollment = this.prisma.inMemoryEnrollments.find(
        (item) => item.userId === userId && item.courseId === courseId,
      );
    }

    return {
      enrolled: Boolean(enrollment),
      enrollment: enrollment || null,
    };
  }

  async enrollInFreeCourse(userId: string, courseId: string) {
    // Ownership is permanent and is checked before today's course price.
    const owned = this.prisma.isDbConnected
      ? await this.prisma.enrollment.findUnique({
          where: { userId_courseId: { userId, courseId } },
        })
      : this.prisma.inMemoryEnrollments.find(
          (item) => item.userId === userId && item.courseId === courseId,
        );
    if (owned) return owned;
    let course: any = null;

    if (this.prisma.isDbConnected) {
      try {
        course = await this.prisma.course.findUnique({
          where: { id: courseId },
          select: {
            id: true,
            isFree: true,
            price: true,
            isPublished: true,
            isArchived: true,
          },
        });
      } catch {
        throw new ServiceUnavailableException(
          'Your data could not be loaded or saved. Please retry shortly.',
        );
      }
    }

    course ??= this.prisma.inMemoryCourses.find(
      (candidate) => candidate.id === courseId || candidate.slug === courseId,
    );
    if (!course) throw new NotFoundException('Course not found.');
    if (course.isArchived || course.isPublished === false)
      throw new NotFoundException(
        'Course is not available for new enrollments.',
      );

    const isFree = course.isFree === true || Number(course.price) === 0;
    if (!isFree) {
      throw new ForbiddenException(
        'This course requires payment before enrollment.',
      );
    }

    if (this.prisma.isDbConnected) {
      try {
        return await this.prisma.enrollment.upsert({
          where: { userId_courseId: { userId, courseId: course.id } },
          create: {
            userId,
            courseId: course.id,
            progressPercent: 0,
            completedLessonIds: [],
          },
          update: {},
        });
      } catch {
        throw new ServiceUnavailableException(
          'Your data could not be loaded or saved. Please retry shortly.',
        );
      }
    }

    const existing = this.prisma.inMemoryEnrollments.find(
      (enrollment) =>
        enrollment.userId === userId && enrollment.courseId === course.id,
    );
    if (existing) return existing;

    const enrollment = {
      id: `enrollment_${Date.now().toString(36)}`,
      userId,
      courseId: course.id,
      progressPercent: 0,
      completedLessonIds: [],
      course,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.prisma.inMemoryEnrollments.push(enrollment);
    return enrollment;
  }

  async updateProgress(
    userId: string,
    dto: { courseId: string; lessonId: string; isCompleted?: boolean },
  ) {
    let enrollment: any = null;
    let course: any = null;
    let usingDatabase = false;

    if (this.prisma.isDbConnected) {
      try {
        enrollment = await this.prisma.enrollment.findUnique({
          where: { userId_courseId: { userId, courseId: dto.courseId } },
        });
        course = await this.prisma.course.findUnique({
          where: { id: dto.courseId },
          include: { modules: { include: { lessons: true } } },
        });
        usingDatabase = Boolean(course);
      } catch {
        throw new ServiceUnavailableException(
          'Your data could not be loaded or saved. Please retry shortly.',
        );
      }
    }

    course ??= this.prisma.inMemoryCourses.find(
      (candidate) =>
        candidate.id === dto.courseId || candidate.slug === dto.courseId,
    );
    if (!course) throw new NotFoundException('Course not found.');

    if (!enrollment) {
      enrollment = this.prisma.inMemoryEnrollments.find(
        (item) => item.userId === userId && item.courseId === course.id,
      );
    }
    if (!enrollment)
      throw new ForbiddenException(
        'You must enroll in this course before saving progress.',
      );

    const totalLessonsCount = (course.modules || []).reduce(
      (total: number, module: any) => total + (module.lessons?.length || 0),
      0,
    );
    const lessonIds = new Set(
      (course.modules || []).flatMap((module: any) =>
        (module.lessons || []).map((lesson: any) => lesson.id),
      ),
    );
    if (!lessonIds.has(dto.lessonId))
      throw new NotFoundException('Lesson does not belong to this course.');
    const completed = [
      ...new Set<string>(
        (enrollment.completedLessonIds || []).filter(
          (id: string) =>
            lessonIds.has(id) &&
            (dto.isCompleted !== false || id !== dto.lessonId),
        ),
      ),
    ];
    if (dto.isCompleted && !completed.includes(dto.lessonId))
      completed.push(dto.lessonId);
    const progressPercent =
      totalLessonsCount > 0
        ? Math.min(
            100,
            Math.round((completed.length / totalLessonsCount) * 100),
          )
        : 0;

    const updateData = {
      lastWatchedLessonId: dto.lessonId,
      completedLessonIds: completed,
      progressPercent,
      updatedAt: new Date(),
    };

    let updated = { ...enrollment, ...updateData, course };
    if (usingDatabase) {
      try {
        const saved = await this.prisma.enrollment.update({
          where: { id: enrollment.id },
          data: updateData,
        });
        updated = { ...enrollment, ...updateData, ...(saved || {}), course };
      } catch {
        throw new ServiceUnavailableException(
          'Your data could not be loaded or saved. Please retry shortly.',
        );
      }
    } else {
      Object.assign(enrollment, updateData, { course });
    }

    if (progressPercent === 100)
      await this.generateCertificateIfEligible(userId, course.id);
    return updated;
  }

  async generateCertificateIfEligible(userId: string, courseId: string) {
    if (this.prisma.isDbConnected) {
      try {
        const existing = await this.prisma.certificate.findUnique({
          where: { userId_courseId: { userId, courseId } },
        });
        if (existing) return existing;

        const certificateNumber = this.createCertificateNumber();
        return await this.prisma.certificate.create({
          data: {
            userId,
            courseId,
            certificateNumber,
            pdfUrl: `/api/certificates/download/${certificateNumber}.pdf`,
          },
        });
      } catch {
        throw new ServiceUnavailableException(
          'Your data could not be loaded or saved. Please retry shortly.',
        );
      }
    }

    const existingMem = this.prisma.inMemoryCertificates.find(
      (certificate) =>
        certificate.userId === userId && certificate.courseId === courseId,
    );
    if (existingMem) return existingMem;

    const certificateNumber = this.createCertificateNumber();
    const certificate = {
      id: `cert_${Date.now().toString(36)}`,
      userId,
      courseId,
      certificateNumber,
      pdfUrl: `/api/certificates/download/${certificateNumber}.pdf`,
      issuedAt: new Date(),
    };
    this.prisma.inMemoryCertificates.push(certificate);
    return certificate;
  }

  private createCertificateNumber() {
    return `CERT-TA-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  }
}

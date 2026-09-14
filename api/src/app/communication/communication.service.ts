import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

type Actor = {
  id: string;
  role: string;
  name?: string;
  avatarUrl?: string | null;
};

@Injectable()
export class CommunicationService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  async listQuestions(actor: Actor, courseId: string, lessonId?: string) {
    await this.assertCourseAccess(actor, courseId);
    const questions = await this.readQuestions();
    return questions
      .filter(
        (question) =>
          question.courseId === courseId &&
          (!lessonId || question.lessonId === lessonId),
      )
      .sort((a, b) => this.time(b.createdAt) - this.time(a.createdAt));
  }

  async listQuestionsForAdmin(
    _actor: Actor,
    filters: { courseId?: string; status?: string; search?: string },
  ) {
    const query = String(filters.search || '')
      .trim()
      .toLowerCase();
    return (await this.readQuestions())
      .filter(
        (question) =>
          (!filters.courseId || question.courseId === filters.courseId) &&
          (!filters.status ||
            filters.status === 'ALL' ||
            question.status === filters.status) &&
          (!query ||
            `${question.title} ${question.body} ${question.user?.name || ''}`
              .toLowerCase()
              .includes(query)),
      )
      .sort((a, b) => this.time(b.updatedAt) - this.time(a.updatedAt));
  }

  async createQuestion(
    actor: Actor,
    courseId: string,
    dto: { lessonId?: string; title?: string; body?: string },
  ) {
    await this.assertCourseAccess(actor, courseId);
    const title = this.requiredText(dto.title, 'Question title', 4, 240);
    const body = this.requiredText(dto.body, 'Question details', 8, 4_000);
    const lessonId = String(dto.lessonId || '').trim() || null;
    if (lessonId) await this.assertLessonBelongsToCourse(lessonId, courseId);

    const record = {
      id: randomUUID(),
      userId: actor.id,
      courseId,
      lessonId,
      title,
      body,
      status: 'OPEN',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (this.prisma.isDbConnected) {
      await this.prisma.$executeRawUnsafe(
        'INSERT INTO `CourseQuestion` (`id`,`userId`,`courseId`,`lessonId`,`title`,`body`,`status`,`createdAt`,`updatedAt`) VALUES (?,?,?,?,?,?,?,NOW(3),NOW(3))',
        record.id,
        record.userId,
        record.courseId,
        record.lessonId,
        record.title,
        record.body,
        record.status,
      );
    } else {
      this.prisma.inMemoryCourseQuestions.unshift(record);
    }

    return (await this.readQuestions()).find(
      (question) => question.id === record.id,
    );
  }

  async createReply(actor: Actor, questionId: string, dto: { body?: string }) {
    const question = (await this.readQuestions()).find(
      (candidate) => candidate.id === questionId,
    );
    if (!question) throw new NotFoundException('Question not found.');
    await this.assertCourseAccess(actor, question.courseId);
    const body = this.requiredText(dto.body, 'Reply', 2, 4_000);
    const isInstructor = actor.role === 'ADMIN';
    const reply = {
      id: randomUUID(),
      questionId,
      userId: actor.id,
      body,
      isInstructor,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (this.prisma.isDbConnected) {
      await this.prisma.$executeRawUnsafe(
        'INSERT INTO `CourseReply` (`id`,`questionId`,`userId`,`body`,`isInstructor`,`createdAt`,`updatedAt`) VALUES (?,?,?,?,?,NOW(3),NOW(3))',
        reply.id,
        reply.questionId,
        reply.userId,
        reply.body,
        reply.isInstructor,
      );
      if (isInstructor) {
        await this.prisma.$executeRawUnsafe(
          "UPDATE `CourseQuestion` SET `status` = 'ANSWERED', `updatedAt` = NOW(3) WHERE `id` = ?",
          questionId,
        );
      }
    } else {
      this.prisma.inMemoryCourseReplies.push(reply);
      if (isInstructor) {
        const stored = this.prisma.inMemoryCourseQuestions.find(
          (candidate) => candidate.id === questionId,
        );
        if (stored)
          Object.assign(stored, { status: 'ANSWERED', updatedAt: new Date() });
      }
    }

    return (await this.readQuestions()).find(
      (candidate) => candidate.id === questionId,
    );
  }

  async updateQuestionStatus(questionId: string, requested?: string) {
    const status = String(requested || '').toUpperCase();
    if (!['OPEN', 'ANSWERED', 'RESOLVED'].includes(status)) {
      throw new BadRequestException(
        'Status must be OPEN, ANSWERED, or RESOLVED.',
      );
    }
    const question = (await this.readQuestions()).find(
      (candidate) => candidate.id === questionId,
    );
    if (!question) throw new NotFoundException('Question not found.');

    if (this.prisma.isDbConnected) {
      await this.prisma.$executeRawUnsafe(
        'UPDATE `CourseQuestion` SET `status` = ?, `updatedAt` = NOW(3) WHERE `id` = ?',
        status,
        questionId,
      );
    } else {
      const stored = this.prisma.inMemoryCourseQuestions.find(
        (candidate) => candidate.id === questionId,
      );
      if (stored) Object.assign(stored, { status, updatedAt: new Date() });
    }
    return (await this.readQuestions()).find(
      (candidate) => candidate.id === questionId,
    );
  }

  async listAnnouncementsForCourse(actor: Actor, courseId: string) {
    await this.assertCourseAccess(actor, courseId);
    return (await this.readAnnouncements()).filter(
      (announcement) =>
        announcement.targetCourseIds.length === 0 ||
        announcement.targetCourseIds.includes(courseId),
    );
  }

  async listAnnouncementsForAdmin() {
    return this.readAnnouncements();
  }

  async createAnnouncement(
    adminId: string,
    dto: {
      title?: string;
      body?: string;
      targetCourseIds?: string[];
      sendEmail?: boolean;
    },
  ) {
    const title = this.requiredText(dto.title, 'Announcement title', 4, 240);
    const body = this.requiredText(
      dto.body,
      'Announcement message',
      10,
      10_000,
    );
    const targetCourseIds = [
      ...new Set(
        (Array.isArray(dto.targetCourseIds) ? dto.targetCourseIds : [])
          .map((id) => String(id || '').trim())
          .filter(Boolean),
      ),
    ];
    for (const courseId of targetCourseIds) await this.assertCourse(courseId);
    const recipients = await this.getRecipients(targetCourseIds);
    const sendEmail = Boolean(dto.sendEmail);
    const id = randomUUID();
    let emailStatus = sendEmail ? 'QUEUED' : 'NOT_REQUESTED';
    const record = {
      id,
      createdById: adminId,
      title,
      body,
      targetCourseIds,
      sendEmail,
      emailStatus,
      recipientCount: recipients.length,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (this.prisma.isDbConnected) {
      await this.prisma.$executeRawUnsafe(
        'INSERT INTO `CourseAnnouncement` (`id`,`createdById`,`title`,`body`,`targetCourseIds`,`sendEmail`,`emailStatus`,`recipientCount`,`createdAt`,`updatedAt`) VALUES (?,?,?,?,?,?,?, ?,NOW(3),NOW(3))',
        id,
        adminId,
        title,
        body,
        JSON.stringify(targetCourseIds),
        sendEmail,
        emailStatus,
        recipients.length,
      );
    } else {
      this.prisma.inMemoryCourseAnnouncements.unshift(record);
    }

    if (sendEmail) {
      emailStatus = await this.sendAnnouncementEmail(
        id,
        title,
        body,
        recipients,
      );
      await this.setAnnouncementEmailStatus(id, emailStatus);
    }
    return (await this.readAnnouncements()).find(
      (announcement) => announcement.id === id,
    );
  }

  async deleteAnnouncement(id: string) {
    const exists = (await this.readAnnouncements()).some(
      (announcement) => announcement.id === id,
    );
    if (!exists) throw new NotFoundException('Announcement not found.');
    if (this.prisma.isDbConnected) {
      await this.prisma.$executeRawUnsafe(
        'DELETE FROM `CourseAnnouncement` WHERE `id` = ?',
        id,
      );
    } else {
      this.prisma.inMemoryCourseAnnouncements =
        this.prisma.inMemoryCourseAnnouncements.filter(
          (announcement) => announcement.id !== id,
        );
    }
    return { success: true };
  }

  getEmailConfiguration() {
    const apiKey = String(this.config.get('RESEND_API_KEY') || '').trim();
    const from = String(this.config.get('MAIL_FROM') || '').trim();
    const replyTo = String(this.config.get('MAIL_REPLY_TO') || '').trim();
    const domainMatch = from.match(/@([^>\s]+)>?$/);
    return {
      provider: 'Resend',
      configured: Boolean(apiKey && from),
      from: from || null,
      replyTo: replyTo || null,
      sendingDomain: domainMatch?.[1] || null,
      requirements: [
        'Verify the sending domain in Resend.',
        'Publish SPF, DKIM, and DMARC records in DNS.',
        'Use a monitored reply-to address and never buy email lists.',
      ],
    };
  }

  private async readQuestions(): Promise<any[]> {
    if (this.prisma.isDbConnected) {
      const questions = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT q.*, u.name AS userName, u.avatarUrl AS userAvatar,
          c.title AS courseTitle, l.title AS lessonTitle
        FROM \`CourseQuestion\` q
        LEFT JOIN \`User\` u ON u.id = q.userId
        LEFT JOIN \`Course\` c ON c.id = q.courseId
        LEFT JOIN \`Lesson\` l ON l.id = q.lessonId
        ORDER BY q.createdAt DESC`,
      );
      const replies = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT r.*, u.name AS userName, u.avatarUrl AS userAvatar
        FROM \`CourseReply\` r
        LEFT JOIN \`User\` u ON u.id = r.userId
        ORDER BY r.createdAt ASC`,
      );
      return questions.map((question) =>
        this.toQuestion(
          question,
          replies.filter((reply) => reply.questionId === question.id),
        ),
      );
    }

    return this.prisma.inMemoryCourseQuestions.map((question) =>
      this.toQuestion(
        question,
        this.prisma.inMemoryCourseReplies.filter(
          (reply) => reply.questionId === question.id,
        ),
      ),
    );
  }

  private toQuestion(question: any, replies: any[]) {
    const user = this.findMemoryUser(question.userId);
    const course = this.prisma.inMemoryCourses.find(
      (candidate) => candidate.id === question.courseId,
    );
    const lesson = this.findMemoryLesson(question.lessonId);
    return {
      id: question.id,
      courseId: question.courseId,
      lessonId: question.lessonId || null,
      title: question.title,
      body: question.body,
      status: question.status || 'OPEN',
      user: {
        id: question.userId,
        name: question.userName || user?.name || 'Student',
        avatarUrl: question.userAvatar || user?.avatarUrl || null,
      },
      courseTitle: question.courseTitle || course?.title || 'Course',
      lessonTitle: question.lessonTitle || lesson?.title || null,
      replies: replies.map((reply) => {
        const replyUser = this.findMemoryUser(reply.userId);
        return {
          id: reply.id,
          body: reply.body,
          isInstructor: Boolean(reply.isInstructor),
          user: {
            id: reply.userId,
            name:
              reply.userName ||
              replyUser?.name ||
              (reply.isInstructor ? 'Instructor' : 'Student'),
            avatarUrl: reply.userAvatar || replyUser?.avatarUrl || null,
          },
          createdAt: reply.createdAt,
          updatedAt: reply.updatedAt,
        };
      }),
      createdAt: question.createdAt,
      updatedAt: question.updatedAt,
    };
  }

  private async readAnnouncements(): Promise<any[]> {
    let rows: any[];
    if (this.prisma.isDbConnected) {
      rows = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT a.*, u.name AS authorName
        FROM \`CourseAnnouncement\` a
        LEFT JOIN \`User\` u ON u.id = a.createdById
        ORDER BY a.createdAt DESC`,
      );
    } else {
      rows = [...this.prisma.inMemoryCourseAnnouncements].sort(
        (a, b) => this.time(b.createdAt) - this.time(a.createdAt),
      );
    }
    const courses = await this.readCourseLabels();
    return rows.map((row) => {
      const ids = this.parseIds(row.targetCourseIds);
      return {
        id: row.id,
        title: row.title,
        body: row.body,
        targetCourseIds: ids,
        targetCourses: ids.map((id) => courses.get(id) || id),
        sendEmail: Boolean(row.sendEmail),
        emailStatus: row.emailStatus || 'NOT_REQUESTED',
        recipientCount: Number(row.recipientCount || 0),
        authorName:
          row.authorName ||
          this.findMemoryUser(row.createdById)?.name ||
          'Technyks Instructor',
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
    });
  }

  private async assertCourseAccess(actor: Actor, courseId: string) {
    await this.assertCourse(courseId);
    if (actor.role === 'ADMIN') return;
    if (this.prisma.isDbConnected) {
      const [enrollment, subscription] = await Promise.all([
        this.prisma.enrollment.findUnique({
          where: { userId_courseId: { userId: actor.id, courseId } },
          select: { id: true },
        }),
        this.prisma.subscription.findFirst({
          where: { userId: actor.id, status: 'ACTIVE' },
          include: { plan: { include: { courseAccess: true } } },
        }),
      ]);
      if (enrollment || this.membershipAllows(subscription, courseId)) return;
    } else {
      const enrollment = this.prisma.inMemoryEnrollments.some(
        (item) => item.userId === actor.id && item.courseId === courseId,
      );
      const subscription = this.prisma.inMemorySubscriptions.find(
        (item) => item.userId === actor.id && item.status === 'ACTIVE',
      );
      if (enrollment || this.membershipAllows(subscription, courseId)) return;
    }
    throw new ForbiddenException(
      'Enroll in this course to use its communication area.',
    );
  }

  private membershipAllows(subscription: any, courseId: string) {
    if (!subscription || subscription.status !== 'ACTIVE') return false;
    const plan =
      subscription.plan ||
      this.prisma.inMemoryMembershipPlans.find(
        (candidate) => candidate.id === subscription.planId,
      );
    if (!plan || plan.accessAllCourses !== false) return true;
    return (plan.courseAccess || []).some(
      (access: any) => (access.courseId || access) === courseId,
    );
  }

  private async assertCourse(courseId: string) {
    const course = this.prisma.isDbConnected
      ? await this.prisma.course.findUnique({
          where: { id: courseId },
          select: { id: true },
        })
      : this.prisma.inMemoryCourses.find(
          (candidate) => candidate.id === courseId,
        );
    if (!course) throw new NotFoundException('Course not found.');
  }

  private async assertLessonBelongsToCourse(
    lessonId: string,
    courseId: string,
  ) {
    if (this.prisma.isDbConnected) {
      const lesson = await this.prisma.lesson.findFirst({
        where: { id: lessonId, module: { courseId } },
        select: { id: true },
      });
      if (lesson) return;
    } else {
      const course = this.prisma.inMemoryCourses.find(
        (candidate) => candidate.id === courseId,
      );
      if (
        (course?.modules || []).some((module: any) =>
          (module.lessons || []).some((lesson: any) => lesson.id === lessonId),
        )
      )
        return;
    }
    throw new BadRequestException(
      'The selected lecture does not belong to this course.',
    );
  }

  private async getRecipients(courseIds: string[]) {
    if (this.prisma.isDbConnected) {
      const users = await this.prisma.user.findMany({
        where: {
          role: 'STUDENT',
          enrollments: {
            some: courseIds.length ? { courseId: { in: courseIds } } : {},
          },
        },
        select: { id: true, name: true, email: true },
      });
      return users;
    }
    const allowed = new Set(
      this.prisma.inMemoryEnrollments
        .filter(
          (enrollment) =>
            !courseIds.length || courseIds.includes(enrollment.courseId),
        )
        .map((enrollment) => enrollment.userId),
    );
    return this.prisma.inMemoryUsers
      .filter((user) => user.role === 'STUDENT' && allowed.has(user.id))
      .map((user) => ({ id: user.id, name: user.name, email: user.email }));
  }

  private async sendAnnouncementEmail(
    announcementId: string,
    title: string,
    body: string,
    recipients: { email: string; name?: string }[],
  ) {
    if (!recipients.length) return 'NO_RECIPIENTS';
    const apiKey = String(this.config.get('RESEND_API_KEY') || '').trim();
    const from = String(this.config.get('MAIL_FROM') || '').trim();
    const replyTo = String(this.config.get('MAIL_REPLY_TO') || '').trim();
    const appUrl = String(
      this.config.get('WEB_APP_URL') || 'https://courses.codingtechnyks.com',
    ).replace(/\/$/, '');
    if (!apiKey || !from) return 'NOT_CONFIGURED';
    try {
      for (let index = 0; index < recipients.length; index += 50) {
        const batch = recipients.slice(index, index + 50).map((recipient) => {
          const greeting = recipient.name
            ? `Hello ${this.escapeHtml(recipient.name)},`
            : 'Hello,';
          const messageHtml = this.escapeHtml(body).replace(/\n/g, '<br>');
          return {
            from,
            to: [recipient.email],
            ...(replyTo ? { reply_to: replyTo } : {}),
            subject: title,
            text: `${recipient.name ? `Hello ${recipient.name},\n\n` : ''}${body}\n\nOpen your learning dashboard: ${appUrl}/dashboard\n\nTechnyks Academy`,
            html: `<div style="margin:0;background:#f4f7fb;padding:32px 16px;font-family:Arial,sans-serif;color:#172033"><div style="max-width:620px;margin:auto;background:#ffffff;border:1px solid #dce5f2;border-radius:14px;overflow:hidden"><div style="background:#1d4ed8;color:#ffffff;padding:18px 24px;font-weight:700">Technyks Academy</div><div style="padding:28px 24px"><p style="margin-top:0">${greeting}</p><h1 style="font-size:24px;line-height:1.25;margin:12px 0 18px">${this.escapeHtml(title)}</h1><p style="font-size:16px;line-height:1.7">${messageHtml}</p><p style="margin:28px 0"><a href="${appUrl}/dashboard" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:13px 20px;border-radius:8px;font-weight:700">Open learning dashboard</a></p><p style="font-size:12px;line-height:1.5;color:#64748b">You received this educational update because this email is enrolled in a Technyks Academy course. Reply to this email if you need help.</p></div></div></div>`,
          };
        });
        const response = await fetch('https://api.resend.com/emails/batch', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'Idempotency-Key': `announcement-${announcementId}-${index}`,
          },
          body: JSON.stringify(batch),
        });
        if (!response.ok)
          throw new Error(`Mail provider returned ${response.status}`);
      }
      return 'SENT';
    } catch {
      return 'FAILED';
    }
  }

  private async setAnnouncementEmailStatus(id: string, emailStatus: string) {
    if (this.prisma.isDbConnected) {
      await this.prisma.$executeRawUnsafe(
        'UPDATE `CourseAnnouncement` SET `emailStatus` = ?, `updatedAt` = NOW(3) WHERE `id` = ?',
        emailStatus,
        id,
      );
    } else {
      const announcement = this.prisma.inMemoryCourseAnnouncements.find(
        (candidate) => candidate.id === id,
      );
      if (announcement)
        Object.assign(announcement, { emailStatus, updatedAt: new Date() });
    }
  }

  private async readCourseLabels() {
    const courses = this.prisma.isDbConnected
      ? await this.prisma.course.findMany({ select: { id: true, title: true } })
      : this.prisma.inMemoryCourses;
    return new Map(courses.map((course) => [course.id, course.title]));
  }

  private findMemoryUser(userId: string) {
    return this.prisma.inMemoryUsers.find(
      (candidate) => candidate.id === userId,
    );
  }

  private findMemoryLesson(lessonId?: string | null) {
    if (!lessonId) return null;
    for (const course of this.prisma.inMemoryCourses) {
      for (const module of course.modules || []) {
        const lesson = (module.lessons || []).find(
          (candidate: any) => candidate.id === lessonId,
        );
        if (lesson) return lesson;
      }
    }
    return null;
  }

  private parseIds(value: unknown): string[] {
    if (Array.isArray(value)) return value.map(String);
    try {
      const parsed = JSON.parse(String(value || '[]'));
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }

  private requiredText(
    value: unknown,
    label: string,
    min: number,
    max: number,
  ) {
    const text = String(value || '').trim();
    if (text.length < min || text.length > max) {
      throw new BadRequestException(
        `${label} must be between ${min} and ${max.toLocaleString()} characters.`,
      );
    }
    return text;
  }

  private escapeHtml(value: string) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private time(value: string | Date) {
    return new Date(value || 0).getTime();
  }
}

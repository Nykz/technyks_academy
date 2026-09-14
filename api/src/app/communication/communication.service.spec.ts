import { describe, expect, it } from 'vitest';
import { CommunicationService } from './communication.service';

function createService(configValues: Record<string, string> = {}) {
  const prisma: any = {
    isDbConnected: false,
    inMemoryUsers: [
      {
        id: 'student-1',
        name: 'Asha Learner',
        email: 'asha@example.com',
        role: 'STUDENT',
      },
      {
        id: 'admin-1',
        name: 'Technyks Instructor',
        email: 'admin@example.com',
        role: 'ADMIN',
      },
    ],
    inMemoryCourses: [
      {
        id: 'course-1',
        title: 'TypeScript Mastery',
        modules: [
          { id: 'module-1', lessons: [{ id: 'lesson-1', title: 'Generics' }] },
        ],
      },
    ],
    inMemoryEnrollments: [
      { id: 'enrollment-1', userId: 'student-1', courseId: 'course-1' },
    ],
    inMemorySubscriptions: [],
    inMemoryMembershipPlans: [],
    inMemoryCourseQuestions: [],
    inMemoryCourseReplies: [],
    inMemoryCourseAnnouncements: [],
  };
  const config: any = { get: (key: string) => configValues[key] };
  return { service: new CommunicationService(prisma, config), prisma };
}

describe('CommunicationService', () => {
  it('creates lecture questions and marks instructor answers', async () => {
    const { service } = createService();
    const student = { id: 'student-1', role: 'STUDENT', name: 'Asha Learner' };
    const admin = { id: 'admin-1', role: 'ADMIN', name: 'Technyks Instructor' };

    const question = await service.createQuestion(student, 'course-1', {
      lessonId: 'lesson-1',
      title: 'How do generic constraints work?',
      body: 'Could you explain when to use extends in a generic type?',
    });
    expect(question.lessonTitle).toBe('Generics');
    expect(question.status).toBe('OPEN');

    const answered = await service.createReply(admin, question.id, {
      body: 'Use extends when a generic must provide a known shape.',
    });
    expect(answered.status).toBe('ANSWERED');
    expect(answered.replies[0]).toMatchObject({
      isInstructor: true,
      body: 'Use extends when a generic must provide a known shape.',
    });
  });

  it('targets announcements to enrolled course students', async () => {
    const { service } = createService();
    const admin = { id: 'admin-1', role: 'ADMIN', name: 'Technyks Instructor' };
    const student = { id: 'student-1', role: 'STUDENT', name: 'Asha Learner' };

    const announcement = await service.createAnnouncement(admin.id, {
      title: 'New generics workshop',
      body: 'A new live generics workshop is available this Saturday.',
      targetCourseIds: ['course-1'],
      sendEmail: true,
    });
    expect(announcement).toMatchObject({
      recipientCount: 1,
      emailStatus: 'NOT_CONFIGURED',
      targetCourseIds: ['course-1'],
    });

    const visible = await service.listAnnouncementsForCourse(
      student,
      'course-1',
    );
    expect(visible).toHaveLength(1);
    expect(visible[0].title).toBe('New generics workshop');
  });

  it('reports the verified-domain email setup needed before launch', () => {
    const { service } = createService({
      RESEND_API_KEY: 're_test_key',
      MAIL_FROM: 'Technyks Academy <updates@codingtechnyks.com>',
      MAIL_REPLY_TO: 'support@codingtechnyks.com',
    });

    expect(service.getEmailConfiguration()).toMatchObject({
      provider: 'Resend',
      configured: true,
      sendingDomain: 'codingtechnyks.com',
      replyTo: 'support@codingtechnyks.com',
    });
  });
});

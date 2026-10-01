import { describe, expect, it, vi } from 'vitest';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CertificatesService, createCertificateNumber } from './certificates.service';
import { formatCourseLength, renderCertificatePdf } from './certificate-pdf';

const configOf = (values: Record<string, string> = {}) =>
  ({ get: (key: string) => values[key] }) as any;

function setup(enrollment: any) {
  const record = {
    certificateNumber: 'TA-ABCD-EFGH-JKMN',
    issuedAt: new Date('2026-10-01T10:00:00Z'),
    user: { name: 'Asha Verma', email: 'asha@example.com' },
    course: {
      title: 'Complete TypeScript Course',
      slug: 'complete-typescript',
      modules: [{ lessons: [{ duration: 1800 }, { duration: 1800 }] }],
    },
  };
  const prisma: any = {
    isDbConnected: true,
    enrollment: { findUnique: vi.fn().mockResolvedValue(enrollment) },
    certificate: {
      findUnique: vi.fn(async ({ where }: any) =>
        where.certificateNumber ? { ...record, certificateNumber: where.certificateNumber } : null,
      ),
      create: vi.fn(async ({ data }: any) => ({ ...data, issuedAt: new Date() })),
    },
  };
  const mail: any = {
    webAppUrl: 'https://technyks.com',
    isConfigured: () => true,
    send: vi.fn().mockResolvedValue(true),
  };
  return { prisma, mail, service: new CertificatesService(prisma, mail, configOf()) };
}

describe('CertificatesService', () => {
  it('creates unguessable IDs like TA-XXXX-XXXX-XXXX', () => {
    const id = createCertificateNumber();
    expect(id).toMatch(/^TA-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/);
    expect(createCertificateNumber()).not.toBe(id);
  });

  it('refuses a certificate until every lesson is complete', async () => {
    const { service, prisma } = setup({ progressPercent: 60 });
    await expect(service.issueIfComplete('u1', 'c1')).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.certificate.create).not.toHaveBeenCalled();
  });

  it('refuses students who are not enrolled', async () => {
    const { service } = setup(null);
    await expect(service.issueIfComplete('u1', 'c1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('issues once the course is finished and emails the PDF', async () => {
    const { service, prisma, mail } = setup({ progressPercent: 100 });
    const certificate = await service.issueIfComplete('u1', 'c1');

    expect(prisma.certificate.create).toHaveBeenCalledTimes(1);
    expect(certificate.verifyUrl).toBe(`https://technyks.com/certificate/${certificate.certificateNumber}`);
    expect(certificate.pdfUrl).toBe(
      `https://api.technyks.com/api/certificates/download/${certificate.certificateNumber}.pdf`,
    );

    await vi.waitFor(() => expect(mail.send).toHaveBeenCalled());
    const email = mail.send.mock.calls[0][0];
    expect(email.to).toEqual(['asha@example.com']);
    expect(email.subject).toBe('Your certificate for Complete TypeScript Course');
    expect(email.attachments[0].contentType).toBe('application/pdf');
    expect(email.attachments[0].content.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('returns the existing certificate instead of issuing a second one', async () => {
    const { service, prisma } = setup({ progressPercent: 100 });
    prisma.certificate.findUnique.mockResolvedValueOnce({ certificateNumber: 'TA-AAAA-BBBB-CCCC' });
    const certificate = await service.issueIfComplete('u1', 'c1');
    expect(certificate.certificateNumber).toBe('TA-AAAA-BBBB-CCCC');
    expect(prisma.certificate.create).not.toHaveBeenCalled();
  });

  it('shows public details for verification, without the email address', async () => {
    const { service } = setup({ progressPercent: 100 });
    const details = await service.verify('ta-abcd-efgh-jkmn');
    expect(details).toMatchObject({
      certificateNumber: 'TA-ABCD-EFGH-JKMN',
      studentName: 'Asha Verma',
      courseTitle: 'Complete TypeScript Course',
      lessonCount: 2,
      courseLength: '1 hour',
    });
    expect(JSON.stringify(details)).not.toContain('asha@example.com');
  });

  it('admin test: completes every lesson, issues and emails the certificate', async () => {
    const { service, prisma, mail } = setup({ progressPercent: 100 });
    prisma.course = {
      findUnique: vi.fn().mockResolvedValue({ id: 'c1', modules: [{ lessons: [{ id: 'l1' }, { id: 'l2' }] }] }),
    };
    prisma.enrollment.upsert = vi.fn().mockResolvedValue({});

    const result = await service.adminTestComplete('admin1', 'c1');

    expect(prisma.enrollment.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { completedLessonIds: ['l1', 'l2'], progressPercent: 100, lastWatchedLessonId: 'l2' },
      }),
    );
    expect(result.resent).toBe(false);
    expect(result.email).toEqual({ sent: true, to: 'asha@example.com' });
    expect(mail.send).toHaveBeenCalledTimes(1);
  });

  it('admin test: resends the email when the certificate already exists', async () => {
    const { service, prisma, mail } = setup({ progressPercent: 100 });
    prisma.course = { findUnique: vi.fn().mockResolvedValue({ id: 'c1', modules: [{ lessons: [{ id: 'l1' }] }] }) };
    prisma.enrollment.upsert = vi.fn().mockResolvedValue({});
    prisma.certificate.findUnique.mockImplementation(async ({ where }: any) =>
      where.certificateNumber
        ? { certificateNumber: where.certificateNumber, issuedAt: new Date(), user: { name: 'Admin', email: 'admin@example.com' }, course: { title: 'T', slug: 't', modules: [] } }
        : { certificateNumber: 'TA-AAAA-BBBB-CCCC' },
    );

    const result = await service.adminTestComplete('admin1', 'c1');

    expect(prisma.certificate.create).not.toHaveBeenCalled();
    expect(result.resent).toBe(true);
    expect(result.email.to).toBe('admin@example.com');
    expect(mail.send).toHaveBeenCalledTimes(1);
  });

  it('rejects malformed IDs', async () => {
    const { service } = setup({ progressPercent: 100 });
    await expect(service.verify('../../etc')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('certificate PDF', () => {
  it('renders a one-page PDF even for long names and titles', async () => {
    const pdf = await renderCertificatePdf({
      certificateNumber: 'TA-ABCD-EFGH-JKMN',
      studentName: 'Venkata Subramanian Raghunathan Krishnamurthy',
      courseTitle: 'Complete Full Stack Web Development with Angular, NestJS, Prisma and MySQL – From Zero to Production',
      issuedAt: new Date('2026-10-01T10:00:00Z'),
      lessonCount: 120,
      durationSeconds: 45000,
      verifyUrl: 'https://technyks.com/certificate/TA-ABCD-EFGH-JKMN',
      signerName: 'Technyks Academy',
      signerTitle: 'Authorized Signatory',
    });
    const text = pdf.toString('latin1');
    expect(text.startsWith('%PDF-')).toBe(true);
    expect(text.match(/\/Type \/Page\b/g)).toHaveLength(1);
  });

  it('describes course length in minutes or hours', () => {
    expect(formatCourseLength(0)).toBe('');
    expect(formatCourseLength(45 * 60)).toBe('45 minutes');
    expect(formatCourseLength(12.5 * 3600)).toBe('12.5 hours');
  });
});

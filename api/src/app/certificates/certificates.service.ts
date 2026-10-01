import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MailService, emailLayout, escapeHtml } from '../mail/mail.service';
import { renderCertificatePdf, formatCourseLength, formatIssueDate } from './certificate-pdf';

/** Unambiguous characters (no 0/O, 1/I/L). */
const ID_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

/** e.g. TA-7K2M-9QXD-4HPW; random, so certificates cannot be guessed. */
export function createCertificateNumber() {
  const bytes = randomBytes(12);
  const chars = [...bytes].map((byte) => ID_ALPHABET[byte % ID_ALPHABET.length]);
  return `TA-${chars.slice(0, 4).join('')}-${chars.slice(4, 8).join('')}-${chars.slice(8, 12).join('')}`;
}

/** Certificate numbers are letters, digits and dashes only. */
export function isCertificateNumber(value: string) {
  return /^[A-Z0-9-]{6,48}$/.test(value);
}

export interface PublicCertificate {
  certificateNumber: string;
  studentName: string;
  courseTitle: string;
  courseSlug: string;
  issuedAt: Date;
  lessonCount: number;
  durationSeconds: number;
  courseLength: string;
  pdfUrl: string;
  downloadUrl: string;
  verifyUrl: string;
}

/**
 * Completion certificates. A certificate is issued once a student finishes
 * every lesson of a course; it is emailed to them (with the PDF attached),
 * listed in their dashboard, and anyone with its ID can verify it at
 * technyks.com/certificate/<ID> (like Udemy and Coursera).
 */
@Injectable()
export class CertificatesService {
  private readonly logger = new Logger(CertificatesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  private get apiPublicUrl() {
    return String(this.config.get('API_PUBLIC_URL') || 'https://api.technyks.com').replace(/\/$/, '');
  }

  private urlsFor(certificateNumber: string) {
    const pdfUrl = `${this.apiPublicUrl}/api/certificates/download/${certificateNumber}.pdf`;
    return {
      pdfUrl,
      downloadUrl: `${pdfUrl}?download=1`,
      verifyUrl: `${this.mail.webAppUrl}/certificate/${certificateNumber}`,
    };
  }

  /** Returns the student's certificate, issuing it if the course is finished. */
  async issueIfComplete(userId: string, courseId: string) {
    const existing = await this.findForUser(userId, courseId);
    if (existing) return this.withUrls(existing);

    const enrollment = this.prisma.isDbConnected
      ? await this.prisma.enrollment.findUnique({
          where: { userId_courseId: { userId, courseId } },
        })
      : this.prisma.inMemoryEnrollments.find(
          (item) => item.userId === userId && item.courseId === courseId,
        );
    if (!enrollment) throw new ForbiddenException('You are not enrolled in this course.');
    if (Number(enrollment.progressPercent || 0) < 100) {
      throw new ForbiddenException('Finish every lesson to receive your certificate.');
    }

    const certificateNumber = createCertificateNumber();
    const pdfPath = `/api/certificates/download/${certificateNumber}.pdf`;
    let certificate: any;
    if (this.prisma.isDbConnected) {
      try {
        certificate = await this.prisma.certificate.create({
          data: { userId, courseId, certificateNumber, pdfUrl: pdfPath },
        });
      } catch (error: any) {
        // Two completions at once: the other request issued it.
        if (error?.code === 'P2002') {
          const raced = await this.findForUser(userId, courseId);
          if (raced) return this.withUrls(raced);
        }
        throw new ServiceUnavailableException('Your certificate could not be saved. Please retry shortly.');
      }
    } else {
      certificate = {
        id: `cert_${Date.now().toString(36)}`,
        userId,
        courseId,
        certificateNumber,
        pdfUrl: pdfPath,
        issuedAt: new Date(),
      };
      this.prisma.inMemoryCertificates.push(certificate);
    }

    // Email in the background so finishing the last lesson stays fast.
    void this.emailCertificate(certificateNumber).catch((error) =>
      this.logger.warn(`Certificate email failed for ${certificateNumber}: ${error?.message || error}`),
    );
    return this.withUrls(certificate);
  }

  /** The signed-in student's certificates, newest first. */
  async listForUser(userId: string): Promise<PublicCertificate[]> {
    const rows = this.prisma.isDbConnected
      ? await this.prisma.certificate.findMany({
          where: { userId },
          include: CERTIFICATE_INCLUDE,
          orderBy: { issuedAt: 'desc' },
        })
      : this.prisma.inMemoryCertificates
          .filter((item) => item.userId === userId)
          .map((item) => this.attachInMemory(item));
    return rows.map((row: any) => this.toPublic(row));
  }

  /** Public details for the verification page. */
  async verify(certificateNumber: string): Promise<PublicCertificate> {
    return this.toPublic(await this.loadByNumber(certificateNumber));
  }

  async pdf(certificateNumber: string): Promise<{ buffer: Buffer; filename: string }> {
    const details = this.toPublic(await this.loadByNumber(certificateNumber));
    const buffer = await renderCertificatePdf({
      ...details,
      issuedAt: new Date(details.issuedAt),
      signerName: String(this.config.get('CERTIFICATE_SIGNER_NAME') || 'Technyks Academy'),
      signerTitle: String(this.config.get('CERTIFICATE_SIGNER_TITLE') || 'Authorized Signatory'),
    });
    const slug = details.courseSlug || 'course';
    return { buffer, filename: `Technyks-Certificate-${slug}-${details.certificateNumber}.pdf` };
  }

  private async emailCertificate(certificateNumber: string) {
    if (!this.mail.isConfigured()) return;
    const record = await this.loadByNumber(certificateNumber);
    const email = record.user?.email;
    if (!email) return;
    const details = this.toPublic(record);
    const { buffer, filename } = await this.pdf(certificateNumber);
    const firstName = String(details.studentName).split(' ')[0] || 'there';
    const subject = `Your certificate for ${details.courseTitle}`;
    const preview = `Congratulations on completing ${details.courseTitle}. Your certificate is attached.`;
    const ok = await this.mail.send({
      to: [email],
      subject,
      text: [
        `Hi ${firstName},`,
        '',
        `Congratulations on completing "${details.courseTitle}"! Your certificate of completion is attached as a PDF.`,
        '',
        `Download it any time: ${details.downloadUrl}`,
        `Share or verify it: ${details.verifyUrl}`,
        `Certificate ID: ${details.certificateNumber}`,
        '',
        'You can also find it in your Technyks dashboard under My certificates.',
        '',
        'Technyks Academy',
      ].join('\n'),
      html: emailLayout(
        'Congratulations, you did it! 🎓',
        `<p>Hi ${escapeHtml(firstName)},</p>
<p>You have completed <strong>${escapeHtml(details.courseTitle)}</strong>. Your certificate of completion is attached to this email as a PDF.</p>
<p style="margin:18px 0;padding:14px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;line-height:1.6">
<strong>Certificate ID:</strong> ${escapeHtml(details.certificateNumber)}<br>
<strong>Completed on:</strong> ${escapeHtml(formatIssueDate(new Date(details.issuedAt)))}<br>
<strong>Verify:</strong> <a href="${escapeHtml(details.verifyUrl)}" style="color:#1d4ed8">${escapeHtml(details.verifyUrl.replace(/^https?:\/\//, ''))}</a></p>
<p>Add it to your LinkedIn profile or résumé. Anyone can confirm it is genuine using the verification link.</p>`,
        { label: 'Download certificate', url: details.downloadUrl },
        'You can also download it any time from your Technyks dashboard under My certificates.',
        preview,
      ),
      attachments: [{ filename, content: buffer, contentType: 'application/pdf' }],
    });
    if (!ok) this.logger.warn(`Certificate email for ${certificateNumber} was not accepted by the mail provider.`);
  }

  private async findForUser(userId: string, courseId: string) {
    if (this.prisma.isDbConnected) {
      return this.prisma.certificate.findUnique({
        where: { userId_courseId: { userId, courseId } },
      });
    }
    return this.prisma.inMemoryCertificates.find(
      (item) => item.userId === userId && item.courseId === courseId,
    );
  }

  private async loadByNumber(raw: string): Promise<any> {
    const certificateNumber = String(raw || '').trim().toUpperCase();
    if (!isCertificateNumber(certificateNumber)) throw new NotFoundException('Certificate not found.');
    const record = this.prisma.isDbConnected
      ? await this.prisma.certificate.findUnique({
          where: { certificateNumber },
          include: CERTIFICATE_INCLUDE,
        })
      : (() => {
          const item = this.prisma.inMemoryCertificates.find(
            (candidate) => candidate.certificateNumber === certificateNumber,
          );
          return item ? this.attachInMemory(item) : null;
        })();
    if (!record) throw new NotFoundException('Certificate not found.');
    return record;
  }

  private attachInMemory(item: any) {
    return {
      ...item,
      user: this.prisma.inMemoryUsers.find((user) => user.id === item.userId) || null,
      course: this.prisma.inMemoryCourses.find((course) => course.id === item.courseId) || null,
    };
  }

  private withUrls(certificate: any) {
    return { ...certificate, ...this.urlsFor(certificate.certificateNumber) };
  }

  private toPublic(record: any): PublicCertificate {
    const lessons = (record.course?.modules || []).flatMap((module: any) => module.lessons || []);
    const durationSeconds = lessons.reduce(
      (total: number, lesson: any) => total + (Number(lesson.duration) || 0),
      0,
    );
    return {
      certificateNumber: record.certificateNumber,
      studentName: String(record.user?.name || '').trim() || 'Technyks Student',
      courseTitle: record.course?.title || 'Technyks Academy course',
      courseSlug: record.course?.slug || '',
      issuedAt: record.issuedAt,
      lessonCount: lessons.length,
      durationSeconds,
      courseLength: formatCourseLength(durationSeconds),
      ...this.urlsFor(record.certificateNumber),
    };
  }
}

const CERTIFICATE_INCLUDE = {
  user: { select: { name: true, email: true } },
  course: {
    select: {
      title: true,
      slug: true,
      modules: { select: { lessons: { select: { duration: true } } } },
    },
  },
} as const;

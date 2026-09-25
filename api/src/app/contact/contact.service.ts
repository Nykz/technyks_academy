import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService, emailLayout, escapeHtml } from '../mail/mail.service';

export interface ContactSubmission {
  name?: string;
  email?: string;
  subject?: string;
  message?: string;
}

@Injectable()
export class ContactService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly mail?: MailService,
  ) {}

  async createMessage(submission: ContactSubmission) {
    const name = String(submission.name || '').trim();
    const email = String(submission.email || '').trim().toLowerCase();
    const subject = String(submission.subject || '').trim();
    const message = String(submission.message || '').trim();

    if (name.length < 2 || name.length > 100) {
      throw new BadRequestException('Name must be between 2 and 100 characters.');
    }
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException('Please provide a valid email address.');
    }
    if (subject.length < 3 || subject.length > 160) {
      throw new BadRequestException('Subject must be between 3 and 160 characters.');
    }
    if (message.length < 10 || message.length > 4_000) {
      throw new BadRequestException('Message must be between 10 and 4,000 characters.');
    }

    const data = { name, email, subject, message };
    if (this.prisma.isDbConnected) {
      try {
        const saved = await this.prisma.contactMessage.create({ data });
        this.notifyTeam(data);
        return {
          success: true,
          message: 'Thanks — your message has been sent to the Technyks Academy team.',
          id: saved.id,
        };
      } catch {
        // The in-memory adapter keeps local development and a transient database outage usable.
      }
    }

    const record = {
      id: `contact_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      ...data,
      status: 'NEW',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.prisma.inMemoryContactMessages.unshift(record);
    this.notifyTeam(data);
    return {
      success: true,
      message: 'Thanks — your message has been sent to the Technyks Academy team.',
      id: record.id,
    };
  }

  /**
   * Emails the message to the team inbox (CONTACT_NOTIFY_EMAIL, else
   * MAIL_REPLY_TO) with Reply-To set to the visitor, so replying from the
   * mailbox answers them directly. Fire-and-forget: the visitor's
   * submission is already saved and never waits on email delivery.
   */
  private notifyTeam(data: { name: string; email: string; subject: string; message: string }) {
    if (!this.mail?.isConfigured() || !this.mail.contactInbox) return;
    void this.mail.send({
      to: [this.mail.contactInbox],
      replyTo: data.email,
      subject: `[Contact] ${data.subject}`,
      text: `New message from the technyks.com contact form

From: ${data.name} <${data.email}>
Subject: ${data.subject}

${data.message}

Reply to this email to answer ${data.name} directly.`,
      html: emailLayout(
        'New contact form message',
        `<p><strong>From:</strong> ${escapeHtml(data.name)} &lt;${escapeHtml(data.email)}&gt;<br><strong>Subject:</strong> ${escapeHtml(data.subject)}</p><p style="white-space:pre-wrap;background:#f4f7fb;border-radius:8px;padding:14px 16px">${escapeHtml(data.message)}</p>`,
        undefined,
        `Reply to this email to answer ${data.name} directly.`,
      ),
    });
  }
}

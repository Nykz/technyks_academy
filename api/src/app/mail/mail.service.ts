import { Global, Injectable, Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

export function escapeHtml(value: string) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/** Branded wrapper shared by every Technyks email. bodyHtml must be escaped. */
export function emailLayout(
  heading: string,
  bodyHtml: string,
  button?: { label: string; url: string },
  footnote?: string,
) {
  const cta = button
    ? `<p style="margin:28px 0"><a href="${escapeHtml(button.url)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:13px 20px;border-radius:8px;font-weight:700">${escapeHtml(button.label)}</a></p>`
    : '';
  const note = footnote
    ? `<p style="font-size:12px;line-height:1.5;color:#64748b">${escapeHtml(footnote)}</p>`
    : '';
  return `<div style="margin:0;background:#f4f7fb;padding:32px 16px;font-family:Arial,sans-serif;color:#172033"><div style="max-width:620px;margin:auto;background:#ffffff;border:1px solid #dce5f2;border-radius:14px;overflow:hidden"><div style="background:#1d4ed8;color:#ffffff;padding:18px 24px;font-weight:700">Technyks Academy</div><div style="padding:28px 24px;font-size:16px;line-height:1.7"><h1 style="font-size:22px;line-height:1.25;margin:0 0 16px">${escapeHtml(heading)}</h1>${bodyHtml}${cta}${note}</div></div></div>`;
}

export interface OutgoingEmail {
  to: string[];
  subject: string;
  text: string;
  html?: string;
  /** Overrides MAIL_REPLY_TO, e.g. the visitor's address on contact messages. */
  replyTo?: string;
}

/**
 * Sends transactional email through Resend (https://resend.com).
 *
 * Required: RESEND_API_KEY and MAIL_FROM, e.g.
 *   MAIL_FROM="Technyks Academy <contact@technyks.com>"
 * Optional: MAIL_REPLY_TO (where student replies go) and
 * CONTACT_NOTIFY_EMAIL (who receives contact-form messages; defaults to
 * MAIL_REPLY_TO, then the MAIL_FROM address).
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly config: ConfigService = new ConfigService()) {}

  get apiKey() {
    return String(this.config.get('RESEND_API_KEY') || '').trim();
  }

  get from() {
    return String(this.config.get('MAIL_FROM') || '').trim();
  }

  get replyTo() {
    return String(this.config.get('MAIL_REPLY_TO') || '').trim();
  }

  get webAppUrl() {
    return String(this.config.get('WEB_APP_URL') || 'https://technyks.com')
      .trim()
      .replace(/\/$/, '');
  }

  /** Address that receives contact-form notifications. */
  get contactInbox() {
    const explicit = String(this.config.get('CONTACT_NOTIFY_EMAIL') || '').trim();
    const fromAddress = this.from.match(/<([^>]+)>/)?.[1] || this.from;
    return explicit || this.replyTo || fromAddress;
  }

  isConfigured() {
    return Boolean(this.apiKey && this.from);
  }

  /**
   * Returns true when Resend accepted the message. Never throws, so a mail
   * outage cannot break the request that triggered it; failures are logged
   * with Resend's reason.
   */
  async send(email: OutgoingEmail): Promise<boolean> {
    const result = await this.sendWithReason(email);
    return result.ok;
  }

  async sendWithReason(
    email: OutgoingEmail,
  ): Promise<{ ok: boolean; reason?: string }> {
    if (!this.isConfigured()) {
      this.logger.warn(
        `Email "${email.subject}" not sent: RESEND_API_KEY or MAIL_FROM is not configured.`,
      );
      return { ok: false, reason: 'RESEND_API_KEY or MAIL_FROM is not configured.' };
    }
    const replyTo = email.replyTo || this.replyTo;
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.from,
          to: email.to,
          subject: email.subject,
          text: email.text,
          ...(email.html ? { html: email.html } : {}),
          ...(replyTo ? { reply_to: replyTo } : {}),
        }),
      });
      if (response.ok) return { ok: true };
      const detail = await response.text().catch(() => '');
      const reason = `Resend returned ${response.status}${detail ? `: ${detail.slice(0, 300)}` : ''}`;
      this.logger.error(`Email "${email.subject}" failed. ${reason}`);
      return { ok: false, reason };
    } catch (error: any) {
      const reason = error?.message || 'network error';
      this.logger.error(`Email "${email.subject}" failed: ${reason}`);
      return { ok: false, reason };
    }
  }
}

@Global()
@Module({
  imports: [ConfigModule],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}

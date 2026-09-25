import { Global, Injectable, Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';

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
 * Sends the site's email through one of two providers, picked from env:
 *
 * 1. SMTP, e.g. the Hostinger mailbox (used when SMTP_HOST, SMTP_USER and
 *    SMTP_PASSWORD are set):
 *      SMTP_HOST=smtp.hostinger.com  SMTP_PORT=465
 *      SMTP_USER=contact@technyks.com  SMTP_PASSWORD=<mailbox password>
 * 2. Resend (used when RESEND_API_KEY is set and SMTP is not).
 *
 * MAIL_FROM is the sender, e.g. "Technyks Academy <contact@technyks.com>";
 * with SMTP it defaults to the mailbox. Optional: MAIL_REPLY_TO (where
 * replies go) and CONTACT_NOTIFY_EMAIL (who receives contact-form messages;
 * defaults to MAIL_REPLY_TO, then the sender address).
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;

  constructor(private readonly config: ConfigService = new ConfigService()) {}

  private env(key: string) {
    return String(this.config.get(key) || '').trim();
  }

  get apiKey() {
    return this.env('RESEND_API_KEY');
  }

  private get smtp() {
    const host = this.env('SMTP_HOST');
    const user = this.env('SMTP_USER');
    const password = this.env('SMTP_PASSWORD');
    if (!host || !user || !password) return null;
    const port = Number(this.env('SMTP_PORT')) || 465;
    const secureSetting = this.env('SMTP_SECURE').toLowerCase();
    const secure = secureSetting ? secureSetting === 'true' : port === 465;
    return { host, port, secure, user, password };
  }

  /** "SMTP", "Resend", or null when nothing is configured. */
  get provider(): 'SMTP' | 'Resend' | null {
    if (this.smtp) return 'SMTP';
    if (this.apiKey) return 'Resend';
    return null;
  }

  get from() {
    const configured = this.env('MAIL_FROM');
    if (configured) return configured;
    const smtpUser = this.smtp?.user;
    return smtpUser ? `Technyks Academy <${smtpUser}>` : '';
  }

  get replyTo() {
    return this.env('MAIL_REPLY_TO');
  }

  get webAppUrl() {
    return (this.env('WEB_APP_URL') || 'https://technyks.com').replace(/\/$/, '');
  }

  /** Address that receives contact-form notifications. */
  get contactInbox() {
    const fromAddress = this.from.match(/<([^>]+)>/)?.[1] || this.from;
    return this.env('CONTACT_NOTIFY_EMAIL') || this.replyTo || fromAddress;
  }

  isConfigured() {
    return Boolean(this.provider && this.from);
  }

  /**
   * Returns true when the provider accepted the message. Never throws, so a
   * mail outage cannot break the request that triggered it; failures are
   * logged with the provider's reason.
   */
  async send(email: OutgoingEmail): Promise<boolean> {
    const result = await this.sendWithReason(email);
    return result.ok;
  }

  async sendWithReason(
    email: OutgoingEmail,
  ): Promise<{ ok: boolean; reason?: string }> {
    if (!this.isConfigured()) {
      const reason =
        'Email is not configured. Set SMTP_HOST, SMTP_USER and SMTP_PASSWORD (Hostinger mailbox) or RESEND_API_KEY and MAIL_FROM.';
      this.logger.warn(`Email "${email.subject}" not sent. ${reason}`);
      return { ok: false, reason };
    }
    const result =
      this.provider === 'SMTP'
        ? await this.sendViaSmtp(email)
        : await this.sendViaResend(email);
    if (!result.ok) {
      this.logger.error(`Email "${email.subject}" failed via ${this.provider}: ${result.reason}`);
    }
    return result;
  }

  private async sendViaSmtp(email: OutgoingEmail) {
    const smtp = this.smtp!;
    this.transporter ??= createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: { user: smtp.user, pass: smtp.password },
      pool: true,
      maxConnections: 2,
    });
    const replyTo = email.replyTo || this.replyTo;
    try {
      await this.transporter.sendMail({
        from: this.from,
        to: email.to,
        subject: email.subject,
        text: email.text,
        ...(email.html ? { html: email.html } : {}),
        ...(replyTo ? { replyTo } : {}),
      });
      return { ok: true };
    } catch (error: any) {
      // Drop the pooled connection so changed credentials take effect.
      this.transporter?.close();
      this.transporter = null;
      const code = error?.responseCode ? ` (${error.responseCode})` : '';
      return { ok: false, reason: `SMTP error${code}: ${error?.response || error?.message || 'unknown error'}` };
    }
  }

  private async sendViaResend(email: OutgoingEmail) {
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
      return { ok: false, reason: `Resend returned ${response.status}${detail ? `: ${detail.slice(0, 300)}` : ''}` };
    } catch (error: any) {
      return { ok: false, reason: error?.message || 'network error' };
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

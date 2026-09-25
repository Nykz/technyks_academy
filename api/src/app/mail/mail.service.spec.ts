import { beforeEach, describe, expect, it, vi } from 'vitest';

const { sendMail, close, createTransport } = vi.hoisted(() => {
  const sendMail = vi.fn();
  const close = vi.fn();
  return { sendMail, close, createTransport: vi.fn(() => ({ sendMail, close })) };
});
vi.mock('nodemailer', () => ({ createTransport }));

import { MailService } from './mail.service';

const configOf = (values: Record<string, string>) =>
  ({ get: (key: string) => values[key] }) as any;

const hostinger = {
  SMTP_HOST: 'smtp.hostinger.com',
  SMTP_PORT: '465',
  SMTP_USER: 'contact@technyks.com',
  SMTP_PASSWORD: 'mailbox-password',
};

describe('MailService', () => {
  beforeEach(() => {
    sendMail.mockReset();
    close.mockReset();
    createTransport.mockClear();
  });

  it('is not configured without SMTP or Resend settings', async () => {
    const mail = new MailService(configOf({}));
    expect(mail.provider).toBeNull();
    const result = await mail.sendWithReason({ to: ['a@example.com'], subject: 'Hi', text: 'Hi' });
    expect(result.ok).toBe(false);
    expect(createTransport).not.toHaveBeenCalled();
  });

  it('prefers the Hostinger mailbox and sends from it over SSL', async () => {
    sendMail.mockResolvedValue({ messageId: '1' });
    const mail = new MailService(
      configOf({ ...hostinger, RESEND_API_KEY: 're_x', MAIL_REPLY_TO: 'contact@technyks.com' }),
    );

    expect(mail.provider).toBe('SMTP');
    expect(mail.from).toBe('Technyks Academy <contact@technyks.com>');
    const ok = await mail.send({
      to: ['student@example.com'],
      subject: 'Reset your password',
      text: 'link',
      replyTo: 'visitor@example.com',
    });

    expect(ok).toBe(true);
    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'smtp.hostinger.com',
        port: 465,
        secure: true,
        auth: { user: 'contact@technyks.com', pass: 'mailbox-password' },
      }),
    );
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'Technyks Academy <contact@technyks.com>',
        to: ['student@example.com'],
        replyTo: 'visitor@example.com',
      }),
    );
  });

  it('reports the SMTP server reason and resets the connection on failure', async () => {
    sendMail.mockRejectedValue(
      Object.assign(new Error('Invalid login'), { responseCode: 535, response: '535 5.7.8 Authentication failed' }),
    );
    const mail = new MailService(configOf(hostinger));

    const result = await mail.sendWithReason({ to: ['a@example.com'], subject: 'Hi', text: 'Hi' });

    expect(result.ok).toBe(false);
    expect(result.reason).toContain('535');
    expect(result.reason).toContain('Authentication failed');
    expect(close).toHaveBeenCalled();
  });

  it('uses STARTTLS when port 587 is configured', async () => {
    sendMail.mockResolvedValue({});
    await new MailService(configOf({ ...hostinger, SMTP_PORT: '587' })).send({
      to: ['a@example.com'],
      subject: 'Hi',
      text: 'Hi',
    });
    expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({ port: 587, secure: false }));
  });

  it('delivers contact messages to CONTACT_NOTIFY_EMAIL, then MAIL_REPLY_TO, then the sender', () => {
    expect(new MailService(configOf({ ...hostinger, CONTACT_NOTIFY_EMAIL: 'team@technyks.com' })).contactInbox).toBe('team@technyks.com');
    expect(new MailService(configOf({ ...hostinger, MAIL_REPLY_TO: 'help@technyks.com' })).contactInbox).toBe('help@technyks.com');
    expect(new MailService(configOf(hostinger)).contactInbox).toBe('contact@technyks.com');
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ContactService } from './contact.service';

describe('ContactService', () => {
  let service: ContactService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      isDbConnected: false,
      inMemoryContactMessages: [],
    };
    service = new ContactService(prisma);
  });

  it('stores a valid support message in the local adapter', async () => {
    const result = await service.createMessage({
      name: 'Asha Developer',
      email: 'asha@example.com',
      subject: 'Question about JavaScript course',
      message: 'Please tell me how to access the next lesson.',
    });

    expect(result.success).toBe(true);
    expect(prisma.inMemoryContactMessages).toHaveLength(1);
    expect(prisma.inMemoryContactMessages[0].email).toBe('asha@example.com');
  });

  it('rejects incomplete messages before persistence', async () => {
    await expect(
      service.createMessage({
        name: 'A',
        email: 'not-an-email',
        subject: 'Hi',
        message: 'Short',
      }),
    ).rejects.toThrow('Name must be between 2 and 100 characters.');
    expect(prisma.inMemoryContactMessages).toHaveLength(0);
  });
});

describe('ContactService - team notification', () => {
  const submission = {
    name: 'Asha <Developer>',
    email: 'asha@example.com',
    subject: 'Question about JavaScript course',
    message: 'Please tell me how to access the next lesson.',
  };

  it('emails the team inbox with Reply-To set to the visitor', async () => {
    const send = vi.fn().mockResolvedValue(true);
    const mail = { isConfigured: () => true, contactInbox: 'contact@technyks.com', send } as any;
    const service = new ContactService({ isDbConnected: false, inMemoryContactMessages: [] } as any, mail);

    await service.createMessage(submission);

    expect(send).toHaveBeenCalledTimes(1);
    const email = send.mock.calls[0][0];
    expect(email.to).toEqual(['contact@technyks.com']);
    expect(email.replyTo).toBe('asha@example.com');
    expect(email.subject).toBe('[Contact] Question about JavaScript course');
    expect(email.html).toContain('Asha &lt;Developer&gt;');
    expect(email.html).not.toContain('<Developer>');
  });

  it('still saves the message when email is not configured', async () => {
    const send = vi.fn();
    const prisma = { isDbConnected: false, inMemoryContactMessages: [] } as any;
    const service = new ContactService(prisma, { isConfigured: () => false, send } as any);

    const result = await service.createMessage(submission);

    expect(result.success).toBe(true);
    expect(prisma.inMemoryContactMessages).toHaveLength(1);
    expect(send).not.toHaveBeenCalled();
  });
});

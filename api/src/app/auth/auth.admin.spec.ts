import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service';

describe('AuthService administrator provisioning', () => {
  afterEach(() => {
    delete process.env.ADMIN_EMAIL;
    delete process.env.ADMIN_PASSWORD;
  });

  it('promotes an existing account configured as the administrator', async () => {
    process.env.ADMIN_EMAIL = 'owner@example.com';
    process.env.ADMIN_PASSWORD = 'a-secure-bootstrap-password';
    const existing = {
      id: 'user_owner',
      email: 'owner@example.com',
      passwordHash: 'existing-password-hash',
      role: 'STUDENT',
    };
    const prisma: any = {
      isDbConnected: true,
      inMemoryUsers: [],
      user: {
        findUnique: vi.fn().mockResolvedValue(existing),
        update: vi.fn().mockResolvedValue({ ...existing, role: 'ADMIN' }),
        create: vi.fn(),
      },
    };
    const service = new AuthService(prisma, { sign: vi.fn() } as any);

    await service.seedDefaultAdmin();

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user_owner' },
      data: { role: 'ADMIN' },
    });
    expect(prisma.user.create).not.toHaveBeenCalled();
  });
});

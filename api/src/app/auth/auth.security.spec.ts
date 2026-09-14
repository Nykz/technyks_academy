import { describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service';

describe('AuthService security boundaries', () => {
  it('does not expose password reset tokens in the API response', async () => {
    const user = {
      id: 'user_1',
      email: 'learner@example.com',
      name: 'Learner',
      role: 'STUDENT',
    };
    const prisma: any = {
      isDbConnected: false,
      inMemoryUsers: [user],
    };
    const jwt: any = {
      sign: vi.fn().mockReturnValue('private-reset-token'),
    };
    const config: any = { get: vi.fn().mockReturnValue('') };
    const service = new AuthService(prisma, jwt, config);

    const result = await service.forgotPassword(user.email);

    expect(result).toEqual({
      message:
        'If an account exists with this email, a reset link has been dispatched.',
    });
    expect(result).not.toHaveProperty('resetToken');
  });

  it('never authenticates an in-memory account while the database is active', async () => {
    const prisma: any = {
      isDbConnected: true,
      user: { findUnique: vi.fn().mockResolvedValue(null) },
      inMemoryUsers: [
        {
          id: 'local_admin',
          email: 'admin@example.com',
          passwordHash: 'hash',
          role: 'ADMIN',
        },
      ],
    };
    const service = new AuthService(prisma, { sign: vi.fn() } as any);

    await expect(
      service.login({ email: 'admin@example.com', password: 'password' }),
    ).rejects.toThrow('Invalid email or password.');
  });
});

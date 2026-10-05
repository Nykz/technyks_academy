import '@angular/compiler';
import { describe, expect, it, vi } from 'vitest';
import { Injector, runInInjectionContext } from '@angular/core';
import { HttpErrorResponse, HttpRequest } from '@angular/common/http';
import { firstValueFrom, of, throwError } from 'rxjs';
import { authInterceptor } from './auth.interceptor';
import { AuthService, isExpiredToken } from '../services/auth.service';

/** A JWT with the given expiry (signature irrelevant for these checks). */
const tokenExpiringAt = (exp: number) =>
  `x.${btoa(JSON.stringify({ sub: 'u1', exp })).replace(/=+$/, '')}.sig`;

function run(url: string, error: { status: number; message: string } | null, token: string | null = 'valid-token') {
  const auth = { getToken: () => token, expireSession: vi.fn() };
  const injector = Injector.create({ providers: [{ provide: AuthService, useValue: auth }] });
  const seen: HttpRequest<unknown>[] = [];
  const next = (req: HttpRequest<unknown>) => {
    seen.push(req);
    return error ? throwError(() => new HttpErrorResponse({ status: error.status, error: { message: error.message } })) : of({} as any);
  };
  const result = runInInjectionContext(injector, () => authInterceptor(new HttpRequest('GET', url), next as any));
  return { auth, seen, result };
}

describe('isExpiredToken', () => {
  const now = 1_800_000_000;
  it('detects expired and valid sessions', () => {
    expect(isExpiredToken(tokenExpiringAt(now - 1), now)).toBe(true);
    expect(isExpiredToken(tokenExpiringAt(now + 3600), now)).toBe(false);
    expect(isExpiredToken('not-a-jwt', now)).toBe(true);
  });
});

describe('authInterceptor', () => {
  it('adds the session to requests', async () => {
    const { seen, result } = run('/api/enrollments/my', null);
    await firstValueFrom(result);
    expect(seen[0].headers.get('Authorization')).toBe('Bearer valid-token');
  });

  it('signs out when the server refuses the session', async () => {
    const { auth, result } = run('/api/enrollments/access/c1', { status: 401, message: 'Unauthorized' });
    await expect(firstValueFrom(result)).rejects.toBeInstanceOf(HttpErrorResponse);
    expect(auth.expireSession).toHaveBeenCalledTimes(1);
  });

  it('keeps the user signed in for other 401s (e.g. wrong current password)', async () => {
    const { auth, result } = run('/api/account/password', { status: 401, message: 'Your current password is incorrect.' });
    await expect(firstValueFrom(result)).rejects.toBeInstanceOf(HttpErrorResponse);
    expect(auth.expireSession).not.toHaveBeenCalled();
  });

  it('ignores 401s from the sign-in endpoints', async () => {
    const { auth, result } = run('/api/auth/login', { status: 401, message: 'Unauthorized' });
    await expect(firstValueFrom(result)).rejects.toBeInstanceOf(HttpErrorResponse);
    expect(auth.expireSession).not.toHaveBeenCalled();
  });

  it('does nothing for signed-out visitors', async () => {
    const { auth, seen, result } = run('/api/courses', { status: 401, message: 'Unauthorized' }, null);
    await expect(firstValueFrom(result)).rejects.toBeInstanceOf(HttpErrorResponse);
    expect(seen[0].headers.has('Authorization')).toBe(false);
    expect(auth.expireSession).not.toHaveBeenCalled();
  });
});

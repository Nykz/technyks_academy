import { JwtService } from '@nestjs/jwt';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { rateLimitKey } from './throttle';

describe('rateLimitKey', () => {
  const secret = 'a-test-secret-that-is-long-enough-123456';
  const original = process.env.JWT_SECRET;
  beforeEach(() => {
    process.env.JWT_SECRET = secret;
  });
  afterEach(() => {
    process.env.JWT_SECRET = original;
  });

  const sign = (sub: string, key = secret) =>
    new JwtService().sign({ sub }, { secret: key, expiresIn: '1h' });

  it('counts signed-in students per account, even on a shared address', () => {
    const a = rateLimitKey({ ip: '49.37.103.8', headers: { authorization: `Bearer ${sign('student-a')}` } });
    const b = rateLimitKey({ ip: '49.37.103.8', headers: { authorization: `Bearer ${sign('student-b')}` } });
    expect(a).toBe('user:student-a');
    expect(b).toBe('user:student-b');
  });

  it('counts visitors per address', () => {
    expect(rateLimitKey({ ip: '49.37.103.8', headers: {} })).toBe('ip:49.37.103.8');
  });

  it('ignores forged or garbage tokens, so they cannot escape the limit', () => {
    const forged = sign('someone', 'a-different-secret-that-is-long-enough-99');
    expect(rateLimitKey({ ip: '1.1.1.1', headers: { authorization: `Bearer ${forged}` } })).toBe('ip:1.1.1.1');
    expect(rateLimitKey({ ip: '1.1.1.1', headers: { authorization: 'Bearer not-a-jwt' } })).toBe('ip:1.1.1.1');
  });
});

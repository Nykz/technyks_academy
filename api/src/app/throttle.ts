import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ThrottlerGuard } from '@nestjs/throttler';

const jwt = new JwtService();

/**
 * Rate-limit key for a request.
 *
 * Signed-in users are counted per account, so students sharing one public
 * address (a college lab, office or hostel Wi-Fi) don't share a limit.
 * Everyone else is counted per address (req.ip, which honours the
 * trusted-proxy setting). The token's signature is verified, so sending
 * made-up tokens can't be used to escape the limit.
 */
export function rateLimitKey(request: {
  ip?: string;
  headers?: Record<string, unknown>;
}): string {
  const authorization = String(request.headers?.['authorization'] || '');
  const token = authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim()
    : '';
  const secret = String(process.env.JWT_SECRET || '');
  if (token && secret) {
    try {
      const payload = jwt.verify<{ sub?: string }>(token, { secret });
      if (payload?.sub) return `user:${payload.sub}`;
    } catch {
      // Expired or forged token: fall back to the address.
    }
  }
  return `ip:${request.ip || 'unknown'}`;
}

@Injectable()
export class AccountAwareThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(request: Record<string, any>) {
    return rateLimitKey(request);
  }
}

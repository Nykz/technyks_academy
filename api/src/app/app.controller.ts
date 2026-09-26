import { Controller, Get, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getData() {
    return this.appService.getData();
  }

  @Get('health')
  getHealth() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  /**
   * Shows the caller how the server sees their address, to choose
   * TRUST_PROXY_HOPS (the rate limiter keys on req.ip). Only the caller's
   * own request details are returned.
   */
  @Get('health/client')
  getClientAddress(@Req() request: Request) {
    const header = (name: string) => {
      const value = request.headers[name];
      return Array.isArray(value) ? value.join(', ') : value || null;
    };
    const forwardedFor = String(header('x-forwarded-for') || '')
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
    const chain = [...forwardedFor, request.socket.remoteAddress || ''];
    const ipForHops: Record<string, string | null> = {};
    for (let hops = 0; hops <= 3; hops += 1) {
      ipForHops[hops] = chain[chain.length - 1 - hops] ?? null;
    }
    return {
      ip: request.ip,
      trustProxyHops: request.app.get('trust proxy'),
      ipForHops,
      headers: {
        'x-forwarded-for': header('x-forwarded-for'),
        'x-real-ip': header('x-real-ip'),
        'true-client-ip': header('true-client-ip'),
        'cf-connecting-ip': header('cf-connecting-ip'),
        'x-client-ip': header('x-client-ip'),
      },
    };
  }
}

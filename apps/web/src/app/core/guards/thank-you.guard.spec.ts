import '@angular/compiler';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Injector, PLATFORM_ID, runInInjectionContext } from '@angular/core';
import { Router, UrlTree } from '@angular/router';
import { Observable, firstValueFrom, isObservable, of, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { EnrollmentsService } from '../services/enrollments.service';
import { TemplatesService } from '../services/templates.service';
import { PaymentsService } from '../services/payments.service';
import { THANK_YOU_WINDOW_MS, thankYouGuard, thankYouNavigation } from './thank-you.guard';

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

function runGuard(options: {
  signedIn?: boolean;
  state?: unknown;
  historyState?: unknown;
  enrollments?: Observable<any[]>;
  purchases?: Observable<any[]>;
  memberships?: Observable<any[]>;
  platform?: string;
}) {
  vi.stubGlobal('window', { history: { state: options.historyState ?? null } });
  const router = {
    getCurrentNavigation: () => (options.state === undefined ? null : { extras: { state: options.state } }),
    createUrlTree: (commands: string[]) => ({ redirectTo: commands.join('/') }) as unknown as UrlTree,
  };
  const enrollmentsCall = vi.fn(() => options.enrollments ?? of([]));
  const purchasesCall = vi.fn(() => options.purchases ?? of([]));
  const membershipsCall = vi.fn(() => options.memberships ?? of([]));
  const injector = Injector.create({
    providers: [
      { provide: Router, useValue: router },
      { provide: AuthService, useValue: { isAuthenticated: () => options.signedIn ?? true } },
      { provide: EnrollmentsService, useValue: { getMyEnrollments: enrollmentsCall } },
      { provide: TemplatesService, useValue: { purchases: purchasesCall } },
      { provide: PaymentsService, useValue: { myMemberships: membershipsCall } },
      { provide: PLATFORM_ID, useValue: options.platform ?? 'browser' },
    ],
  });
  const result = runInInjectionContext(injector, () => thankYouGuard({} as any, {} as any));
  return { result, enrollmentsCall, purchasesCall };
}

async function outcome(result: unknown) {
  const value = isObservable(result) ? await firstValueFrom(result as Observable<unknown>) : result;
  return value === true ? 'allowed' : (value as any)?.redirectTo;
}

const courseState = thankYouNavigation({ kind: 'course', courseId: 'course-1' }).state;

describe('thankYouGuard', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('allows the page right after a confirmed enrollment', async () => {
    const { result } = runGuard({
      state: courseState,
      enrollments: of([{ courseId: 'course-1', createdAt: minutesAgo(1) }]),
    });
    expect(await outcome(result)).toBe('allowed');
  });

  it('allows a refresh: the browser keeps the navigation state', async () => {
    const { result } = runGuard({
      historyState: { ...courseState, navigationId: 1 },
      enrollments: of([{ courseId: 'course-1', createdAt: minutesAgo(5) }]),
    });
    expect(await outcome(result)).toBe('allowed');
  });

  it('sends signed-out visitors to login without calling the API', async () => {
    const { result, enrollmentsCall } = runGuard({ signedIn: false, state: courseState });
    expect(await outcome(result)).toBe('/auth/login');
    expect(enrollmentsCall).not.toHaveBeenCalled();
  });

  it('sends a typed URL / new tab (no navigation state) to the dashboard', async () => {
    const { result, enrollmentsCall } = runGuard({});
    expect(await outcome(result)).toBe('/dashboard');
    expect(enrollmentsCall).not.toHaveBeenCalled();
  });

  it('rejects made-up state when the server has no such enrollment', async () => {
    const { result } = runGuard({
      state: thankYouNavigation({ kind: 'course', courseId: 'not-mine' }).state,
      enrollments: of([{ courseId: 'course-1', createdAt: minutesAgo(1) }]),
    });
    expect(await outcome(result)).toBe('/dashboard');
  });

  it('rejects an old enrollment (more than 30 minutes ago)', async () => {
    const { result } = runGuard({
      state: courseState,
      enrollments: of([{ courseId: 'course-1', createdAt: minutesAgo(THANK_YOU_WINDOW_MS / 60_000 + 1) }]),
    });
    expect(await outcome(result)).toBe('/dashboard');
  });

  it('sends the user to the dashboard if the server check fails', async () => {
    const { result } = runGuard({ state: courseState, enrollments: throwError(() => new Error('offline')) });
    expect(await outcome(result)).toBe('/dashboard');
  });

  it('checks every purchased template for template orders', async () => {
    const state = thankYouNavigation({ kind: 'templates', productIds: ['t1', 't2'] }).state;
    const ok = runGuard({
      state,
      purchases: of([
        { product: { id: 't1' }, purchasedAt: minutesAgo(1) },
        { product: { id: 't2' }, purchasedAt: minutesAgo(1) },
      ]),
    });
    expect(await outcome(ok.result)).toBe('allowed');
    const missing = runGuard({ state, purchases: of([{ product: { id: 't1' }, purchasedAt: minutesAgo(1) }]) });
    expect(await outcome(missing.result)).toBe('/dashboard');
  });

  it('never renders the page on the server', async () => {
    const { result } = runGuard({ platform: 'server', state: courseState });
    expect(await outcome(result)).toBe('/courses');
  });

  it('allows the page after a membership the server shows as active', async () => {
    const state = thankYouNavigation({ kind: 'membership', planId: 'annual' }).state;
    const allowed = runGuard({ state, memberships: of([{ planId: 'annual' }]) });
    expect(await outcome(allowed.result)).toBe('allowed');
    const refused = runGuard({ state, memberships: of([{ planId: 'other' }]) });
    expect(await outcome(refused.result)).toBe('/dashboard');
  });
});

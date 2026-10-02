import '@angular/compiler';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpErrorResponse, HttpRequest } from '@angular/common/http';
import { firstValueFrom, of, throwError } from 'rxjs';
import { apiUrlInterceptor } from './api-url.interceptor';

/** Pretend to be a browser tab on technyks.com. */
function browserOn(hostname: string) {
  const store = new Map<string, string>();
  vi.stubGlobal('window', { location: { hostname } });
  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
  });
}

/** A fake backend: api.technyks.com is unreachable, technyks.com answers. */
function backend(apiUp: boolean) {
  const calls: string[] = [];
  const next = (req: HttpRequest<unknown>) => {
    calls.push(req.url);
    if (req.url.startsWith('https://api.technyks.com') && !apiUp) {
      return throwError(() => new HttpErrorResponse({ status: 0, url: req.url }));
    }
    return of({ url: req.url } as any);
  };
  return { calls, next };
}

describe('apiUrlInterceptor on technyks.com', () => {
  beforeEach(() => browserOn('technyks.com'));
  afterEach(() => vi.unstubAllGlobals());

  it('uses api.technyks.com when it is reachable', async () => {
    const { calls, next } = backend(true);
    await firstValueFrom(apiUrlInterceptor(new HttpRequest('GET', '/api/templates'), next as any));
    expect(calls).toEqual(['https://api.technyks.com/api/templates']);
  });

  it('retries on technyks.com when api.technyks.com is blocked, then stays there', async () => {
    const { calls, next } = backend(false);
    await firstValueFrom(apiUrlInterceptor(new HttpRequest('GET', '/api/fx/visitor'), next as any));
    expect(calls).toEqual(['https://api.technyks.com/api/fx/visitor', '/api/fx/visitor']);

    await firstValueFrom(apiUrlInterceptor(new HttpRequest('GET', '/api/templates'), next as any));
    expect(calls.at(-1)).toBe('/api/templates');
    expect(calls).toHaveLength(3);
  });

  it('never moves downloads or uploads off the API server', async () => {
    const { calls, next } = backend(false);
    const download = new HttpRequest('GET', '/api/templates/abc/download', { responseType: 'blob' });
    await expect(firstValueFrom(apiUrlInterceptor(download, next as any))).rejects.toBeInstanceOf(HttpErrorResponse);
    expect(calls).toEqual(['https://api.technyks.com/api/templates/abc/download']);
  });

  it('passes real API errors through instead of retrying', async () => {
    const calls: string[] = [];
    const next = (req: HttpRequest<unknown>) => {
      calls.push(req.url);
      return throwError(() => new HttpErrorResponse({ status: 404, url: req.url }));
    };
    await expect(
      firstValueFrom(apiUrlInterceptor(new HttpRequest('GET', '/api/templates/missing'), next as any)),
    ).rejects.toMatchObject({ status: 404 });
    expect(calls).toHaveLength(1);
  });
});

describe('apiUrlInterceptor elsewhere', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('does not fall back on other hosts', async () => {
    browserOn('preview.example.com');
    const { calls, next } = backend(false);
    await expect(
      firstValueFrom(apiUrlInterceptor(new HttpRequest('GET', '/api/templates'), next as any)),
    ).rejects.toBeInstanceOf(HttpErrorResponse);
    expect(calls).toEqual(['https://api.technyks.com/api/templates']);
  });
});

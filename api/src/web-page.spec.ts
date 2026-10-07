import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveWebPage } from './web-page';

function webBuild() {
  const dir = mkdtempSync(join(tmpdir(), 'web-'));
  writeFileSync(join(dir, 'index.html'), 'home');
  writeFileSync(join(dir, 'index.csr.html'), 'shell');
  mkdirSync(join(dir, 'privacy-policy'));
  writeFileSync(join(dir, 'privacy-policy', 'index.html'), 'privacy');
  return dir;
}

describe('resolveWebPage', () => {
  const dir = webBuild();

  it('serves the home page only for /', () => {
    expect(resolveWebPage(dir, '/')).toBe(join(dir, 'index.html'));
  });

  it("serves a pre-rendered page's own HTML, with or without a trailing slash", () => {
    expect(resolveWebPage(dir, '/privacy-policy')).toBe(join(dir, 'privacy-policy', 'index.html'));
    expect(resolveWebPage(dir, '/privacy-policy/')).toBe(join(dir, 'privacy-policy', 'index.html'));
  });

  it('serves the empty app shell (not the home page) for app pages', () => {
    expect(resolveWebPage(dir, '/courses/some-course')).toBe(join(dir, 'index.csr.html'));
    expect(resolveWebPage(dir, '/dashboard')).toBe(join(dir, 'index.csr.html'));
  });

  it('never leaves the web folder', () => {
    expect(resolveWebPage(dir, '/../../etc')).toBe(join(dir, 'index.csr.html'));
    expect(resolveWebPage(dir, '/%2e%2e/%2e%2e/etc')).toBe(join(dir, 'index.csr.html'));
    expect(resolveWebPage(dir, '/..%2fapi')).toBe(join(dir, 'index.csr.html'));
  });

  it('falls back to index.html when the build has no app shell', () => {
    const only = mkdtempSync(join(tmpdir(), 'web-'));
    writeFileSync(join(only, 'index.html'), 'home');
    expect(resolveWebPage(only, '/courses/x')).toBe(join(only, 'index.html'));
  });
});

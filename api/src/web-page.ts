import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The HTML for a page request: the page's own pre-rendered file when the
 * build has one (home, legal pages, login…), otherwise the empty app shell,
 * which shows the preloader until the app renders the page. Sending the
 * pre-rendered home page for every URL made reloads flash the home page.
 */
export function resolveWebPage(webDirectory: string, requestPath: string) {
  const segments = requestPath
    .split('/')
    .filter(Boolean)
    .map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return '';
      }
    });
  const safe = segments.every(
    (segment) => segment && segment !== '.' && segment !== '..' && !/[\\/\0]/.test(segment),
  );
  if (safe) {
    const prerendered = join(webDirectory, ...segments, 'index.html');
    if (existsSync(prerendered)) return prerendered;
  }
  const shell = join(webDirectory, 'index.csr.html');
  return existsSync(shell) ? shell : join(webDirectory, 'index.html');
}

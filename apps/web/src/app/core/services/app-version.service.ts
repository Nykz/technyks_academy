import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { NavigationEnd, NavigationError, NavigationStart, Router } from '@angular/router';

/** How long a tab must be hidden before checking for a newer site version. */
const CHECK_AFTER_HIDDEN_MS = 30 * 60 * 1000;
const RELOAD_GUARD_KEY = 'technyks-reloaded-for';

/** True for the errors a browser throws when a lazy page's file is gone. */
export function isStaleChunkError(error: unknown): boolean {
  const message = String((error as any)?.message ?? error ?? '');
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError|Loading chunk [\w-]+ failed/i.test(
    message,
  );
}

/**
 * Keeps long-open tabs working after a deploy.
 *
 * Every deploy replaces the hashed JavaScript files, so a tab opened before
 * it points at files that no longer exist and in-app links silently fail.
 * This service (1) turns such a failed navigation into a normal page load
 * of the requested URL, and (2) when a tab comes back after a long break
 * and a newer version is live, makes the next link click a full page load.
 */
@Injectable({ providedIn: 'root' })
export class AppVersionService {
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private hiddenSince = 0;
  private newVersionLive = false;

  start() {
    if (!this.isBrowser) return;

    this.router.events.subscribe((event) => {
      if (event instanceof NavigationError && isStaleChunkError(event.error)) {
        this.hardNavigate(event.url);
      } else if (event instanceof NavigationStart && this.newVersionLive) {
        this.hardNavigate(event.url);
      } else if (event instanceof NavigationEnd) {
        // The page loaded fine, so a future stale-file failure may reload again.
        try {
          sessionStorage.removeItem(RELOAD_GUARD_KEY);
        } catch {
          // Storage blocked.
        }
      }
    });

    this.document.addEventListener('visibilitychange', () => {
      if (this.document.visibilityState === 'hidden') {
        this.hiddenSince = Date.now();
      } else if (this.hiddenSince && Date.now() - this.hiddenSince > CHECK_AFTER_HIDDEN_MS) {
        this.hiddenSince = 0;
        void this.checkForNewVersion();
      }
    });
  }

  /** Compares the running main bundle with the one the server now serves. */
  private async checkForNewVersion() {
    const running = this.currentMainBundle();
    if (!running) return;
    try {
      const response = await fetch('/', { cache: 'no-store' });
      const html = await response.text();
      const live = html.match(/main-[A-Z0-9]+\.js/)?.[0];
      if (live && live !== running) this.newVersionLive = true;
    } catch {
      // Offline or server busy: keep the current version.
    }
  }

  private currentMainBundle(): string | null {
    const script = Array.from(this.document.scripts).find((item) =>
      /main-[A-Z0-9]+\.js/.test(item.src),
    );
    return script?.src.match(/main-[A-Z0-9]+\.js/)?.[0] ?? null;
  }

  private hardNavigate(url: string) {
    const target = url && url.startsWith('/') ? url : this.document.location.pathname;
    // Guard against a reload loop if the file is missing for another reason.
    const key = RELOAD_GUARD_KEY;
    try {
      if (sessionStorage.getItem(key) === target) return;
      sessionStorage.setItem(key, target);
    } catch {
      // Storage blocked: still reload once.
    }
    this.document.location.assign(target);
  }
}

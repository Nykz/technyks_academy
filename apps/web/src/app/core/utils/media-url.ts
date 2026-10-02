import { PRODUCTION_API_ORIGIN, isLocalBrowser, sameOriginApiAvailable } from './api-origin';

/**
 * Uploaded course/template media (thumbnails, directly-uploaded intro
 * videos) is stored on the API server and referenced everywhere else by the
 * relative "/uploads/..." path that MediaService returns. The web app is
 * never on the same origin as the API outside of local dev
 * (courses.codingtechnyks.com vs api.codingtechnyks.com in production), so
 * binding that relative path straight to [src] resolves it against the
 * WRONG origin and the image/video 404s — it *looks* like the upload or
 * save didn't work, but the file is sitting on the API the whole time.
 *
 * Use this (or the `mediaUrl` pipe) anywhere a stored thumbnail /
 * promoVideoUrl / other uploaded-file field is bound to an <img>, <video>,
 * or CSS background-image.
 */
export function resolveMediaUrl(
  value: string | null | undefined,
): string | null {
  const url = String(value ?? '').trim();
  if (!url) return null;

  // Already absolute (http/https), a data: URI, or a blob: preview — use as-is.
  if (/^(https?:|data:|blob:)/i.test(url)) return url;

  // Not a root-relative path (shouldn't normally happen) — pass through.
  if (!url.startsWith('/')) return url;

  // Bundled web-app assets (logos, illustrations, stock course art) are
  // shipped with the frontend itself and always resolve correctly as-is.
  if (url.startsWith('/assets/')) return url;

  // Everything else that starts with "/" (chiefly /uploads/...) lives on
  // the API, not the web app.
  if (isLocalBrowser()) {
    // apps/web/proxy.conf.json forwards /uploads to the local API, so a
    // relative path already resolves correctly through localhost:4200.
    return url;
  }

  // Uploaded images live in the database, which technyks.com also serves,
  // so on technyks.com they load from the same origin. That keeps pictures
  // working on networks that cannot reach api.technyks.com (some VPNs).
  if (sameOriginApiAvailable() && url.startsWith('/uploads/course-media/image-')) {
    return url;
  }

  // Videos and everything else are files on the API server's disk.
  return `${PRODUCTION_API_ORIGIN}${url}`;
}

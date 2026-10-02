/**
 * Single source of truth for "what origin is the API on" so that every place
 * that needs to build an absolute API/asset URL (the HTTP interceptor, the
 * uploaded-media URL resolver, etc.) agrees with each other. The web app and
 * the API are on separate origins outside of local dev:
 *   - locally:    web on http://localhost:4200, API on http://localhost:4310
 *   - production: web on technyks.com, API on api.technyks.com
 *
 * technyks.com runs the same API (same database) too, so when a visitor's
 * network cannot reach api.technyks.com (some VPN routes), data requests
 * fall back to technyks.com/api. Files stored on disk (uploaded videos,
 * template ZIPs) exist only on api.technyks.com.
 */
export const PRODUCTION_API_ORIGIN = 'https://api.technyks.com';
export const LOCAL_API_ORIGIN = 'http://localhost:4310';

const SAME_ORIGIN_HOSTS = ['technyks.com', 'www.technyks.com'];
const FALLBACK_KEY = 'technyks-api-same-origin';

export function isLocalBrowser(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  );
}

/** True in the browser on technyks.com, which also serves /api and DB images. */
export function sameOriginApiAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  return SAME_ORIGIN_HOSTS.includes(window.location.hostname);
}

/** True once api.technyks.com failed in this tab; data then uses technyks.com. */
export function usingSameOriginFallback(): boolean {
  if (!sameOriginApiAvailable()) return false;
  try {
    return sessionStorage.getItem(FALLBACK_KEY) === '1';
  } catch {
    return false;
  }
}

export function rememberSameOriginFallback() {
  try {
    sessionStorage.setItem(FALLBACK_KEY, '1');
  } catch {
    // Storage blocked: the fallback still applies per request.
  }
}

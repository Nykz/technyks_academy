/**
 * Single source of truth for "what origin is the API on" so that every place
 * that needs to build an absolute API/asset URL (the HTTP interceptor, the
 * uploaded-media URL resolver, etc.) agrees with each other. The web app and
 * the API are always on separate origins outside of local dev:
 *   - locally:    web on http://localhost:4200, API on http://localhost:4310
 *   - production: web on technyks.com, API on api.technyks.com
 */
export const PRODUCTION_API_ORIGIN = 'https://api.technyks.com';
export const LOCAL_API_ORIGIN = 'http://localhost:4310';

export function isLocalBrowser(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  );
}

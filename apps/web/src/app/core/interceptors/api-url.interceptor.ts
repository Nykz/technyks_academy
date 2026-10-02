import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { TimeoutError, catchError, of, throwError, timeout } from 'rxjs';
import {
  PRODUCTION_API_ORIGIN,
  isLocalBrowser,
  rememberSameOriginFallback,
  sameOriginApiAvailable,
  usingSameOriginFallback,
} from '../utils/api-origin';

/** How long a GET to api.technyks.com may take before trying technyks.com. */
const PRIMARY_GET_TIMEOUT_MS = 10_000;

/**
 * Requests that must go to api.technyks.com: uploads and downloads use files
 * stored on that deployment's disk.
 */
function needsApiServer(req: HttpRequest<unknown>) {
  return (
    req.body instanceof FormData ||
    req.responseType === 'blob' ||
    /\/(download|uploads?)(\/|$|\?)|\/admin\/media(\/|\?|$)|\/admin\/uploads|\/file(\/|$|\?)/.test(req.url)
  );
}

/**
 * Sends /api requests to the API backend. On technyks.com, if
 * api.technyks.com cannot be reached (network error or a GET timing out),
 * the request is repeated on technyks.com/api, which runs the same API, and
 * the rest of the visit uses technyks.com directly.
 */
export const apiUrlInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith('/api')) return next(req);
  if (isLocalBrowser()) return next(req);

  // In SSR environment, set a tight timeout so rendering never causes a 504 Gateway Time-out
  if (typeof window === 'undefined') {
    const targetUrl = `${PRODUCTION_API_ORIGIN}${req.url}`;
    return next(req.clone({ url: targetUrl })).pipe(
      timeout(1500),
      catchError(() => of(null as any)),
    );
  }

  const canFallBack = sameOriginApiAvailable() && !needsApiServer(req);
  if (canFallBack && usingSameOriginFallback()) return next(req);

  const primary = next(req.clone({ url: `${PRODUCTION_API_ORIGIN}${req.url}` }));
  if (!canFallBack) return primary;

  const guarded = req.method === 'GET' ? primary.pipe(timeout(PRIMARY_GET_TIMEOUT_MS)) : primary;
  return guarded.pipe(
    catchError((error) => {
      const unreachable =
        error instanceof TimeoutError ||
        (error instanceof HttpErrorResponse && error.status === 0);
      if (!unreachable) return throwError(() => error);
      rememberSameOriginFallback();
      return next(req); // Same request on technyks.com/api.
    }),
  );
};

import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

/** Server messages meaning the session itself is not valid any more. */
const SESSION_REFUSED = ['Unauthorized', 'Invalid authentication token', 'User account could not be found.'];

/** Sign-in endpoints answer 401 for a wrong password; that isn't an expired session. */
const SIGN_IN_PATHS = /\/api\/auth\/(login|signup|google|forgot-password|reset-password)/;

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getToken();

  if (!token) return next(req);

  const cloned = req.clone({
    headers: req.headers.set('Authorization', `Bearer ${token}`),
  });
  return next(cloned).pipe(
    catchError((error) => {
      // The server refused this session (expired after 7 days or no longer
      // valid). Sign out cleanly instead of failing every signed-in request.
      if (
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        // Only the login guard's own refusal; other 401s (e.g. a wrong
        // current password in account settings) keep the user signed in.
        SESSION_REFUSED.includes(error.error?.message) &&
        !SIGN_IN_PATHS.test(req.url) &&
        authService.getToken() === token
      ) {
        authService.expireSession();
      }
      return throwError(() => error);
    }),
  );
};

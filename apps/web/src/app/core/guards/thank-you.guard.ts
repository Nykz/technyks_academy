import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { Observable, catchError, map, of } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { EnrollmentsService } from '../services/enrollments.service';
import { TemplatesService } from '../services/templates.service';
import { PaymentsService } from '../services/payments.service';

/** How long after an enrollment/purchase the thank-you page stays available. */
export const THANK_YOU_WINDOW_MS = 30 * 60 * 1000;

/**
 * What was just bought. Passed as router navigation state (never in the
 * URL), so typing /thank-you or opening it in a new tab has none.
 */
export type ThankYouContext =
  | { kind: 'course'; courseId: string }
  | { kind: 'templates'; productIds: string[] }
  | { kind: 'membership'; planId: string };

/** Navigation extras for going to /thank-you after a confirmed enrollment. */
export function thankYouNavigation(context: ThankYouContext) {
  return { state: { thankYou: context } };
}

function contextFrom(state: unknown): ThankYouContext | null {
  const context = (state as { thankYou?: ThankYouContext } | null)?.thankYou;
  if (context?.kind === 'course' && typeof context.courseId === 'string' && context.courseId) {
    return context;
  }
  if (context?.kind === 'membership' && typeof context.planId === 'string' && context.planId) {
    return context;
  }
  if (
    context?.kind === 'templates' &&
    Array.isArray(context.productIds) &&
    context.productIds.length > 0 &&
    context.productIds.every((id) => typeof id === 'string' && id)
  ) {
    return context;
  }
  return null;
}

function isRecent(value: string | Date | undefined | null, now: number) {
  const time = new Date(value ?? NaN).getTime();
  return Number.isFinite(time) && time <= now + 60_000 && now - time <= THANK_YOU_WINDOW_MS;
}

/**
 * Guards /thank-you so it only appears right after a real enrollment or
 * purchase. Requires all of:
 *  1. a signed-in user (otherwise → login);
 *  2. the navigation state set by the checkout / free-enroll success code;
 *  3. the server confirming, via the existing "my enrollments" / "my
 *     purchases" endpoints, that this user owns that course/template and
 *     got it within the last 30 minutes.
 * Anything else → /dashboard. Refreshing keeps the browser's navigation
 * state, so a refresh shortly after purchase still shows the page; it only
 * reads data and never creates an enrollment, payment or conversion.
 */
export const thankYouGuard: CanActivateFn = (): Observable<boolean | UrlTree> | UrlTree => {
  const router = inject(Router);
  const auth = inject(AuthService);
  const enrollments = inject(EnrollmentsService);
  const templates = inject(TemplatesService);
  const payments = inject(PaymentsService);
  const isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  const dashboard = router.createUrlTree(['/dashboard']);

  if (!isBrowser) return router.createUrlTree(['/courses']);
  if (!auth.isAuthenticated()) return router.createUrlTree(['/auth/login']);

  const context = contextFrom(
    router.getCurrentNavigation()?.extras.state ?? window.history.state,
  );
  if (!context) return dashboard;

  const now = Date.now();
  if (context.kind === 'course') {
    return enrollments.getMyEnrollments().pipe(
      map((items) =>
        items.some(
          (item) =>
            item.courseId === context.courseId &&
            // updatedAt: a course already open through a membership, bought just now.
            (isRecent(item.createdAt, now) || isRecent(item.updatedAt, now)),
        )
          ? true
          : dashboard,
      ),
      catchError(() => of(dashboard)),
    );
  }
  if (context.kind === 'membership') {
    // The membership must be active on the server (bought or renewed just now).
    return payments.myMemberships().pipe(
      map((plans) => (plans.some((plan) => plan.planId === context.planId) ? true : dashboard)),
      catchError(() => of(dashboard)),
    );
  }
  return templates.purchases().pipe(
    map((items) =>
      context.productIds.every((id) =>
        items.some((item) => item.product?.id === id && isRecent(item.purchasedAt, now)),
      )
        ? true
        : dashboard,
    ),
    catchError(() => of(dashboard)),
  );
};

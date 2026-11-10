import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, switchMap, tap, throwError } from 'rxjs';
import { Logging } from '@core/services/logging/logging';
import { Auth } from '@services/auth/auth';
import { ServerStatus } from '@core/services/server-status/server-status';
import {
  forbiddenUrlTree,
  loginUrlTree,
  serverErrorUrlTree,
} from '@shared/lib/auth-navigation/auth-navigation';

/**
 * Auth endpoints must never trigger a refresh-and-retry: a 401 from them means
 * "these credentials/session tokens are wrong", not "the access token expired".
 *
 * URLs are matched on their path suffix because requests reach this interceptor
 * both absolute (`https://host/api/auth/login`, after `urlInterceptor`) and
 * relative (`auth/login`, in tests or when the URL interceptor is absent).
 */
const AUTH_ENDPOINT_PATHS = [
  '/auth/login',
  '/auth/refresh',
  '/auth/logout',
  '/auth/verify',
  '/auth/register',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/change-password',
  '/auth/setup-account',
];

export function isAuthEndpoint(url: string): boolean {
  const path = url.split('?')[0].replace(/^[a-z]+:\/\/[^/]+/i, '');
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return AUTH_ENDPOINT_PATHS.some(
    (endpoint) => normalized === endpoint || normalized.endsWith(endpoint),
  );
}

/**
 * Global error interceptor.
 *
 * Status matrix (the backend sends BODYLESS 401/403, so status is the only
 * signal):
 *  - 401 on a non-auth request → ONE `POST auth/refresh`; on success the original
 *    request is replayed once with the new access token. The replayed request's
 *    own outcome is then classified independently: 401 → session dead (clear +
 *    `/login`), 403 → `/forbidden`, 0/5xx → `/server-error`, other → passthrough.
 *    The refresh failing (before any replay) means the session is dead: clear it
 *    and go to `/login?returnUrl=<current url>`.
 *  - 403 → `/forbidden`; the error is still propagated so callers do not treat a
 *    denied request as successful.
 *  - 0 / 5xx on the FIRST attempt → only reported to `ServerStatus`, no
 *    navigation (guards own `/server-error` for route resolution).
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const logger = inject(Logging);
  const router = inject(Router);
  const authService = inject(Auth);
  const serverStatus = inject(ServerStatus);

  return next(req).pipe(
    tap({
      next: () => {
        logger.http(`Response from ${req.method} ${req.url}`);
        serverStatus.reportSuccess();
      },
      error: (err: HttpErrorResponse) => {
        logger.error(`Response from ${req.method} ${req.url} failed:`, err);
        if (err.status === 0 || (err.status >= 500 && err.status < 600)) {
          serverStatus.reportNetworkError();
        }
      },
    }),
    catchError((err: HttpErrorResponse) => {
      if (isAuthEndpoint(req.url)) {
        return throwError(() => err);
      }
      if (err.status === 401) {
        return handleUnauthorized(req, next, err, authService, router, logger, serverStatus);
      }
      if (err.status === 403) {
        redirectToForbidden(router, logger);
        return throwError(() => err);
      }
      return throwError(() => err);
    }),
  );
};

/**
 * Refresh once, then replay the original request exactly once.
 *
 * The replay goes through `next(...)` only — the JWT interceptor already ran
 * upstream, so the new access token must be attached here explicitly.
 *
 * Refresh failure and replay failure are handled by SEPARATE `catchError`s:
 * a failed refresh means the session is dead, while a failed replay is just the
 * outcome of that one request and must be classified by its own status (a 403 or
 * a 502 on the replay says nothing about the session).
 */
function handleUnauthorized(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
  originalError: HttpErrorResponse,
  authService: Auth,
  router: Router,
  logger: Logging,
  serverStatus: ServerStatus,
): Observable<HttpEvent<unknown>> {
  logger.routing('401 received, attempting token refresh');

  return authService.refreshOnce().pipe(
    // Scoped to the refresh observable only (upstream of the replay).
    catchError((refreshError: unknown) => {
      logger.error('Token refresh failed, session is dead', refreshError);
      // `refreshOnce()` already logs out on failure; be explicit anyway.
      authService.logout();
      redirectToLogin(router, logger);
      return throwError(() => originalError);
    }),
    switchMap(() => {
      const token = authService.getToken();
      const retried = token
        ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
        : req.clone();
      logger.routing('Token refreshed, replaying request once');
      return next(retried).pipe(
        // Scoped to the replay: never touches the session unless it is a 401.
        catchError((replayError: unknown) => {
          handleReplayFailure(replayError, { authService, router, logger, serverStatus });
          return throwError(() => replayError);
        }),
      );
    }),
  );
}

interface ReplayStep {
  authService: Auth;
  router: Router;
  logger: Logging;
  serverStatus: ServerStatus;
}

/**
 * Classifies the outcome of the replayed request. The session is only cleared
 * when the replay itself is rejected with 401 (one refresh was already spent, so
 * a second one is pointless).
 */
function handleReplayFailure(error: unknown, step: ReplayStep): void {
  const { authService, router, logger, serverStatus } = step;
  const status = (error as HttpErrorResponse | null)?.status;

  if (status === 401) {
    logger.error('Replayed request rejected with 401, session is dead', error);
    authService.logout();
    redirectToLogin(router, logger);
    return;
  }
  if (status === 403) {
    redirectToForbidden(router, logger);
    return;
  }
  if (status === 0 || (typeof status === 'number' && status >= 500 && status < 600)) {
    logger.error('Replayed request failed with a server/transport error', error);
    serverStatus.reportNetworkError();
    redirectToServerError(router, logger);
    return;
  }
  const statusLabel = status === undefined ? 'unknown' : String(status);
  logger.error(`Replayed request failed with status ${statusLabel}`, error);
}

function redirectToLogin(router: Router, logger: Logging): void {
  const currentUrl = router.url;
  if (currentUrl.startsWith('/login')) {
    logger.routing('Already on the login screen, skipping login redirect');
    return;
  }
  void router.navigateByUrl(loginUrlTree(router, currentUrl));
}

function redirectToForbidden(router: Router, logger: Logging): void {
  if (router.url.startsWith('/forbidden')) {
    logger.routing('Already on the forbidden screen, skipping redirect');
    return;
  }
  logger.routing('403 received, redirecting to /forbidden');
  void router.navigateByUrl(forbiddenUrlTree(router));
}

function redirectToServerError(router: Router, logger: Logging): void {
  if (router.url.startsWith('/server-error')) {
    logger.routing('Already on the server-error screen, skipping redirect');
    return;
  }
  logger.routing('Server/transport failure on replay, redirecting to /server-error');
  void router.navigateByUrl(serverErrorUrlTree(router));
}

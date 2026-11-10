/**
 * Auth failure → navigation mapping (single source of truth).
 *
 * The backend answers 401 and 403 with BODYLESS responses, so the only usable
 * signal is the HTTP status code. This module maps that status to the screen the
 * user must land on:
 *
 *  - 401            → `/login?returnUrl=<attempted url>` (not authenticated)
 *  - 403            → `/forbidden`                      (authenticated, not allowed)
 *  - 0 / 5xx / null → `/server-error`                   (transport or server failure)
 *  - anything else  → `/login`                          (session cannot be trusted)
 *
 * Pure functions only, so guards and the error interceptor share the exact same
 * matrix and it can be tested without TestBed.
 */
import { RedirectCommand, Router } from '@angular/router';

export type AuthFailure = 'unauthenticated' | 'forbidden' | 'server';

const LOGIN_PATH = '/login';
const FORBIDDEN_PATH = '/forbidden';
const SERVER_ERROR_PATH = '/server-error';

/**
 * Extracts the HTTP status from an unknown thrown value (guards receive
 * `unknown` from `catchError`).
 */
export function statusOf(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }
  const status = (error as { status?: unknown }).status;
  return typeof status === 'number' ? status : undefined;
}

/**
 * Classifies a failure by HTTP status only (no body parsing — the backend sends
 * no error body at all).
 */
export function classifyAuthFailure(status: number | null | undefined): AuthFailure {
  if (status === 403) {
    return 'forbidden';
  }
  if (typeof status === 'number' && (status === 0 || status >= 500)) {
    return 'server';
  }
  return 'unauthenticated';
}

/**
 * Builds the login URL tree, carrying the attempted URL so the round-trip can
 * close after a successful login. Angular encodes the query value, producing
 * `/login?returnUrl=%2Fadmin%2Forders`.
 */
export function loginUrlTree(router: Router, returnUrl?: string | null) {
  return router.createUrlTree([LOGIN_PATH], {
    queryParams: returnUrl ? { returnUrl } : {},
  });
}

export function forbiddenUrlTree(router: Router) {
  return router.parseUrl(FORBIDDEN_PATH);
}

export function serverErrorUrlTree(router: Router) {
  return router.parseUrl(SERVER_ERROR_PATH);
}

/**
 * Maps a thrown HTTP failure to the guard result the router must apply.
 */
export function redirectForFailure(
  router: Router,
  error: unknown,
  attemptedUrl?: string,
): RedirectCommand {
  const failure = classifyAuthFailure(statusOf(error));

  if (failure === 'forbidden') {
    return new RedirectCommand(forbiddenUrlTree(router));
  }
  if (failure === 'server') {
    return new RedirectCommand(serverErrorUrlTree(router));
  }
  return new RedirectCommand(loginUrlTree(router, attemptedUrl));
}

/**
 * Accepts a `returnUrl` query value only when it is an internal, non-login path.
 * Rejects absolute URLs, protocol-relative URLs (`//evil.com`) and the login
 * screen itself (which would cause a redirect loop).
 */
export function resolveReturnUrl(raw: string | null | undefined): string | null {
  if (!raw) {
    return null;
  }

  const candidate = raw.trim();
  if (!candidate.startsWith('/') || candidate.startsWith('//')) {
    return null;
  }
  if (
    candidate === LOGIN_PATH ||
    candidate.startsWith(`${LOGIN_PATH}?`) ||
    candidate.startsWith(`${LOGIN_PATH}/`)
  ) {
    return null;
  }
  return candidate;
}

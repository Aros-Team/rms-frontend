import { HttpErrorResponse } from '@angular/common/http';

/**
 * Shape of the backend's RFC 7807 error body.
 *
 * `GlobalExceptionHandler` always sets `type`, `title`, `status` and `detail`.
 * Bean-validation failures collapse the first field error into
 * `detail` as `"<field>: <message>"`; settings domain failures are plain prose.
 */
export interface ProblemDetail {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
}

const DEFAULT_MESSAGE = 'No se pudo completar la operación. Inténtalo de nuevo.';

/**
 * Extracts a user-facing message from an error response.
 *
 * Prefers `detail` (the backend's human-readable explanation), then `title`,
 * then the generic fallback. Never leaks an HTML body or a raw stack trace.
 */
export function problemMessage(error: unknown, fallback = DEFAULT_MESSAGE): string {
  const body = problemBody(error);
  const detail = typeof body?.detail === 'string' ? body.detail.trim() : '';
  if (detail.length > 0) return detail;

  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  if (title.length > 0) return title;

  return fallback;
}

/** HTTP status of the failure, or `null` for a transport/unknown error. */
export function problemStatus(error: unknown): number | null {
  return error instanceof HttpErrorResponse ? error.status : null;
}

/**
 * Splits a bean-validation `detail` (`"field: message"`) into its parts.
 *
 * Returns `null` when the message is not field-scoped. The caller decides
 * whether the field is one of its controls; unknown fields fall back to the
 * banner so the message is never lost.
 */
export function problemFieldError(
  error: unknown,
): { field: string; message: string } | null {
  const detail = problemMessage(error, '');
  const match = /^([A-Za-z][A-Za-z0-9_]*)\s*:\s*(.+)$/.exec(detail);
  if (match === null) return null;
  return { field: match[1], message: match[2].trim() };
}

/** Safely reads the problem body from an `HttpErrorResponse`. */
function problemBody(error: unknown): ProblemDetail | null {
  if (!(error instanceof HttpErrorResponse)) return null;
  const body: unknown = error.error;
  if (body === null || typeof body !== 'object') return null;
  return body as ProblemDetail;
}

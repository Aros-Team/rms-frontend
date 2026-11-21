/**
 * Extracts the human-readable message from an RFC-7807 error body.
 *
 * The backend has two coexisting error contracts:
 *  - application errors carry a JSON body
 *    `{ detail, instance, status, title }` (e.g. an invalid login attempts
 *    returns `detail: "Credenciales inválidas. Verifique su correo..."`);
 *  - filter-level failures (unauthenticated at the security chain) are
 *    **bodiless** (`Content-Length: 0`), so there is nothing to read.
 *
 * Presentation layers use this helper to prefer the server's `detail` over a
 * hard-coded generic message, and fall back to their own text when the server
 * sent nothing usable.
 *
 * Safety: `detail` is server-controlled text. It is returned verbatim for
 * rendering as **text** (PrimeNG `MessageService`, interpolated `textContent`);
 * it must never be injected as HTML. Bodies that look like markup (an HTML
 * error page from a proxy, for instance) are rejected outright so raw markup
 * can never reach the DOM.
 */
import { HttpErrorResponse } from '@angular/common/http';

/** Longest server message we forward; anything longer is truncated. */
const MAX_DETAIL_LENGTH = 300;

/** `tag` or `</tag ...>` — a cheap "this body is markup" signal. */
const MARKUP_PATTERN = /<[a-z!/]/i;

/**
 * Returns the trimmed `detail` of an RFC-7807 problem body, or `null` when the
 * error has no usable problem detail.
 *
 * Handles, without throwing:
 *  - `null`/`undefined`/non-`HttpErrorResponse` errors → `null`
 *  - bodiless errors (`err.error` is `null`, `undefined` or `''`) → `null`
 *  - non-object bodies (strings, numbers, arrays) → `null`
 *  - HTML bodies (proxy/error pages) → `null`
 *  - bodies without `detail`, or with a blank/non-string `detail` → `null`
 */
export function extractProblemDetail(err: unknown): string | null {
  const body = readErrorBody(err);
  if (body === null) return null;

  const detail = body['detail'];
  if (typeof detail !== 'string') return null;

  const trimmed = detail.trim();
  if (trimmed.length === 0) return null;
  if (MARKUP_PATTERN.test(trimmed)) return null;

  return trimmed.length > MAX_DETAIL_LENGTH
    ? `${trimmed.slice(0, MAX_DETAIL_LENGTH).trimEnd()}…`
    : trimmed;
}

/**
 * Digs the response body out of the error, accepting both a real
 * `HttpErrorResponse` and a bare `{ error: <body> }` shape (tests and a few
 * legacy call sites pass the latter).
 */
function readErrorBody(err: unknown): Record<string, unknown> | null {
  if (err === null || typeof err !== 'object') return null;

  const rawBody: unknown = err instanceof HttpErrorResponse
    ? (err.error as unknown)
    : (err as { error?: unknown }).error;

  if (rawBody === null || typeof rawBody !== 'object' || Array.isArray(rawBody)) {
    return null;
  }

  return rawBody as Record<string, unknown>;
}

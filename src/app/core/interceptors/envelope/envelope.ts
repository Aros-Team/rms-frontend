import { HttpEvent, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { map } from 'rxjs';

/**
 * Tolerant response-envelope unwrapping at the wire boundary.
 *
 * The backend wraps every successful payload as `{"data": <payload>}`
 * (sometimes with siblings: `{"data": …, "meta": …}` / `{"data": …, "pagination": …}`),
 * while the OpenAPI document still advertises flat payloads. Services therefore
 * keep reading the flat shape and the unwrapping happens exactly once, here,
 * instead of in ~120 call sites.
 *
 * Contract (never throws, never guesses):
 *  - body is a plain object AND owns a `data` key → emit `body.data`
 *    (extra sibling keys such as `meta` / `pagination` do not block it);
 *  - body has no `data` key → emitted untouched (safe if the backend rolls
 *    the envelope back);
 *  - non-object bodies (string, number, boolean, array, `Blob`, `ArrayBuffer`,
 *    typed arrays, streams, `FormData`, `null`) → untouched;
 *  - empty bodies (`204 No Content` → `null`) stay `null`;
 *  - `HttpErrorResponse` bodies are never touched: errors bypass `map` entirely,
 *    so the error interceptor keeps branching on status alone.
 *
 * Placement: registered LAST in `withInterceptors([...])`, i.e. closest to the
 * network. Responses flow back through it first, and `errorInterceptor`'s
 * refresh-and-replay calls `next()`, which re-enters this same interceptor —
 * so the replayed response is unwrapped exactly once as well.
 */

/** Body shapes that must never be treated as an envelope. */
function isNonEnvelopeBody(body: unknown): boolean {
  if (typeof Blob !== 'undefined' && body instanceof Blob) return true;
  if (typeof ArrayBuffer !== 'undefined' && body instanceof ArrayBuffer) return true;
  if (ArrayBuffer.isView(body)) return true;
  if (typeof FormData !== 'undefined' && body instanceof FormData) return true;
  if (typeof ReadableStream !== 'undefined' && body instanceof ReadableStream) return true;
  return false;
}

function isEnveloped(body: unknown): body is { data: unknown } {
  if (body === null || typeof body !== 'object') return false;
  if (Array.isArray(body)) return false;
  if (isNonEnvelopeBody(body)) return false;
  return Object.prototype.hasOwnProperty.call(body, 'data');
}

/** Returns the unwrapped body, or the original body when it is not enveloped. */
export function unwrapEnvelope<T>(body: T): T {
  return isEnveloped(body) ? (body.data as T) : body;
}

export const envelopeInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    map((event: HttpEvent<unknown>): HttpEvent<unknown> => {
      if (!(event instanceof HttpResponse)) return event;
      const body = event.body;
      if (!isEnveloped(body)) return event;
      return event.clone({ body: body.data });
    }),
  );

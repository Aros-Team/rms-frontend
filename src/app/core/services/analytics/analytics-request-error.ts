import { HttpErrorResponse } from '@angular/common/http';

/**
 * Analytics HTTP failure that preserves the status and the RFC 7807 body.
 *
 * `ResourceCache` stores `Error` instances; Angular's `HttpErrorResponse` is
 * not an `Error`, so its status and problem body would be lost if the cache
 * stringified it. The cache wrappers convert every failure to this class, which
 * `describeAnalyticsError` understands.
 */
export class AnalyticsRequestError extends Error {
  constructor(
    readonly status: number | null,
    readonly body: unknown,
  ) {
    super(messageFor(status, body));
    this.name = 'AnalyticsRequestError';
  }
}

/** Normalizes anything thrown by HttpClient into an `AnalyticsRequestError`. */
export function toAnalyticsRequestError(error: unknown): AnalyticsRequestError {
  if (error instanceof AnalyticsRequestError) return error;
  if (error instanceof HttpErrorResponse) {
    return new AnalyticsRequestError(error.status, error.error as unknown);
  }
  if (error instanceof Error) {
    return new AnalyticsRequestError(null, null);
  }
  return new AnalyticsRequestError(null, error);
}

function messageFor(status: number | null, body: unknown): string {
  if (body !== null && typeof body === 'object') {
    const detail = (body as { detail?: unknown }).detail;
    if (typeof detail === 'string' && detail.trim().length > 0) return detail;
  }
  if (status === 403) return 'Sin permiso para consultar la analítica.';
  if (status === 0) return 'No se pudo contactar al servidor.';
  return status === null ? 'No se pudieron cargar los datos.' : `Error ${String(status)}`;
}

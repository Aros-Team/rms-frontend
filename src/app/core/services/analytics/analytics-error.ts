import { HttpErrorResponse } from '@angular/common/http';

import { AnalyticsRequestError } from '@app/core/services/analytics/analytics-request-error';
import { extractProblemDetail } from '@app/shared/lib/problem-detail/problem-detail';

/** Normalized, Spanish-facing description of a failed analytics request. */
export interface AnalyticsErrorInfo {
  title: string;
  detail: string;
  forbidden: boolean;
  status: number | null;
}

const DEFAULT_TITLE = 'No se pudieron cargar los datos';
const DEFAULT_DETAIL = 'Revisa tu conexión e inténtalo de nuevo.';

/**
 * Turns any HTTP failure into the copy the analytics screens render.
 *
 * RFC 7807 bodies carry the server `detail`; it is reused verbatim as text
 * (never as HTML). A 403 becomes an explicit no-permission state instead of a
 * generic error, and a transport failure gets a retry-friendly sentence.
 */
export function describeAnalyticsError(error: unknown): AnalyticsErrorInfo {
  const status = readStatus(error);

  if (status === 403) {
    return {
      title: 'Sin permiso',
      detail: 'Tu rol no tiene acceso a la analítica del restaurante.',
      forbidden: true,
      status,
    };
  }

  if (status === 0) {
    return {
      title: 'Sin conexión',
      detail: 'No se pudo contactar al servidor. Revisa tu conexión e inténtalo de nuevo.',
      forbidden: false,
      status,
    };
  }

  const serverDetail =
    error instanceof AnalyticsRequestError
      ? extractProblemDetail({ error: error.body })
      : extractProblemDetail(error);
  return {
    title: DEFAULT_TITLE,
    detail:
      serverDetail ?? (error instanceof Error && error.message ? error.message : DEFAULT_DETAIL),
    forbidden: false,
    status,
  };
}

function readStatus(error: unknown): number | null {
  if (error instanceof AnalyticsRequestError) return error.status;
  if (error instanceof HttpErrorResponse) return error.status;
  if (error !== null && typeof error === 'object') {
    const status = (error as { status?: unknown }).status;
    if (typeof status === 'number') return status;
  }
  return null;
}

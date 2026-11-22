import { HttpErrorResponse } from '@angular/common/http';

import { extractProblemDetail } from '@app/shared/lib/problem-detail/problem-detail';

/**
 * Payments-specific RFC-7807 helpers.
 *
 * The payments backend extends the problem body with `paymentId` on
 * `409 OrderAlreadyPaid` so the cashier can open the existing receipt instead
 * of retrying a charge that will never succeed.
 */

/** Reads the `paymentId` extension from a problem body, when present. */
export function extractPaymentId(err: unknown): number | null {
  if (!(err instanceof HttpErrorResponse)) return null;
  const body: unknown = err.error;
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return null;

  const value = (body as Record<string, unknown>)['paymentId'];
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value;
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }
  return null;
}

/** HTTP status of an error, or `null` for non-HTTP failures. */
export function httpStatus(err: unknown): number | null {
  return err instanceof HttpErrorResponse ? err.status : null;
}

/**
 * Message shown to the cashier: the server `detail` when it exists, otherwise
 * the caller's Spanish fallback.
 */
export function paymentErrorMessage(err: unknown, fallback: string): string {
  return extractProblemDetail(err) ?? fallback;
}

/**
 * True when the problem is a shift-state conflict (`409` without a payment
 * extension), which the UI resolves by opening or refreshing the shift.
 * Kept deliberately coarse: the backend detail distinguishes "no shift" from
 * "shift closed", and both lead to the shift dialog.
 */
export function isShiftConflict(err: unknown): boolean {
  return err instanceof HttpErrorResponse && err.status === 409 && extractPaymentId(err) === null;
}

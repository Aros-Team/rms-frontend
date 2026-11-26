/**
 * Tests for the payments RFC-7807 helpers.
 *
 * Feature: read the server ProblemDetail and the `paymentId` extension that the
 * payments backend adds to `409 OrderAlreadyPaid`.
 * Contract:
 *  - `paymentId` is read from numeric and numeric-string values, only for
 *    positive integers;
 *  - non-HTTP inputs, bodiless bodies and invalid extensions return null;
 *  - the UI message prefers the server `detail` and falls back otherwise;
 *  - a 409 without `paymentId` is treated as a shift conflict.
 *
 * Approach: build real `HttpErrorResponse` instances and assert the exact result.
 */
import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';

import {
  extractPaymentId,
  httpStatus,
  isShiftConflict,
  paymentErrorMessage,
} from './payment-problem';

function httpError(status: number, body: unknown): HttpErrorResponse {
  return new HttpErrorResponse({ status, statusText: 'Error', error: body });
}

describe('extractPaymentId', () => {
  it('reads a numeric paymentId', () => {
    expect(extractPaymentId(httpError(409, { detail: 'Ya pagado', paymentId: 9001 }))).toBe(9001);
  });

  it('reads a numeric-string paymentId', () => {
    expect(extractPaymentId(httpError(409, { paymentId: '9001' }))).toBe(9001);
  });

  it('ignores zero, negatives, decimals and garbage', () => {
    expect(extractPaymentId(httpError(409, { paymentId: 0 }))).toBeNull();
    expect(extractPaymentId(httpError(409, { paymentId: -3 }))).toBeNull();
    expect(extractPaymentId(httpError(409, { paymentId: 1.5 }))).toBeNull();
    expect(extractPaymentId(httpError(409, { paymentId: 'nope' }))).toBeNull();
  });

  it('returns null for bodiless, array and non-HTTP inputs', () => {
    expect(extractPaymentId(httpError(409, null))).toBeNull();
    expect(extractPaymentId(httpError(409, [1, 2]))).toBeNull();
    expect(extractPaymentId(new Error('offline'))).toBeNull();
    expect(extractPaymentId('boom')).toBeNull();
  });
});

describe('paymentErrorMessage', () => {
  it('prefers the server detail', () => {
    const error = httpError(409, { detail: 'El pedido 12 ya fue pagado con el pago 9001' });

    expect(paymentErrorMessage(error, 'Fallback')).toBe(
      'El pedido 12 ya fue pagado con el pago 9001',
    );
  });

  it('falls back when the server sent no detail', () => {
    expect(paymentErrorMessage(httpError(400, null), 'No se pudo cobrar.')).toBe(
      'No se pudo cobrar.',
    );
  });
});

describe('httpStatus', () => {
  it('reads the status from an HTTP error', () => {
    expect(httpStatus(httpError(409, null))).toBe(409);
  });

  it('returns null for non-HTTP failures', () => {
    expect(httpStatus(new Error('offline'))).toBeNull();
  });
});

describe('isShiftConflict', () => {
  it('treats a 409 without paymentId as a shift conflict', () => {
    expect(isShiftConflict(httpError(409, { detail: 'No hay un turno de caja abierto; abre la caja antes de cobrar' }))).toBe(true);
  });

  it('does not treat an already-paid 409 as a shift conflict', () => {
    expect(isShiftConflict(httpError(409, { detail: 'Ya pagado', paymentId: 7 }))).toBe(false);
  });

  it('is false for other statuses', () => {
    expect(isShiftConflict(httpError(400, { detail: 'Invalid' }))).toBe(false);
  });
});

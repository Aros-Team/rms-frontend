/**
 * Tests for the RFC 7807 error helpers.
 *
 * Feature: one place that turns a settings failure into user copy.
 * Contract:
 *  - `detail` wins over `title`; a generic fallback is used when neither exists;
 *  - a bean-validation `"field: message"` detail is split into field + message;
 *  - non-HTTP errors and non-object bodies never throw and never leak the body;
 *  - the status is read from the `HttpErrorResponse`.
 *
 * Approach: construct real `HttpErrorResponse` instances with problem bodies.
 */
import { HttpErrorResponse } from '@angular/common/http';

import { problemFieldError, problemMessage, problemStatus } from './problem-detail';

function response(status: number, error: unknown): HttpErrorResponse {
  return new HttpErrorResponse({ status, error });
}

describe('problem-detail', () => {
  it('prefers detail over title', () => {
    const error = response(400, {
      type: 'about:blank',
      title: 'Bad Request',
      status: 400,
      detail: 'La zona horaria no es válida',
    });

    expect(problemMessage(error)).toBe('La zona horaria no es válida');
  });

  it('falls back to title and then to the caller message', () => {
    expect(problemMessage(response(404, { title: 'Not Found' }))).toBe('Not Found');
    expect(problemMessage(response(500, {}), 'Error propio')).toBe('Error propio');
    expect(problemMessage(new Error('boom'), 'Error propio')).toBe('Error propio');
  });

  it('splits a bean-validation detail into field and message', () => {
    const error = response(400, {
      detail: 'restaurantName: Restaurant name is required',
    });

    expect(problemFieldError(error)).toEqual({
      field: 'restaurantName',
      message: 'Restaurant name is required',
    });
  });

  it('does not invent a field for prose details', () => {
    const error = response(409, {
      detail: 'El grupo ya tiene entradas',
    });

    expect(problemFieldError(error)).toBeNull();
  });

  it('reads the status from the HTTP error', () => {
    expect(problemStatus(response(409, {}))).toBe(409);
    expect(problemStatus(new Error('boom'))).toBeNull();
  });
});

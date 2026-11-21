/**
 * Tests for `extractProblemDetail`.
 *
 * Feature: surfaces the server's RFC-7807 `detail` string for presentation
 * layers, tolerating every error shape the backend/proxies can produce.
 * Contract:
 *  - well-formed problem body (`{ detail, instance, status, title }`) → `detail`
 *  - bodiless error (`err.error === null` / `undefined` / `''`) → `null`
 *  - non-object body (string, number, array) → `null`
 *  - blank or non-string `detail` → `null`
 *  - HTML body / HTML-looking `detail` → `null` (never render raw markup)
 *  - `detail` is trimmed; a bare `{ error: body }` shape also works
 *
 * Approach: build real `HttpErrorResponse` instances (no mocks), assert exact
 * return values. Pure function — no TestBed needed.
 */
import { HttpErrorResponse } from '@angular/common/http';

import { extractProblemDetail } from './problem-detail';

/** Builds the error the way the backend delivers it. */
function errorResponse(body: unknown, status = 401): HttpErrorResponse {
  return new HttpErrorResponse({ status, statusText: 'Unauthorized', error: body });
}

describe('extractProblemDetail', () => {
  it('returns the detail of a well-formed problem body', () => {
    const err = errorResponse({
      detail: 'Credenciales inválidas. Verifique su correo electrónico y contraseña',
      instance: '/api/auth/login',
      status: 401,
      title: 'Unauthorized',
    });

    expect(extractProblemDetail(err)).toBe(
      'Credenciales inválidas. Verifique su correo electrónico y contraseña',
    );
  });

  it('trims surrounding whitespace from the detail', () => {
    const err = errorResponse({ detail: '  Token expirado  ', status: 400, title: 'Bad Request' });

    expect(extractProblemDetail(err)).toBe('Token expirado');
  });

  it('returns null for a bodiless 401 (filter-level, Content-Length: 0)', () => {
    expect(extractProblemDetail(errorResponse(null))).toBeNull();
    expect(extractProblemDetail(errorResponse(''))).toBeNull();
    expect(extractProblemDetail(new HttpErrorResponse({ status: 401 }))).toBeNull();
  });

  it('returns null for non-object bodies', () => {
    expect(extractProblemDetail(errorResponse('Unauthorized'))).toBeNull();
    expect(extractProblemDetail(errorResponse(401))).toBeNull();
    expect(extractProblemDetail(errorResponse(['detail', 'nope']))).toBeNull();
  });

  it('returns null when detail is missing, blank or not a string', () => {
    expect(extractProblemDetail(errorResponse({ status: 401, title: 'Unauthorized' }))).toBeNull();
    expect(extractProblemDetail(errorResponse({ detail: '   ' }))).toBeNull();
    expect(extractProblemDetail(errorResponse({ detail: 42 }))).toBeNull();
    expect(extractProblemDetail(errorResponse({ detail: null }))).toBeNull();
  });

  it('returns null for an HTML body instead of leaking raw markup', () => {
    const html = '<!doctype html><html><body><h1>502 Bad Gateway</h1></body></html>';

    expect(extractProblemDetail(errorResponse(html, 502))).toBeNull();
  });

  it('returns null when the detail itself contains markup', () => {
    expect(extractProblemDetail(errorResponse({ detail: '<img src=x onerror=alert(1)>' }))).toBeNull();
    expect(extractProblemDetail(errorResponse({ detail: 'Error <b>grave</b>' }))).toBeNull();
  });

  it('returns null for nullish and non-error inputs', () => {
    expect(extractProblemDetail(null)).toBeNull();
    expect(extractProblemDetail(undefined)).toBeNull();
    expect(extractProblemDetail('boom')).toBeNull();
  });

  it('reads a bare { error: body } shape too', () => {
    expect(extractProblemDetail({ status: 422, error: { detail: 'Datos inválidos' } })).toBe('Datos inválidos');
  });

  it('truncates an over-long detail to 300 characters', () => {
    const long = 'a'.repeat(500);

    const result = extractProblemDetail(errorResponse({ detail: long }));

    expect(result).toBe(`${'a'.repeat(300)}…`);
  });
});

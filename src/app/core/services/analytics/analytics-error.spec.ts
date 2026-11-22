/**
 * Tests for the analytics error mapper.
 *
 * Feature: ProblemDetail detail, no-permission state and transport failures.
 * Contract: the server `detail` is reused as text; 403 becomes forbidden.
 * Approach: build a real HttpErrorResponse and an AnalyticsRequestError.
 */
import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';

import { describeAnalyticsError } from './analytics-error';
import { AnalyticsRequestError } from './analytics-request-error';

describe('describeAnalyticsError', () => {
  it('keeps the RFC 7807 detail from a real HttpErrorResponse', () => {
    const error = new HttpErrorResponse({
      status: 422,
      error: { type: '/analytics/invalid-range', title: 'Invalid range', detail: 'to < from' },
    });
    const info = describeAnalyticsError(error);
    expect(info.detail).toBe('to < from');
    expect(info.forbidden).toBe(false);
    expect(info.status).toBe(422);
  });

  it('renders a no-permission state for 403', () => {
    const info = describeAnalyticsError(new HttpErrorResponse({ status: 403 }));
    expect(info.forbidden).toBe(true);
    expect(info.title).toBe('Sin permiso');
  });

  it('reads the preserved problem body from AnalyticsRequestError', () => {
    const error = new AnalyticsRequestError(422, { detail: 'bucket=monthly but from is not YYYY-MM' });
    expect(describeAnalyticsError(error).detail).toBe('bucket=monthly but from is not YYYY-MM');
  });

  it('falls back to a retry-friendly sentence for transport failures', () => {
    const info = describeAnalyticsError(new AnalyticsRequestError(0, null));
    expect(info.title).toBe('Sin conexión');
    expect(info.detail).toContain('No se pudo contactar');
  });
});

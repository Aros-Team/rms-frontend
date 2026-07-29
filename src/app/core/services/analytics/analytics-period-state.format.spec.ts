import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AnalyticsPeriodState } from './analytics-period-state';

// These tests validate that the period format matches the backend's
// GetPrimeCostService.validateRange() rules. The backend expects YYYY-MM
// for the monthly bucket. A mismatch here is what produced the 400 errors
// in the original bug report.
describe('AnalyticsPeriodState — formats match backend validation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2026, 6, 17)));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('emits YYYY-MM format for monthly buckets', () => {
    const state = new AnalyticsPeriodState();

    expect(state.from()).toBe('2026-02');
    expect(state.to()).toBe('2026-07');
    expect(state.from()).toMatch(/^\d{4}-\d{2}$/);
    expect(state.to()).toMatch(/^\d{4}-\d{2}$/);
  });

  it('always produces from <= to', () => {
    const state = new AnalyticsPeriodState();
    expect(state.from() <= state.to()).toBe(true);
  });
});

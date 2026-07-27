import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AnalyticsPeriodState } from './analytics-period-state';

// These tests validate that the period format matches the backend's
// GetPrimeCostService.validateRange() rules. If the backend says
// "daily needs YYYY-MM-DD", the frontend MUST generate YYYY-MM-DD for daily.
// A mismatch here is what produced the 400 errors in the original bug report.
describe('AnalyticsPeriodState — formats match backend validation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2026, 6, 17)));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('bucket=daily', () => {
    it('emits ISO date format YYYY-MM-DD (backend rejects YYYY-MM for daily)', () => {
      const state = new AnalyticsPeriodState();
      state.setBucket('daily');

      expect(state.from()).toBe('2026-06-18');
      expect(state.to()).toBe('2026-07-17');

      // Backend GetPrimeCostService.validateRange('daily', ...) parses with
      // DateTimeFormatter.ISO_LOCAL_DATE — YYYY-MM-DD is the only accepted shape.
      const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
      expect(state.from()).toMatch(ISO_DATE);
      expect(state.to()).toMatch(ISO_DATE);
    });
  });

  describe('bucket=weekly', () => {
    it('emits ISO week format YYYY-Www', () => {
      const state = new AnalyticsPeriodState();
      state.setBucket('weekly');

      const ISO_WEEK = /^\d{4}-W\d{2}$/;
      expect(state.from()).toMatch(ISO_WEEK);
      expect(state.to()).toMatch(ISO_WEEK);
    });
  });

  describe('bucket=monthly', () => {
    it('emits YYYY-MM format', () => {
      const state = new AnalyticsPeriodState();
      state.setBucket('monthly');

      expect(state.from()).toBe('2026-02');
      expect(state.to()).toBe('2026-07');
      expect(state.from()).toMatch(/^\d{4}-\d{2}$/);
      expect(state.to()).toMatch(/^\d{4}-\d{2}$/);
    });
  });

  describe('bucket=yearly', () => {
    it('emits YYYY format', () => {
      const state = new AnalyticsPeriodState();
      state.setBucket('yearly');

      expect(state.from()).toBe('2024');
      expect(state.to()).toBe('2026');
      expect(state.from()).toMatch(/^\d{4}$/);
      expect(state.to()).toMatch(/^\d{4}$/);
    });
  });

  describe('range ordering', () => {
    it('always produces from <= to regardless of bucket', () => {
      const state = new AnalyticsPeriodState();
      for (const bucket of ['daily', 'weekly', 'monthly', 'yearly'] as const) {
        state.setBucket(bucket);
        expect(
          state.from() <= state.to(),
          `from (${state.from()}) should be <= to (${state.to()}) for bucket=${bucket}`,
        ).toBe(true);
      }
    });
  });
});

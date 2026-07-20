import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AnalyticsPeriodState } from './analytics-period-state';

describe('AnalyticsPeriodState', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2026, 6, 17)));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('defaults', () => {
    it('initializes with bucket=monthly and a 6-month range ending at the current month', () => {
      const state = new AnalyticsPeriodState();

      expect(state.bucket()).toBe('monthly');
      expect(state.from()).toBe('2026-02');
      expect(state.to()).toBe('2026-07');
    });

    it('exposes the period as a computed signal that mirrors bucket/from/to', () => {
      const state = new AnalyticsPeriodState();

      expect(state.period()).toEqual({
        bucket: state.bucket(),
        from: state.from(),
        to: state.to(),
      });
      expect(state.period()).toEqual({ bucket: 'monthly', from: '2026-02', to: '2026-07' });
    });
  });

  describe('setBucket', () => {
    it('updates the bucket signal', () => {
      const state = new AnalyticsPeriodState();

      state.setBucket('yearly');
      expect(state.bucket()).toBe('yearly');
    });

    it('updates from/to to the current 6-month range when bucket changes', () => {
      const state = new AnalyticsPeriodState();

      state.setRange('2020-01', '2020-12');
      state.setBucket('yearly');

      expect(state.from()).toBe('2026-02');
      expect(state.to()).toBe('2026-07');
    });
  });

  describe('setRange', () => {
    it('updates from/to signals with the supplied values', () => {
      const state = new AnalyticsPeriodState();

      state.setRange('2026-01', '2026-07');

      expect(state.from()).toBe('2026-01');
      expect(state.to()).toBe('2026-07');
      expect(state.period().from).toBe('2026-01');
      expect(state.period().to).toBe('2026-07');
    });

    it('does not change the bucket signal', () => {
      const state = new AnalyticsPeriodState();

      state.setRange('2026-01', '2026-07');
      expect(state.bucket()).toBe('monthly');
    });
  });

  describe('reset', () => {
    it('restores defaults after manual mutations', () => {
      const state = new AnalyticsPeriodState();

      state.setBucket('weekly');
      state.setRange('2020-01', '2020-12');
      state.reset();

      expect(state.period()).toEqual({ bucket: 'monthly', from: '2026-02', to: '2026-07' });
    });
  });
});
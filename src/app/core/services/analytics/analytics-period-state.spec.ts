/**
 * Tests for the AnalyticsPeriodState service.
 *
 * Feature: Manages analytics period selection state with signals and persistence.
 * Contract: Tracks current period, supports quick ranges and custom dates, persists to localStorage.
 * Approach: Inject service via TestBed, manipulate period state, assert signal values.
 */
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
    it('initializes with a 6-month range ending at the current month', () => {
      const state = new AnalyticsPeriodState();

      expect(state.from()).toBe('2026-02');
      expect(state.to()).toBe('2026-07');
    });

    it('exposes the period as a computed signal that mirrors from/to', () => {
      const state = new AnalyticsPeriodState();

      expect(state.period()).toEqual({
        from: state.from(),
        to: state.to(),
      });
      expect(state.period()).toEqual({ from: '2026-02', to: '2026-07' });
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
  });

  describe('reset', () => {
    it('restores defaults after manual mutations', () => {
      const state = new AnalyticsPeriodState();

      state.setRange('2020-01', '2020-12');
      state.reset();

      expect(state.period()).toEqual({ from: '2026-02', to: '2026-07' });
    });
  });
});

/**
 * Tests for the shared analytics period state.
 *
 * Feature: one bucket + range shared by the five sections.
 * Contract: defaults are monthly/last six months, bucket changes apply that
 * bucket's default preset, manual ranges are marked custom and reset restores
 * the defaults.
 * Approach: instantiate the service with a frozen clock.
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

  it('starts monthly with the last six months', () => {
    const state = new AnalyticsPeriodState();
    expect(state.bucket()).toBe('monthly');
    expect(state.period()).toEqual({ bucket: 'monthly', from: '2026-02', to: '2026-07' });
    expect(state.preset()).toBe('last-6');
  });

  it('derives the label from the applied keys so it cannot drift', () => {
    const state = new AnalyticsPeriodState();
    expect(state.label()).toContain('2026');
    expect(state.label()).toContain('febrero');
    state.setRange('2026-01', '2026-03');
    expect(state.label()).toContain('enero');
    expect(state.label()).toContain('marzo');
  });

  it('switches bucket and moves to that bucket default preset', () => {
    const state = new AnalyticsPeriodState();
    state.setBucket('daily');
    expect(state.bucket()).toBe('daily');
    expect(state.preset()).toBe('last-30');
    expect(state.from()).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    state.setBucket('yearly');
    expect(state.bucket()).toBe('yearly');
    expect(state.preset()).toBe('last-3');
    expect(state.period()).toEqual({ bucket: 'yearly', from: '2024', to: '2026' });
  });

  it('applies a preset by id', () => {
    const state = new AnalyticsPeriodState();
    state.applyPreset('last-3');
    expect(state.from()).toBe('2026-05');
    expect(state.to()).toBe('2026-07');
    expect(state.preset()).toBe('last-3');
  });

  it('marks a manual range as custom', () => {
    const state = new AnalyticsPeriodState();
    state.setRange('2026-01', '2026-03');
    expect(state.preset()).toBe('custom');
    expect(state.period()).toEqual({ bucket: 'monthly', from: '2026-01', to: '2026-03' });
  });

  it('reset returns to monthly last six months', () => {
    const state = new AnalyticsPeriodState();
    state.setBucket('daily');
    state.setRange('2020-01-01', '2020-02-01');
    state.reset();
    expect(state.period()).toEqual({ bucket: 'monthly', from: '2026-02', to: '2026-07' });
    expect(state.preset()).toBe('last-6');
  });

  it('bumps the revision signal used by uncached sections', () => {
    const state = new AnalyticsPeriodState();
    expect(state.revision()).toBe(0);
    state.requestRevision();
    expect(state.revision()).toBe(1);
  });
});

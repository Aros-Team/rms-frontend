/**
 * Tests for the shared period selector.
 *
 * Feature: bucket, preset and manual range over one period state.
 * Contract: the collapsed label is derived from the applied keys (F-014), the
 * docked toggle exposes aria-expanded, and apply/reset update the shared state.
 * Approach: mount the component with the real state under a frozen clock.
 */
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { AnalyticsPeriodState } from '@app/core/services/analytics/analytics-period-state';

import { PeriodSelector } from './period-selector';
import selectorHtmlRaw from './period-selector.html?raw';
import { resolveTemplates } from '../../testing/analytics-testing';

const selectorHtml = selectorHtmlRaw as string;

describe('PeriodSelector', () => {
  beforeAll(async () => {
    await resolveTemplates({ 'period-selector.html': selectorHtml });
  });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2026, 6, 17)));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function setup(): Promise<{
    fixture: ComponentFixture<PeriodSelector>;
    state: AnalyticsPeriodState;
  }> {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [PeriodSelector],
      providers: [provideRouter([]), AnalyticsPeriodState],
    }).compileComponents();
    const state = TestBed.inject(AnalyticsPeriodState);
    const fixture = TestBed.createComponent(PeriodSelector);
    fixture.componentInstance.setVariant('docked');
    fixture.detectChanges();
    return { fixture, state };
  }

  it('shows the same range it sends to the API', async () => {
    const { fixture, state } = await setup();
    const label = fixture.componentInstance.currentRangeLabel();
    expect(label).toBe(state.label());
    expect(label).toContain('febrero');
    expect(label).toContain('julio');
  });

  it('exposes the expanded state on the dock toggle', async () => {
    const { fixture } = await setup();
    const root = fixture.nativeElement as HTMLElement;
    const toggle = root.querySelector<HTMLButtonElement>('.period-dock__range');
    expect(toggle?.getAttribute('aria-expanded')).toBe('false');
    expect(toggle?.getAttribute('aria-controls')).toBe('period-dock-form');

    toggle?.click();
    fixture.detectChanges();
    expect(root.querySelector('#period-dock-form')).not.toBeNull();
  });

  it('applies a manual range to the shared state', async () => {
    const { fixture, state } = await setup();
    fixture.componentInstance.toggle();
    fixture.detectChanges();

    fixture.componentInstance.onFromChange('2026-01');
    fixture.componentInstance.onToChange('2026-03');
    fixture.componentInstance.apply();

    expect(state.period()).toEqual({ bucket: 'monthly', from: '2026-01', to: '2026-03' });
    expect(state.preset()).toBe('custom');
  });

  it('rejects an inverted range without committing it', async () => {
    const { fixture, state } = await setup();
    fixture.componentInstance.onFromChange('2026-07');
    fixture.componentInstance.onToChange('2026-01');
    fixture.componentInstance.apply();
    expect(state.from()).toBe('2026-02');
    expect(fixture.componentInstance.errorMessage()).toContain('posterior');
  });

  it('changes bucket and preset through the shared state', async () => {
    const { fixture, state } = await setup();
    fixture.componentInstance.onBucketChange('daily');
    expect(state.bucket()).toBe('daily');
    expect(state.preset()).toBe('last-30');

    fixture.componentInstance.onPresetChange('last-7');
    expect(state.preset()).toBe('last-7');
    expect(fixture.componentInstance.from()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('emits refresh for the shell to run the rebuild', async () => {
    const { fixture } = await setup();
    const emitted = vi.fn();
    fixture.componentInstance.refresh.subscribe(emitted);
    fixture.componentInstance.refreshActive();
    expect(emitted).toHaveBeenCalledTimes(1);
  });

  it('reset restores monthly last six months and collapses the dock', async () => {
    const { fixture, state } = await setup();
    fixture.componentInstance.onBucketChange('yearly');
    fixture.componentInstance.reset();
    expect(state.period()).toEqual({ bucket: 'monthly', from: '2026-02', to: '2026-07' });
    expect(fixture.componentInstance.expanded()).toBe(false);
  });
});

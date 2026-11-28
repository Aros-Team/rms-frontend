/**
 * Tests for the Cohort section.
 *
 * Feature: new vs recurring visits, retention chart/table and ticket metrics.
 * Contract: per-bucket rows come from `cohorts[]`, the strategy is surfaced
 * and the ticket values come from the report.
 * Approach: mount with a cache stub over the shared fixture.
 */
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { AnalyticsCache } from '@app/core/services/analytics/analytics-cache';
import { AnalyticsPeriodState } from '@app/core/services/analytics/analytics-period-state';

import { Cohort } from './cohort';
import cohortHtmlRaw from './cohort.html?raw';
import {
  installCanvasContextStub,
  makeCacheStub,
  makeCohortReport,
  resolveTemplates,
} from '../../testing/analytics-testing';

const cohortHtml = cohortHtmlRaw as string;

describe('Cohort', () => {
  beforeAll(async () => {
    installCanvasContextStub();
    await resolveTemplates({ 'cohort.html': cohortHtml });
  });

  async function setup(cache: ReturnType<typeof makeCacheStub>): Promise<ComponentFixture<Cohort>> {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [Cohort],
      providers: [{ provide: AnalyticsCache, useValue: cache }, AnalyticsPeriodState],
    }).compileComponents();
    const fixture = TestBed.createComponent(Cohort);
    fixture.detectChanges();
    return fixture;
  }

  it('loads through the cache effect', async () => {
    const cache = makeCacheStub({ cohort: { data: makeCohortReport() } });
    const load = vi.fn();
    cache.cohort.load = load;
    await setup(cache);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('renders one row per cohort bucket', async () => {
    const fixture = await setup(makeCacheStub({ cohort: { data: makeCohortReport() } }));
    const rows = fixture.componentInstance.rows();
    expect(rows).toHaveLength(2);
    expect(rows[0]?.key).toBe('2026-06');
    expect(rows[0]?.label).toContain('2026');
    expect(rows[0]?.recurringRatePct).toBe(100);
  });

  it('charts new and recurring visits as a stacked bar', async () => {
    const fixture = await setup(makeCacheStub({ cohort: { data: makeCohortReport() } }));
    const chart = fixture.componentInstance.chartData();
    expect(chart.datasets.map((dataset) => dataset.label)).toEqual(['Nuevos', 'Recurrentes']);
    expect(chart.datasets[1]?.data).toEqual([2892, 2635]);
    expect(chart.datasets[0]?.stack).toBe('clients');
  });

  it('labels the fingerprint strategy in Spanish', async () => {
    const fixture = await setup(makeCacheStub({ cohort: { data: makeCohortReport() } }));
    expect(fixture.componentInstance.strategy()).toBe('Solo mesa');
    expect(fixture.componentInstance.strategyTone()).toBe('warning');
    expect(fixture.componentInstance.windowDays()).toBe(90);
  });

  it('keeps partial notes from the API', async () => {
    const fixture = await setup(makeCacheStub({ cohort: { data: makeCohortReport() } }));
    expect(fixture.componentInstance.completeness()).toBe('PARTIAL');
    expect(fixture.componentInstance.notes()).toHaveLength(1);
  });

  it('exports the cohort table', async () => {
    const fixture = await setup(makeCacheStub({ cohort: { data: makeCohortReport() } }));
    const csv = fixture.componentInstance.buildCsv();
    expect(csv).toContain('Total');
    expect(csv).toContain('TABLE_ONLY');
  });

  it('shows the page title and exposes the CSV export', async () => {
    const fixture = await setup(makeCacheStub({ cohort: { data: makeCohortReport() } }));
    const root = fixture.nativeElement as HTMLElement;
    const heading = root.querySelector('h1');
    expect(heading?.textContent.trim()).toBe('Cohortes de clientes');
    expect(heading?.classList.contains('sr-only')).toBe(false);
    const actions = [...root.querySelectorAll('app-rms-page-header app-rms-button')];
    expect(actions.some((button) => button.textContent.includes('Exportar CSV'))).toBe(true);
  });

  it('is empty without a report', async () => {
    const fixture = await setup(makeCacheStub());
    expect(fixture.componentInstance.isEmpty()).toBe(true);
  });
});

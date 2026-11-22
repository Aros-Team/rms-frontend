/**
 * Tests for the Prime Cost section.
 *
 * Feature: period totals, category breakdown, tables and CSV.
 * Contract: KPIs aggregate the whole range (not the latest bucket), money is
 * summed exactly and the chart datasets mirror the series.
 * Approach: mount with a cache stub over the shared fixture.
 */
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { AnalyticsCache } from '@app/core/services/analytics/analytics-cache';
import { AnalyticsPeriodState } from '@app/core/services/analytics/analytics-period-state';
import { AnalyticsRequestError } from '@app/core/services/analytics/analytics-request-error';

import { PrimeCost } from './prime-cost';
import primeCostHtmlRaw from './prime-cost.html?raw';
import {
  installCanvasContextStub,
  makeCacheStub,
  makePrimeCostReport,
  resolveTemplates,
} from '../../testing/analytics-testing';

const primeCostHtml = primeCostHtmlRaw as string;

describe('PrimeCost', () => {
  beforeAll(async () => {
    installCanvasContextStub();
    await resolveTemplates({ 'prime-cost.html': primeCostHtml });
  });

  async function setup(
    cache: ReturnType<typeof makeCacheStub>,
  ): Promise<ComponentFixture<PrimeCost>> {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [PrimeCost],
      providers: [
        { provide: AnalyticsCache, useValue: cache },
        AnalyticsPeriodState,
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(PrimeCost);
    fixture.detectChanges();
    return fixture;
  }

  it('loads through the cache effect', async () => {
    const cache = makeCacheStub({ primeCost: { data: makePrimeCostReport() } });
    const load = vi.fn();
    cache.primeCost.load = load;
    await setup(cache);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('aggregates the whole range into the KPI totals', async () => {
    const fixture = await setup(
      makeCacheStub({ primeCost: { data: makePrimeCostReport() } }),
    );
    const component = fixture.componentInstance;

    expect(component.totals().netSales).toEqual({ amount: '462811600.00', currency: 'COP' });
    expect(component.totals().cogs).toEqual({ amount: '142630794.78', currency: 'COP' });
    expect(component.totals().labor).toEqual({ amount: '67000000.00', currency: 'COP' });
    expect(component.totals().primeCost).toEqual({ amount: '209630794.78', currency: 'COP' });
    expect(component.totals().primeCostPct).toBeCloseTo(45.2951, 3);
    expect(component.totals().grossProfitPct).toBeCloseTo(69.1817, 3);
    expect(component.totals().netProfitPct).toBeCloseTo(54.7049, 3);

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelectorAll('app-rms-stat-tile')).toHaveLength(4);
  });

  it('aggregates COGS by category for the period', async () => {
    const fixture = await setup(
      makeCacheStub({ primeCost: { data: makePrimeCostReport() } }),
    );
    const rows = fixture.componentInstance.cogsRows();
    expect(rows).toHaveLength(4);
    const food = rows.find((row) => row.key === 'FOOD');
    expect(food?.amount).toEqual({ amount: '130789860.50', currency: 'COP' });
    expect(food?.pct).toBeCloseTo(91.7, 1);
  });

  it('builds the sales and margin datasets from the series', async () => {
    const fixture = await setup(
      makeCacheStub({ primeCost: { data: makePrimeCostReport() } }),
    );
    const component = fixture.componentInstance;
    const sales = component.salesData();
    expect(sales.datasets[0]?.label).toBe('Ventas netas');
    expect(sales.datasets[0]?.data).toEqual([240869900, 221941700]);
    expect(sales.datasets[1]?.data).toEqual([240869900, 221941700]);

    const margins = component.marginData();
    expect(margins.datasets.map((dataset) => dataset.label)).toEqual([
      'Costo primo',
      'Margen bruto',
      'Margen neto',
    ]);
    expect(margins.datasets[0]?.data).toEqual([44.84, 45.79]);
  });

  it('renders a data-table fallback in every chart frame', async () => {
    const fixture = await setup(
      makeCacheStub({ primeCost: { data: makePrimeCostReport() } }),
    );
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelectorAll('app-rms-chart-frame')).toHaveLength(3);
    expect(root.querySelectorAll('table caption').length).toBeGreaterThanOrEqual(3);
  });

  it('builds the CSV for the loaded report', async () => {
    const fixture = await setup(
      makeCacheStub({ primeCost: { data: makePrimeCostReport() } }),
    );
    const csv = fixture.componentInstance.buildCsv();
    expect(csv.split('\r\n')[0]).toContain('Ventas netas');
    expect(csv).toContain('2026-06');
  });

  it('shows the ProblemDetail detail on failure', async () => {
    const fixture = await setup(
      makeCacheStub({
        primeCost: {
          data: null,
          error: new AnalyticsRequestError(422, { detail: 'to < from' }),
        },
      }),
    );
    const root = fixture.nativeElement as HTMLElement;
    const notice = root.querySelector('app-analytics-notice');
    expect(notice).not.toBeNull();
    expect(fixture.componentInstance.errorInfo()?.detail).toBe('to < from');
  });

  it('is empty when the report has no series', async () => {
    const empty = makePrimeCostReport({ series: [], dataCompleteness: 'EMPTY' });
    const fixture = await setup(makeCacheStub({ primeCost: { data: empty } }));
    expect(fixture.componentInstance.isEmpty()).toBe(true);
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('app-rms-empty-state')).not.toBeNull();
  });
});

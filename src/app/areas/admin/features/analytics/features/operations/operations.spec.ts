/**
 * Tests for the Operations section.
 *
 * Feature: RevPASH, covers, turns, labor share and previous-period comparison.
 * Contract: KPIs come from the report and the deltas compare against a second
 * request for the previous equivalent range.
 * Approach: mount with current + previous cache stubs.
 */
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { AnalyticsCache } from '@app/core/services/analytics/analytics-cache';
import { AnalyticsPeriodState } from '@app/core/services/analytics/analytics-period-state';

import { Operations } from './operations';
import operationsHtmlRaw from './operations.html?raw';
import {
  installCanvasContextStub,
  makeCacheStub,
  makeOperationsReport,
  resolveTemplates,
} from '../../testing/analytics-testing';

const operationsHtml = operationsHtmlRaw as string;

function previousReport() {
  return makeOperationsReport({
    revPash: {
      value: { amount: '7000.00', currency: 'COP' },
      totalNetSales: { amount: '1000000.00', currency: 'COP' },
      totalAvailableSeatHours: 1000,
    },
    tableTurnover: {
      overall: 2000,
      byDayPart: [{ dayPart: 'LUNCH', turns: 800, covers: 15000, tables: 20 }],
    },
    labor: { totalCost: { amount: '150000.00', currency: 'COP' }, sharePct: 15 },
    covers: 40000,
    avgOccupancyMinutes: 50,
  });
}

describe('Operations', () => {
  beforeAll(async () => {
    installCanvasContextStub();
    await resolveTemplates({ 'operations.html': operationsHtml });
  });

  async function setup(
    cache: ReturnType<typeof makeCacheStub>,
  ): Promise<ComponentFixture<Operations>> {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [Operations],
      providers: [{ provide: AnalyticsCache, useValue: cache }, AnalyticsPeriodState],
    }).compileComponents();
    const fixture = TestBed.createComponent(Operations);
    fixture.detectChanges();
    return fixture;
  }

  it('loads current and previous reports', async () => {
    const cache = makeCacheStub({
      operations: { data: makeOperationsReport() },
      operationsPrevious: { data: previousReport() },
    });
    const currentLoad = vi.fn();
    const previousLoad = vi.fn();
    cache.operations.load = currentLoad;
    cache.operationsPrevious.load = previousLoad;
    await setup(cache);
    expect(currentLoad).toHaveBeenCalledTimes(1);
    expect(previousLoad).toHaveBeenCalledTimes(1);
  });

  it('computes the comparison deltas against the previous range', async () => {
    const fixture = await setup(
      makeCacheStub({
        operations: { data: makeOperationsReport() },
        operationsPrevious: { data: previousReport() },
      }),
    );
    const component = fixture.componentInstance;
    expect(component.revPashDelta().text).toBe('+22,1% vs anterior');
    expect(component.revPashDelta().tone).toBe('positive');
    expect(component.coversDelta().text).toBe('+11,9% vs anterior');
    expect(component.turnsDelta().text).toBe('+11,9% vs anterior');
    expect(component.laborDelta().text).toBe('-1,6 pp vs anterior');
    expect(component.laborDelta().tone).toBe('positive');
    expect(component.occupancyDelta().text).toBe('+21,0% vs anterior');
  });

  it('charts the day-part turns', async () => {
    const fixture = await setup(makeCacheStub({ operations: { data: makeOperationsReport() } }));
    const chart = fixture.componentInstance.chartData();
    expect(chart.labels).toEqual(['Almuerzo', 'Cena', 'Otros']);
    expect(chart.datasets[0]?.data).toEqual([846, 1234.85, 157.05]);
  });

  it('labels the comparison period', async () => {
    const fixture = await setup(makeCacheStub({ operations: { data: makeOperationsReport() } }));
    expect(fixture.componentInstance.previousLabel()).toContain('–');
  });

  it('exports the operations metrics', async () => {
    const fixture = await setup(makeCacheStub({ operations: { data: makeOperationsReport() } }));
    const csv = fixture.componentInstance.buildCsv();
    expect(csv).toContain('RevPASH');
    expect(csv).toContain('Rotacion LUNCH');
  });

  it('shows the page title and exposes the CSV export', async () => {
    const fixture = await setup(makeCacheStub({ operations: { data: makeOperationsReport() } }));
    const root = fixture.nativeElement as HTMLElement;
    const heading = root.querySelector('h1');
    expect(heading?.textContent.trim()).toBe('Eficiencia operativa');
    expect(heading?.classList.contains('sr-only')).toBe(false);
    expect(root.textContent).toContain('Exportar CSV');
  });

  it('is empty without a report', async () => {
    const fixture = await setup(makeCacheStub());
    expect(fixture.componentInstance.isEmpty()).toBe(true);
  });
});

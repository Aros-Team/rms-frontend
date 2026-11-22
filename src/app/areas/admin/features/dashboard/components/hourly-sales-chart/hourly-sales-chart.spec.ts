/**
 * Tests for the dashboard sales-by-hour chart.
 *
 * Feature: the KPI header's decorative strip became a labelled chart.
 * Contract:
 *  - delivered orders are counted per hour (this is a count chart, not money)
 *  - the chart data keeps the hour labels and highlights the current hour
 *  - the summary and empty state are honest when nothing was delivered
 *
 * Approach: instantiate the component, feed bars and assert data/summary.
 */
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { HourlySalesChart, type HourlySalesBar } from './hourly-sales-chart';

function bars(): HourlySalesBar[] {
  return [
    { hour: 8, label: '08:00', delivered: 0, revenue: 0, isCurrent: false },
    { hour: 9, label: '09:00', delivered: 2, revenue: 90000, isCurrent: false },
    { hour: 10, label: '10:00', delivered: 1, revenue: 45000, isCurrent: true },
  ];
}

describe('HourlySalesChart', () => {
  function create(): HourlySalesChart {
    TestBed.resetTestingModule();
    return TestBed.runInInjectionContext(() => new HourlySalesChart());
  }

  it('counts orders and reports the day total', () => {
    const chart = create();
    chart.bars = bars();

    expect(chart.totalOrders).toBe(3);
    expect(chart.data.datasets[0].data).toEqual([0, 2, 1]);
    expect(chart.isEmpty).toBe(false);
  });

  it('keeps every hour label and highlights the current hour', () => {
    const chart = create();
    chart.bars = bars();

    expect(chart.data.labels).toEqual(['08:00', '09:00', '10:00']);
    const colors = chart.data.datasets[0]?.backgroundColor as string[];
    expect(new Set(colors).size).toBe(2);
  });

  it('builds a screen-reader summary only from hours with sales', () => {
    const chart = create();
    chart.bars = bars();

    expect(chart.summary).toContain('09:00');
    expect(chart.summary).toContain('2 pedidos');
    expect(chart.summary).not.toContain('08:00');
  });

  it('marks a day without delivered orders as empty', () => {
    const chart = create();
    chart.bars = [bars()[0]];

    expect(chart.isEmpty).toBe(true);
    expect(chart.summary).toBe('');
  });
});

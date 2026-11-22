/**
 * Tests for the Menu Engineering section.
 *
 * Feature: quadrant matrix, bubble map, item table and refresh.
 * Contract: items are grouped by quadrant, the table derives sell price and
 * margin, and the refresh action calls the shared rebuild.
 * Approach: mount with a cache stub over the shared fixture.
 */
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { AnalyticsCache } from '@app/core/services/analytics/analytics-cache';
import { AnalyticsPeriodState } from '@app/core/services/analytics/analytics-period-state';

import { MenuEngineering } from './menu-engineering';
import menuHtmlRaw from './menu-engineering.html?raw';
import {
  installCanvasContextStub,
  makeCacheStub,
  makeMenuReport,
  resolveTemplates,
} from '../../testing/analytics-testing';

const menuHtml = menuHtmlRaw as string;

describe('MenuEngineering', () => {
  beforeAll(async () => {
    installCanvasContextStub();
    await resolveTemplates({ 'menu-engineering.html': menuHtml });
  });

  async function setup(
    cache: ReturnType<typeof makeCacheStub>,
  ): Promise<ComponentFixture<MenuEngineering>> {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [MenuEngineering],
      providers: [
        { provide: AnalyticsCache, useValue: cache },
        AnalyticsPeriodState,
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(MenuEngineering);
    fixture.detectChanges();
    return fixture;
  }

  it('loads through the cache effect', async () => {
    const cache = makeCacheStub({ menuEngineering: { data: makeMenuReport() } });
    const load = vi.fn();
    cache.menuEngineering.load = load;
    await setup(cache);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('summarises each quadrant with count and contribution', async () => {
    const fixture = await setup(
      makeCacheStub({ menuEngineering: { data: makeMenuReport() } }),
    );
    const summaries = fixture.componentInstance.summaries();
    expect(summaries.map((summary) => summary.quadrant)).toEqual([
      'STAR',
      'PLOWHORSE',
      'PUZZLE',
      'DOG',
    ]);
    expect(summaries.every((summary) => summary.count === 1)).toBe(true);
    expect(summaries[0]?.topItems).toEqual(['Pizza Especial Familiar']);
  });

  it('filters the table by quadrant and category', async () => {
    const fixture = await setup(
      makeCacheStub({ menuEngineering: { data: makeMenuReport() } }),
    );
    const component = fixture.componentInstance;
    component.toggleQuadrant('DOG');
    expect(component.filteredItems().map((item) => item.productId)).toEqual([8]);
    component.toggleQuadrant('DOG');
    component.onCategoryChange(1);
    expect(component.filteredItems()).toHaveLength(4);
    component.onCategoryChange(999);
    expect(component.filteredItems()).toHaveLength(0);
  });

  it('derives sell price and margin percent per item', async () => {
    const fixture = await setup(
      makeCacheStub({ menuEngineering: { data: makeMenuReport() } }),
    );
    const burger = fixture.componentInstance
      .tableRows()
      .find((row) => row.item.productName.includes('Double'));
    expect(burger?.sellPrice).toEqual({ amount: '22670.00', currency: 'COP' });
    expect(burger?.marginPct).toBeCloseTo(64.71, 1);
  });

  it('builds the bubble chart from the filtered items', async () => {
    const fixture = await setup(
      makeCacheStub({ menuEngineering: { data: makeMenuReport() } }),
    );
    const data = fixture.componentInstance.chartData();
    const star = data.datasets.find((dataset) => dataset.label === 'Estrella');
    expect(star?.data).toHaveLength(1);
    expect(star?.data[0]).toMatchObject({ y: 424, name: 'Pizza Especial Familiar' });
  });

  it('calls the shared rebuild on refresh', async () => {
    const cache = makeCacheStub({ menuEngineering: { data: makeMenuReport() } });
    const refreshAll = vi.fn(() => of({ refreshed: true }));
    cache.refreshAll = refreshAll;
    const fixture = await setup(cache);
    fixture.componentInstance.refresh();
    expect(refreshAll).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.refreshing()).toBe(false);
  });

  it('keeps the real dataCompleteness and notes', async () => {
    const report = makeMenuReport({
      dataCompleteness: 'PARTIAL',
      notes: ['Faltan costos de 2 recetas'],
    });
    const fixture = await setup(makeCacheStub({ menuEngineering: { data: report } }));
    expect(fixture.componentInstance.completeness()).toBe('PARTIAL');
    expect(fixture.componentInstance.notes()).toEqual(['Faltan costos de 2 recetas']);
  });

  it('builds the CSV with one row per item', async () => {
    const fixture = await setup(
      makeCacheStub({ menuEngineering: { data: makeMenuReport() } }),
    );
    const lines = fixture.componentInstance.buildCsv().split('\r\n');
    expect(lines[0]).toContain('Cuadrante');
    expect(lines).toHaveLength(5);
  });

  it('is empty when there are no items', async () => {
    const report = makeMenuReport({ items: [], dataCompleteness: 'EMPTY' });
    const fixture = await setup(makeCacheStub({ menuEngineering: { data: report } }));
    expect(fixture.componentInstance.isEmpty()).toBe(true);
  });
});

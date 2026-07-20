import { TestBed, type ComponentFixture } from '@angular/core/testing';
import {
  ɵresolveComponentResources as resolveComponentResources,
} from '@angular/core';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { AnalyticsCache } from '@app/core/services/analytics/analytics-cache';
import {
  DayPart,
  OperationsReport,
} from '@app/shared/models/dto/analytics/operations-report';

import { Operations } from './operations';
import operationsHtml from './operations.html?raw';

function makeOperationsStub(
  overrides: {
    data?: () => OperationsReport | null;
    isLoading?: () => boolean;
    error?: () => Error | null;
    refresh?: () => void;
    invalidate?: () => void;
    loadIfStale?: () => void;
  } = {},
): Pick<AnalyticsCache, 'operations'> & Record<string, unknown> {
  return {
    operations: {
      data: overrides.data ?? ((): OperationsReport | null => null),
      isLoading: overrides.isLoading ?? ((): boolean => false),
      error: overrides.error ?? ((): Error | null => null),
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      refresh: overrides.refresh ?? ((): void => {}),
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      invalidate: overrides.invalidate ?? ((): void => {}),
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      loadIfStale: overrides.loadIfStale ?? ((): void => {}),
    },
    primeCost: { data: (): null => null, isLoading: (): boolean => false, error: (): null => null },
    menuEngineering: { data: (): null => null, isLoading: (): boolean => false, error: (): null => null },
    cohort: { data: (): null => null, isLoading: (): boolean => false, error: (): null => null },
    alerts: { data: (): null => null, isLoading: (): boolean => false, error: (): null => null },
  };
}

function money(amount: string): { amount: string; currency: 'COP' } {
  return { amount, currency: 'COP' };
}

function makeDayPart(
  dayPart: DayPart,
  turns: number,
  covers: number,
  tables = 8,
): { dayPart: DayPart; turns: number; covers: number; tables: number } {
  return { dayPart, turns, covers, tables };
}

function makeReport(opts: {
  dataCompleteness?: 'FULL' | 'PARTIAL' | 'EMPTY';
  notes?: string[];
  revPashValue?: string;
  revPashTotalNetSales?: string;
  totalAvailableSeatHours?: number;
  overallTurnover?: number;
  avgOccupancyMinutes?: number;
  byDayPart?: ReturnType<typeof makeDayPart>[];
} = {}): OperationsReport {
  return {
    period: { bucket: 'monthly', from: '2026-02', to: '2026-07', keys: ['2026-02', '2026-07'] },
    revPash: {
      value: money(opts.revPashValue ?? '8500.00'),
      totalNetSales: money(opts.revPashTotalNetSales ?? '42500000.00'),
      totalAvailableSeatHours: opts.totalAvailableSeatHours ?? 5000,
    },
    tableTurnover: {
      overall: opts.overallTurnover ?? 2.45,
      byDayPart: opts.byDayPart ?? [
        makeDayPart('LUNCH', 18, 96),
        makeDayPart('DINNER', 24, 132),
        makeDayPart('OTHER', 4, 18),
      ],
    },
    avgOccupancyMinutes: opts.avgOccupancyMinutes ?? 47.3,
    dataCompleteness: opts.dataCompleteness ?? 'FULL',
    notes: opts.notes,
  };
}

// jsdom does not implement canvas — chart.js calls getContext on the canvas
// element which would otherwise throw. Stub it with a no-op 2d context.
function installCanvasContextStub(): void {
  if (typeof HTMLCanvasElement === 'undefined') return;
  const proto = HTMLCanvasElement.prototype as unknown as Record<string, unknown>;
  if (proto.__opStubbed) return;

  type StubCtx = Record<string, (...args: never[]) => unknown>;
  const stubContext: StubCtx = {
    canvas: { width: 0, height: 0 },
    fillRect: () => undefined,
    clearRect: () => undefined,
    getImageData: () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1, colorSpace: 'srgb' }),
    putImageData: () => undefined,
    createImageData: () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1, colorSpace: 'srgb' }),
    setTransform: () => undefined,
    drawImage: () => undefined,
    save: () => undefined,
    fillText: () => undefined,
    restore: () => undefined,
    beginPath: () => undefined,
    moveTo: () => undefined,
    lineTo: () => undefined,
    closePath: () => undefined,
    stroke: () => undefined,
    translate: () => undefined,
    scale: () => undefined,
    rotate: () => undefined,
    arc: () => undefined,
    fill: () => undefined,
    measureText: () => ({ width: 0 }),
    transform: () => undefined,
    rect: () => undefined,
    clip: () => undefined,
  };

  HTMLCanvasElement.prototype.getContext = function (): unknown {
    return stubContext;
  } as typeof HTMLCanvasElement.prototype.getContext;
  proto.__opStubbed = true;
}

describe('Operations', () => {
  beforeAll(async () => {
    installCanvasContextStub();

    await resolveComponentResources((url: string) => {
      if (url.endsWith('operations.html')) {
        return Promise.resolve(operationsHtml as unknown as string);
      }
      return Promise.resolve('');
    });
  });

  async function setup(
    stub: Pick<AnalyticsCache, 'operations'> & Record<string, unknown>,
  ): Promise<ComponentFixture<Operations>> {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [Operations],
      providers: [
        { provide: AnalyticsCache, useValue: stub },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(Operations);
    fixture.detectChanges();
    return fixture;
  }

  function getRoot(fixture: ComponentFixture<Operations>): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  it('calls cache.operations.loadIfStale on construction', async () => {
    const loadIfStaleSpy = vi.fn();
    const stub = makeOperationsStub({
      isLoading: () => false,
      error: () => null,
      data: () => null,
      loadIfStale: loadIfStaleSpy,
    });
    await setup(stub);
    expect(loadIfStaleSpy).toHaveBeenCalledTimes(1);
  });

  it('renders the skeleton (4 stat + 1 chart = 5) when isLoading() is true and report() is null', async () => {
    const stub = makeOperationsStub({
      isLoading: () => true,
      data: () => null,
      error: () => null,
    });
    const fixture = await setup(stub);
    const root = getRoot(fixture);

    const skeletons = root.querySelectorAll('p-skeleton');
    // 4 stat-card skeletons + 1 chart skeleton = 5
    expect(skeletons.length).toBe(5);
    expect(root.querySelector('p-chart')).toBeNull();
    expect(root.textContent).not.toContain('No hay datos en el periodo seleccionado');
  });

  it('renders four stat cards with the correct fields when report() is populated', async () => {
    const stub = makeOperationsStub({
      isLoading: () => false,
      error: () => null,
      data: () =>
        makeReport({
          revPashValue: '8500.00',
          revPashTotalNetSales: '42500000.00',
          overallTurnover: 2.45,
          avgOccupancyMinutes: 47.3,
        }),
    });
    const fixture = await setup(stub);
    const root = getRoot(fixture);

    const section = root.querySelector('section[aria-label="Indicadores clave de operaciones"]');
    expect(section).toBeTruthy();
    const articles = section?.querySelectorAll('article') ?? [];
    expect(articles.length).toBe(4);

    const text = root.textContent;
    expect(text).toContain('RevPASH');
    expect(text).toContain('Ventas netas');
    expect(text).toContain('Rotación global');
    expect(text).toContain('Ocupación media');
    // Money-pipe formatted values for RevPASH & ventas netas
    expect(text).toMatch(/8[.,\s]500/);
    expect(text).toMatch(/42[.,\s]?500[.,\s]?000/);
    // toFixed(2) turnover & toFixed(1) occupancy
    expect(text).toContain('2.45');
    expect(text).toContain('47.3 min');
  });

  it('renders the day-part bar chart when byDayPart is non-empty', async () => {
    const stub = makeOperationsStub({
      isLoading: () => false,
      error: () => null,
      data: () =>
        makeReport({
          byDayPart: [
            makeDayPart('LUNCH', 18, 96),
            makeDayPart('DINNER', 24, 132),
            makeDayPart('OTHER', 4, 18),
          ],
        }),
    });
    const fixture = await setup(stub);
    const root = getRoot(fixture);
    const cmp = fixture.componentInstance;

    const chart = root.querySelector('p-chart');
    expect(chart).toBeTruthy();
    expect(chart?.getAttribute('type')).toBe('bar');

    // 2 datasets (turns + covers)
    const data = cmp.dayPartChartData();
    expect(data.labels).toEqual(['Almuerzo', 'Cena', 'Otro']);
    expect(data.datasets.length).toBe(2);
    expect(data.datasets[0].label).toBe('Rotación (turnos)');
    expect(data.datasets[0].data).toEqual([18, 24, 4]);
    expect(data.datasets[1].label).toBe('Cubiertos');
    expect(data.datasets[1].data).toEqual([96, 132, 18]);

    // figure wraps the chart and contains sr-only figcaption
    const figure = root.querySelector('figure');
    expect(figure).toBeTruthy();
    expect(figure?.querySelector('figcaption.sr-only')?.textContent ?? '').toContain('franja horaria');
  });

  it('renders the notes banner when completeness is PARTIAL with notes', async () => {
    const stub = makeOperationsStub({
      isLoading: () => false,
      error: () => null,
      data: () =>
        makeReport({
          dataCompleteness: 'PARTIAL',
          notes: ['Se usaron horarios aproximados (created_at/updated_at)'],
        }),
    });
    const fixture = await setup(stub);
    const root = getRoot(fixture);
    const text = root.textContent;

    expect(text).toContain('Datos parciales');
    expect(text).toContain('Se usaron horarios aproximados');

    const banner = Array.from(root.querySelectorAll('[role="status"][aria-live="polite"]'))
      .find((el) => el.textContent.includes('Datos parciales'));
    expect(banner).toBeTruthy();
    expect(banner?.querySelectorAll('ul li').length).toBe(1);
  });

  it('renders the EMPTY banner with blue palette and retry button when completeness is EMPTY', async () => {
    const stub = makeOperationsStub({
      isLoading: () => false,
      error: () => null,
      data: () =>
        makeReport({
          dataCompleteness: 'EMPTY',
          notes: [],
        }),
    });
    const fixture = await setup(stub);
    const root = getRoot(fixture);

    const text = root.textContent;
    expect(text).toContain('Sin datos en el periodo');
    expect(text).not.toContain('Datos parciales');

    // Blue palette tokens applied for EMPTY
    const banner = Array.from(root.querySelectorAll('div.rounded-lg'))
      .find((el) => el.textContent.includes('Sin datos'));
    expect(banner).toBeTruthy();
    expect(banner?.classList.contains('border-blue-300')).toBe(true);
    expect(banner?.classList.contains('bg-blue-50')).toBe(true);

    const retry = Array.from(banner?.querySelectorAll('button') ?? []).find(
      (b) => b.textContent.trim() === 'Reintentar',
    );
    expect(retry).toBeTruthy();
  });

  it('does NOT render any fallback banner when completeness is FULL', async () => {
    const stub = makeOperationsStub({
      isLoading: () => false,
      error: () => null,
      data: () => makeReport({ dataCompleteness: 'FULL' }),
    });
    const fixture = await setup(stub);
    const root = getRoot(fixture);
    const text = root.textContent;

    expect(text).not.toContain('Datos parciales');
    expect(text).not.toContain('Sin datos en el periodo');
  });

  it('renders an error <p-message> when error() is truthy', async () => {
    const err = new Error('Falló la consulta');
    const stub = makeOperationsStub({
      isLoading: () => false,
      data: () => null,
      error: () => err,
    });
    const fixture = await setup(stub);
    const root = getRoot(fixture);
    const text = root.textContent;

    expect(root.querySelector('p-message')).toBeTruthy();
    expect(text).toContain('No se pudieron cargar los datos');
    expect(text).toContain('Falló la consulta');
  });

  it('calls cache.operations.refresh when the Actualizar header button is clicked', async () => {
    const refreshSpy = vi.fn();
    const stub = makeOperationsStub({
      isLoading: () => false,
      error: () => null,
      data: () => makeReport(),
      refresh: refreshSpy,
    });
    const fixture = await setup(stub);
    const root = getRoot(fixture);

    const btn = Array.from(root.querySelectorAll('button')).find(
      (b) => b.textContent.trim() === 'Actualizar',
    );
    expect(btn).toBeTruthy();
    btn?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(refreshSpy).toHaveBeenCalledTimes(1);
  });

  it('calls cache.operations.refresh when the PARTIAL banner Reintentar button is clicked', async () => {
    const refreshSpy = vi.fn();
    const stub = makeOperationsStub({
      isLoading: () => false,
      error: () => null,
      data: () =>
        makeReport({
          dataCompleteness: 'PARTIAL',
          notes: ['nota'],
        }),
      refresh: refreshSpy,
    });
    const fixture = await setup(stub);
    const root = getRoot(fixture);

    const btn = Array.from(root.querySelectorAll('button')).find(
      (b) => b.textContent.trim() === 'Reintentar',
    );
    expect(btn).toBeTruthy();
    btn?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(refreshSpy).toHaveBeenCalledTimes(1);
  });

  it('maps DayPart to its Spanish label', async () => {
    const stub = makeOperationsStub({
      isLoading: () => false,
      error: () => null,
      data: () => makeReport(),
    });
    const fixture = await setup(stub);
    const cmp = fixture.componentInstance;

    expect(cmp.dayPartLabel('LUNCH')).toBe('Almuerzo');
    expect(cmp.dayPartLabel('DINNER')).toBe('Cena');
    expect(cmp.dayPartLabel('OTHER')).toBe('Otro');
  });
});

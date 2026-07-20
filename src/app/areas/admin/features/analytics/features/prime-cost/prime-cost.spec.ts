import { TestBed, type ComponentFixture } from '@angular/core/testing';
import {
  ɵresolveComponentResources as resolveComponentResources,
} from '@angular/core';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { AnalyticsCache } from '@app/core/services/analytics/analytics-cache';
import { PrimeCostReport } from '@app/shared/models/dto/analytics/prime-cost-report';

import { PrimeCost } from './prime-cost';
import primeCostHtml from './prime-cost.html?raw';

function makePrimeCostStub(
  overrides: {
    data?: () => PrimeCostReport | null;
    isLoading?: () => boolean;
    error?: () => Error | null;
  } = {},
): Pick<AnalyticsCache, 'primeCost'> & Record<string, unknown> {
  return {
    primeCost: {
      data: overrides.data ?? ((): PrimeCostReport | null => null),
      isLoading: overrides.isLoading ?? ((): boolean => false),
      error: overrides.error ?? ((): Error | null => null),
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      refresh: (): void => {},
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      invalidate: (): void => {},
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      loadIfStale: (): void => {},
    },
    menuEngineering: { data: (): null => null, isLoading: (): boolean => false, error: (): null => null },
    operations: { data: (): null => null, isLoading: (): boolean => false, error: (): null => null },
    cohort: { data: (): null => null, isLoading: (): boolean => false, error: (): null => null },
    alerts: { data: (): null => null, isLoading: (): boolean => false, error: (): null => null },
  };
}

function makeReport(opts: {
  dataCompleteness?: 'FULL' | 'PARTIAL' | 'EMPTY';
  notes?: string[];
  primeCostPct?: number;
  netSales?: string;
  primeCost?: string;
} = {}): PrimeCostReport {
  const primeCostPct = opts.primeCostPct ?? 62.5;
  const netSales = opts.netSales ?? '125000000.00';
  const primeCost = opts.primeCost ?? '78125000.00';
  const latest = {
    key: '2026-07',
    netSales: { amount: netSales, currency: 'COP' },
    grossSales: { amount: netSales, currency: 'COP' },
    cogs: {
      total: { amount: '50000000.00', currency: 'COP' },
      byCategory: [
        { category: 'FOOD' as const, amount: { amount: '40000000.00', currency: 'COP' }, pct: 80 },
        { category: 'BEVERAGE' as const, amount: { amount: '10000000.00', currency: 'COP' }, pct: 20 },
      ],
    },
    labor: {
      total: { amount: '28125000.00', currency: 'COP' },
      byArea: [
        { area: 'BOH' as const, amount: { amount: '18000000.00', currency: 'COP' }, pct: 64 },
        { area: 'FOH' as const, amount: { amount: '10125000.00', currency: 'COP' }, pct: 36 },
      ],
    },
    primeCost: { amount: primeCost, currency: 'COP' },
    primeCostPct,
    margins: { grossProfitPct: 37.5 },
    dataCompleteness: opts.dataCompleteness ?? 'FULL',
  };
  return {
    period: { bucket: 'monthly', from: '2026-02', to: '2026-07', keys: ['2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07'] },
    series: [latest],
    dataCompleteness: opts.dataCompleteness ?? 'FULL',
    notes: opts.notes,
  };
}

// jsdom does not implement canvas — chart.js calls getContext on the canvas
// element which would otherwise throw. Stub it with a no-op 2d context. The
// methods are no-ops because chart.js never actually renders to a real screen
// during unit tests, but it must successfully acquire *some* context.
function installCanvasContextStub(): void {
  if (typeof HTMLCanvasElement === 'undefined') return;
  const proto = HTMLCanvasElement.prototype as unknown as Record<string, unknown>;
  if (proto.__pcStubbed) return;

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
  proto.__pcStubbed = true;
}

describe('PrimeCost', () => {
  beforeAll(async () => {
    installCanvasContextStub();

    await resolveComponentResources((url: string) => {
      if (url.endsWith('prime-cost.html')) {
        return Promise.resolve(primeCostHtml as unknown as string);
      }
      return Promise.resolve('');
    });
  });

  async function setup(
    stub: Pick<AnalyticsCache, 'primeCost'> & Record<string, unknown>,
  ): Promise<ComponentFixture<PrimeCost>> {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [PrimeCost],
      providers: [
        { provide: AnalyticsCache, useValue: stub },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(PrimeCost);
    fixture.detectChanges();
    return fixture;
  }

  function getRoot(fixture: ComponentFixture<PrimeCost>): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  it('invokes cache.primeCost.loadIfStale on construction', async () => {
    const loadIfStale = vi.fn();
    const stub = makePrimeCostStub();
    (stub.primeCost as { loadIfStale: () => void }).loadIfStale = loadIfStale;
    await setup(stub);
    expect(loadIfStale).toHaveBeenCalledTimes(1);
  });

  it('renders the page skeleton when isLoading() is true and report() is null', async () => {
    const stub = makePrimeCostStub({
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

  it('renders four stat cards filled with formatted Money when latest() is non-null', async () => {
    const stub = makePrimeCostStub({
      isLoading: () => false,
      error: () => null,
      data: () => makeReport({ netSales: '125000000.00', primeCost: '78125000.00' }),
    });
    const fixture = await setup(stub);
    const root = getRoot(fixture);
    const text = root.textContent;

    // Header + first 2 stat cards contain Money-formatted numbers
    expect(text.includes('$') || text.includes('CO')).toBe(true);
    // 4 stat-card articles inside the 4-col grid section
    const statCards = root.querySelectorAll(
      'section.grid.grid-cols-1.md\\:grid-cols-2.xl\\:grid-cols-4 article',
    );
    expect(statCards.length).toBe(4);
    // Card labels
    expect(text).toContain('Ventas netas');
    expect(text).toContain('Costo primo');
    expect(text).toContain('Costo primo %');
    expect(text).toContain('Margen bruto');
  });

  it('renders primeCostPct formatted as XX.XX%', async () => {
    const stub = makePrimeCostStub({
      isLoading: () => false,
      error: () => null,
      data: () => makeReport({ primeCostPct: 62.5 }),
    });
    const fixture = await setup(stub);
    const text = getRoot(fixture).textContent;

    // fmtPercent(62.5) -> "62.50%"
    expect(text).toContain('62.50%');
    // GrossProfit% 37.5 -> "37.50%"
    expect(text).toContain('37.50%');
  });

  it('renders the trend chart when series.length > 1', async () => {
    const report = makeReport();
    report.series = [
      { ...report.series[0], key: '2026-02', primeCostPct: 60 },
      { ...report.series[0], key: '2026-03', primeCostPct: 61.5 },
      { ...report.series[0], key: '2026-07', primeCostPct: 62.5 },
    ];
    const stub = makePrimeCostStub({
      isLoading: () => false,
      error: () => null,
      data: () => report,
    });
    const fixture = await setup(stub);
    const root = getRoot(fixture);

    const charts = root.querySelectorAll('p-chart');
    // 1 line chart (trend) + 2 doughnut (cogs + labor) = 3
    expect(charts.length).toBe(3);
  });

  it('renders the notes banner when dataCompleteness === "PARTIAL" and notes is non-empty', async () => {
    const stub = makePrimeCostStub({
      isLoading: () => false,
      error: () => null,
      data: () =>
        makeReport({
          dataCompleteness: 'PARTIAL',
          notes: ['Faltaban 3 recibos de la semana 28'],
        }),
    });
    const fixture = await setup(stub);
    const text = getRoot(fixture).textContent;

    expect(text).toContain('Datos parciales');
    expect(text).toContain('Faltaban 3 recibos de la semana 28');
  });

  it('does NOT render the notes banner when dataCompleteness === "FULL" and notes is empty', async () => {
    const stub = makePrimeCostStub({
      isLoading: () => false,
      error: () => null,
      data: () => makeReport({ dataCompleteness: 'FULL', notes: [] }),
    });
    const fixture = await setup(stub);
    const root = getRoot(fixture);
    const text = root.textContent;

    expect(text).not.toContain('Datos parciales');
    // No banner list rendered
    expect(root.querySelector('ul')).toBeNull();
  });

  it('renders an error message when error() is truthy', async () => {
    const err = new Error('No se pudo cargar el reporte');
    const stub = makePrimeCostStub({
      isLoading: () => false,
      data: () => null,
      error: () => err,
    });
    const fixture = await setup(stub);
    const root = getRoot(fixture);
    const text = root.textContent;

    expect(root.querySelector('p-message')).toBeTruthy();
    expect(text).toContain('No se pudieron cargar los datos');
    expect(text).toContain('No se pudo cargar el reporte');
  });

  it('renders empty state text when loading is done, no error, and latest() is null', async () => {
    const stub = makePrimeCostStub({
      isLoading: () => false,
      error: () => null,
      data: () => ({
        period: { bucket: 'monthly', from: '2026-02', to: '2026-07', keys: [] },
        series: [],
        dataCompleteness: 'EMPTY',
      }),
    });
    const fixture = await setup(stub);
    const root = getRoot(fixture);
    const text = root.textContent;

    expect(text).toContain('No hay datos en el periodo seleccionado');
    expect(root.querySelector('p-chart')).toBeNull();
    expect(root.querySelector('p-skeleton')).toBeNull();
    // No error message
    expect(root.querySelector('p-message')).toBeNull();
  });

  it('calls refresh on the cache when the reload button is clicked', async () => {
    const refreshSpy = vi.fn();
    const stub = makePrimeCostStub({
      isLoading: () => false,
      error: () => null,
      data: () => makeReport(),
    });
    stub.primeCost.refresh = refreshSpy;
    const fixture = await setup(stub);
    const root = getRoot(fixture);

    const btn = Array.from(root.querySelectorAll('button')).find(
      (b) => b.textContent.trim() === 'Actualizar',
    );
    expect(btn).toBeTruthy();
    btn?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(refreshSpy).toHaveBeenCalledTimes(1);
  });
});

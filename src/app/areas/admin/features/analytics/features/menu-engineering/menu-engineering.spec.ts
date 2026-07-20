import { TestBed, type ComponentFixture } from '@angular/core/testing';
import {
  ɵresolveComponentResources as resolveComponentResources,
} from '@angular/core';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { AnalyticsCache } from '@app/core/services/analytics/analytics-cache';
import {
  MenuEngineeringReport,
  MenuQuadrant,
} from '@app/shared/models/dto/analytics/menu-engineering-report';

import { MenuEngineering } from './menu-engineering';
import menuEngineeringHtml from './menu-engineering.html?raw';

function makeMenuEngineeringStub(
  overrides: {
    data?: () => MenuEngineeringReport | null;
    isLoading?: () => boolean;
    error?: () => Error | null;
    refresh?: () => void;
    invalidate?: () => void;
    loadIfStale?: () => void;
  } = {},
): Pick<AnalyticsCache, 'menuEngineering'> & Record<string, unknown> {
  return {
    menuEngineering: {
      data: overrides.data ?? ((): MenuEngineeringReport | null => null),
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
    operations: { data: (): null => null, isLoading: (): boolean => false, error: (): null => null },
    cohort: { data: (): null => null, isLoading: (): boolean => false, error: (): null => null },
    alerts: { data: (): null => null, isLoading: (): boolean => false, error: (): null => null },
  };
}

function money(amount: string): { amount: string; currency: 'COP' } {
  return { amount, currency: 'COP' };
}

function makeItem(
  overrides: {
    productId?: number;
    productName?: string;
    categoryId?: number | null;
    categoryName?: string | null;
    unitsSold?: number;
    revenue?: string;
    recipeCost?: string;
    grossProfitPerUnit?: string;
    totalContribution?: string;
    quadrant?: MenuQuadrant;
  } = {},
) {
  return {
    productId: overrides.productId ?? 1,
    productName: overrides.productName ?? 'Item',
    categoryId: overrides.categoryId ?? null,
    categoryName: overrides.categoryName ?? null,
    unitsSold: overrides.unitsSold ?? 10,
    revenue: money(overrides.revenue ?? '100000.00'),
    recipeCost: money(overrides.recipeCost ?? '40000.00'),
    grossProfitPerUnit: money(overrides.grossProfitPerUnit ?? '6000.00'),
    totalContribution: money(overrides.totalContribution ?? '60000.00'),
    quadrant: overrides.quadrant ?? 'STAR',
  };
}

function makeReport(opts: {
  dataCompleteness?: 'FULL' | 'PARTIAL' | 'EMPTY';
  notes?: string[];
  items?: ReturnType<typeof makeItem>[];
  withCacheStatus?: boolean;
  medianVolume?: number;
  medianMargin?: string;
} = {}): MenuEngineeringReport {
  return {
    period: { bucket: 'monthly', from: '2026-02', to: '2026-07', keys: ['2026-02', '2026-07'] },
    median: {
      volume: opts.medianVolume ?? 10,
      margin: money(opts.medianMargin ?? '6000.00'),
    },
    items: opts.items ?? [],
    cacheStatus: opts.withCacheStatus
      ? { lastRefreshedAt: '2026-07-17T12:00:00Z', sourceVersion: 'v1.2.3', ttlSeconds: 1800 }
      : { lastRefreshedAt: '', sourceVersion: '', ttlSeconds: 0 },
    dataCompleteness: opts.dataCompleteness ?? 'FULL',
    notes: opts.notes,
  };
}

// jsdom does not implement canvas — chart.js calls getContext on the canvas
// element which would otherwise throw. Stub it with a no-op 2d context.
function installCanvasContextStub(): void {
  if (typeof HTMLCanvasElement === 'undefined') return;
  const proto = HTMLCanvasElement.prototype as unknown as Record<string, unknown>;
  if (proto.__meStubbed) return;

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
  proto.__meStubbed = true;
}

describe('MenuEngineering', () => {
  beforeAll(async () => {
    installCanvasContextStub();

    await resolveComponentResources((url: string) => {
      if (url.endsWith('menu-engineering.html')) {
        return Promise.resolve(menuEngineeringHtml as unknown as string);
      }
      return Promise.resolve('');
    });
  });

  async function setup(
    stub: Pick<AnalyticsCache, 'menuEngineering'> & Record<string, unknown>,
  ): Promise<ComponentFixture<MenuEngineering>> {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [MenuEngineering],
      providers: [
        { provide: AnalyticsCache, useValue: stub },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(MenuEngineering);
    fixture.detectChanges();
    return fixture;
  }

  function getRoot(fixture: ComponentFixture<MenuEngineering>): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  it('calls cache.menuEngineering.loadIfStale on construction', async () => {
    const loadIfStaleSpy = vi.fn();
    const stub = makeMenuEngineeringStub({
      isLoading: () => false,
      error: () => null,
      data: () => null,
      loadIfStale: loadIfStaleSpy,
    });
    await setup(stub);
    expect(loadIfStaleSpy).toHaveBeenCalledTimes(1);
  });

  it('renders two skeletons when isLoading() is true and report() is null', async () => {
    const stub = makeMenuEngineeringStub({
      isLoading: () => true,
      data: () => null,
      error: () => null,
    });
    const fixture = await setup(stub);
    const root = getRoot(fixture);

    const skeletons = root.querySelectorAll('p-skeleton');
    // Template renders stat cards + chart + table placeholder skeletons;
    // we wrap them all in a role="status" aria-live="polite" container.
    expect(skeletons.length).toBeGreaterThanOrEqual(2);
    expect(root.querySelector('p-chart')).toBeNull();
    expect(root.querySelector('p-table')).toBeNull();
    // Skeleton wrapper exposes a polite live region
    const wrapper = root.querySelector('[role="status"][aria-live="polite"]');
    expect(wrapper).toBeTruthy();
  });

  it('renders the BCG bubble chart when median is available', async () => {
    const stub = makeMenuEngineeringStub({
      isLoading: () => false,
      error: () => null,
      data: () => makeReport({ items: [makeItem({ quadrant: 'STAR' })] }),
    });
    const fixture = await setup(stub);
    const root = getRoot(fixture);
    const cmp = fixture.componentInstance;

    const charts = root.querySelectorAll('p-chart');
    expect(charts.length).toBe(1);
    // One dataset per quadrant (4)
    const chartData = cmp.quadrantChartData();
    expect(chartData.datasets.length).toBe(4);
    // Chart is wrapped in a <figure> with a visible + sr-only <figcaption>
    const figure = root.querySelector('figure');
    expect(figure).toBeTruthy();
    expect(figure?.querySelectorAll('figcaption').length).toBe(2);
    const srFig = figure?.querySelector('figcaption.sr-only');
    expect(srFig?.textContent ?? '').toContain('Matriz BCG');
  });

  it('wraps the chart <figure> with a sr-only figcaption that includes the item count', async () => {
    const stub = makeMenuEngineeringStub({
      isLoading: () => false,
      error: () => null,
      data: () =>
        makeReport({
          items: [
            makeItem({ productId: 1, productName: 'A' }),
            makeItem({ productId: 2, productName: 'B' }),
            makeItem({ productId: 3, productName: 'C' }),
          ],
        }),
    });
    const fixture = await setup(stub);
    const root = getRoot(fixture);
    const srFig = root.querySelector('figure figcaption.sr-only');
    expect(srFig).toBeTruthy();
    expect(srFig?.textContent ?? '').toContain('3 productos');
  });

  it('renders four stat cards in an aria-labelledby section', async () => {
    const stub = makeMenuEngineeringStub({
      isLoading: () => false,
      error: () => null,
      data: () =>
        makeReport({
          medianVolume: 25,
          medianMargin: '9000.00',
          items: [makeItem(), makeItem({ productId: 2, productName: 'B' })],
        }),
    });
    const fixture = await setup(stub);
    const root = getRoot(fixture);

    const section = root.querySelector('section[aria-labelledby="me-stats-heading"]');
    expect(section).toBeTruthy();
    const articles = section?.querySelectorAll('article') ?? [];
    expect(articles.length).toBe(4);
    const text = root.textContent;
    expect(text).toContain('Productos');
    expect(text).toContain('Contribución total');
    expect(text).toContain('Volumen mediana');
    expect(text).toContain('Margen mediana');
  });

  it('renders median volume stat card with the numeric median value', async () => {
    const stub = makeMenuEngineeringStub({
      isLoading: () => false,
      error: () => null,
      data: () =>
        makeReport({
          medianVolume: 42,
          items: [makeItem()],
        }),
    });
    const fixture = await setup(stub);
    const root = getRoot(fixture);
    const cell = root.querySelector('[data-testid="me-stat-median-volume"]');
    expect(cell?.textContent.trim()).toBe('42');
  });

  it('renders median margin stat card with the Money-pipe formatted median', async () => {
    const stub = makeMenuEngineeringStub({
      isLoading: () => false,
      error: () => null,
      data: () =>
        makeReport({
          medianMargin: '9000.00',
          items: [makeItem()],
        }),
    });
    const fixture = await setup(stub);
    const root = getRoot(fixture);
    const cell = root.querySelector('[data-testid="me-stat-median-margin"]');
    expect(cell).toBeTruthy();
    const text = cell?.textContent ?? '';
    // MoneyPipe on 9000.00 COP renders "$ 9.000" or similar localized
    expect(text).toMatch(/9[.,\s]000/);
  });

  it('renders total contribution stat card with the Money-pipe formatted sum', async () => {
    const stub = makeMenuEngineeringStub({
      isLoading: () => false,
      error: () => null,
      data: () =>
        makeReport({
          items: [
            makeItem({ totalContribution: '60000.00' }),
            makeItem({ productId: 2, totalContribution: '40000.00' }),
          ],
        }),
    });
    const fixture = await setup(stub);
    const root = getRoot(fixture);
    const cell = root.querySelector('[data-testid="me-stat-total-contribution"]');
    const text = cell?.textContent ?? '';
    expect(text).toMatch(/100[.,\s]000/);
  });

  it('renders items count stat card with the filtered items length', async () => {
    const stub = makeMenuEngineeringStub({
      isLoading: () => false,
      error: () => null,
      data: () =>
        makeReport({
          items: [
            makeItem({ productId: 1 }),
            makeItem({ productId: 2 }),
            makeItem({ productId: 3 }),
          ],
        }),
    });
    const fixture = await setup(stub);
    const root = getRoot(fixture);
    const cell = root.querySelector('[data-testid="me-stat-count"]');
    expect(cell?.textContent.trim()).toBe('3');
  });

  it('renders p-table rows for each item when items.length > 0', async () => {
    const stub = makeMenuEngineeringStub({
      isLoading: () => false,
      error: () => null,
      data: () =>
        makeReport({
          items: [
            makeItem({ productId: 1, productName: 'Coca Cola', quadrant: 'STAR' }),
            makeItem({ productId: 2, productName: 'Hamburguesa', quadrant: 'PLOWHORSE' }),
            makeItem({ productId: 3, productName: 'Ensalada', quadrant: 'PUZZLE' }),
          ],
        }),
    });
    const fixture = await setup(stub);
    const root = getRoot(fixture);

    const table = root.querySelector('p-table');
    expect(table).toBeTruthy();
    const text = root.textContent;
    expect(text).toContain('Coca Cola');
    expect(text).toContain('Hamburguesa');
    expect(text).toContain('Ensalada');
    // One p-tag per item
    expect(root.querySelectorAll('p-table p-tag').length).toBe(3);
  });

  it('renders the p-table emptymessage when items.length === 0', async () => {
    const stub = makeMenuEngineeringStub({
      isLoading: () => false,
      error: () => null,
      data: () => makeReport({ items: [] }),
    });
    const fixture = await setup(stub);
    const root = getRoot(fixture);

    const table = root.querySelector('p-table');
    expect(table).toBeTruthy();
    const text = root.textContent;
    expect(text).toContain('No hay SKUs para mostrar');
    // No item tags rendered
    expect(root.querySelectorAll('p-table p-tag').length).toBe(0);
  });

  it('maps MenuQuadrant to the expected tag severity', async () => {
    const stub = makeMenuEngineeringStub({
      isLoading: () => false,
      error: () => null,
      data: () => makeReport({ items: [] }),
    });
    const fixture = await setup(stub);
    const cmp = fixture.componentInstance;

    expect(cmp.quadrantSeverity('STAR')).toBe('success');
    expect(cmp.quadrantSeverity('PLOWHORSE')).toBe('warn');
    expect(cmp.quadrantSeverity('PUZZLE')).toBe('info');
    expect(cmp.quadrantSeverity('DOG')).toBe('danger');
  });

  it('maps MenuQuadrant to the expected Spanish label', async () => {
    const stub = makeMenuEngineeringStub({
      isLoading: () => false,
      error: () => null,
      data: () => makeReport({ items: [] }),
    });
    const fixture = await setup(stub);
    const cmp = fixture.componentInstance;

    expect(cmp.quadrantLabel('STAR')).toBe('Estrella');
    expect(cmp.quadrantLabel('PLOWHORSE')).toBe('Caballo');
    expect(cmp.quadrantLabel('PUZZLE')).toBe('Rompecabezas');
    expect(cmp.quadrantLabel('DOG')).toBe('Perro');
  });

  it('renders the notes banner when completeness is PARTIAL with notes', async () => {
    const stub = makeMenuEngineeringStub({
      isLoading: () => false,
      error: () => null,
      data: () =>
        makeReport({
          dataCompleteness: 'PARTIAL',
          notes: ['Faltan recetas para 2 productos'],
          items: [makeItem()],
        }),
    });
    const fixture = await setup(stub);
    const root = getRoot(fixture);
    const text = root.textContent;

    expect(text).toContain('Datos parciales');
    expect(text).toContain('Faltan recetas para 2 productos');
    const banner = root.querySelector('[data-testid="me-data-banner"]');
    expect(banner).toBeTruthy();
    const items = root.querySelectorAll('[data-testid="me-data-banner"] ul li');
    expect(items.length).toBe(1);
  });

  it('renders the banner when completeness is PARTIAL even with NO notes (severity warn)', async () => {
    const stub = makeMenuEngineeringStub({
      isLoading: () => false,
      error: () => null,
      data: () =>
        makeReport({
          dataCompleteness: 'PARTIAL',
          notes: [],
          items: [makeItem()],
        }),
    });
    const fixture = await setup(stub);
    const root = getRoot(fixture);
    const banner = root.querySelector('[data-testid="me-data-banner"]');
    expect(banner).toBeTruthy();
    // Amber palette tokens applied for PARTIAL
    expect(banner?.classList.contains('border-amber-300')).toBe(true);
    expect(banner?.classList.contains('bg-amber-50')).toBe(true);
    expect(root.textContent).toContain('Datos parciales');
  });

  it('renders the EMPTY banner with info severity and "Sin datos en el periodo" headline', async () => {
    const stub = makeMenuEngineeringStub({
      isLoading: () => false,
      error: () => null,
      data: () =>
        makeReport({
          dataCompleteness: 'EMPTY',
          notes: [],
          items: [],
        }),
    });
    const fixture = await setup(stub);
    const root = getRoot(fixture);
    const banner = root.querySelector('[data-testid="me-data-banner"]');
    expect(banner).toBeTruthy();
    // Blue palette tokens applied for EMPTY (info)
    expect(banner?.classList.contains('border-blue-300')).toBe(true);
    expect(banner?.classList.contains('bg-blue-50')).toBe(true);
    expect(root.textContent).toContain('Sin datos en el periodo');
    expect(root.textContent).not.toContain('Datos parciales');
  });

  it('does NOT render the banner when completeness is FULL', async () => {
    const stub = makeMenuEngineeringStub({
      isLoading: () => false,
      error: () => null,
      data: () => makeReport({ dataCompleteness: 'FULL', items: [makeItem()] }),
    });
    const fixture = await setup(stub);
    const root = getRoot(fixture);
    expect(root.querySelector('[data-testid="me-data-banner"]')).toBeNull();
  });

  it('banner retry button calls cache.menuEngineering.refresh', async () => {
    const refreshSpy = vi.fn();
    const stub = makeMenuEngineeringStub({
      isLoading: () => false,
      error: () => null,
      data: () =>
        makeReport({
          dataCompleteness: 'PARTIAL',
          notes: ['x'],
          items: [makeItem()],
        }),
      refresh: refreshSpy,
    });
    const fixture = await setup(stub);
    const root = getRoot(fixture);

    const banner = root.querySelector('[data-testid="me-data-banner"]');
    expect(banner).toBeTruthy();
    const btn = Array.from(banner?.querySelectorAll('button') ?? []).find(
      (b) => b.textContent.trim() === 'Reintentar',
    );
    expect(btn).toBeTruthy();
    btn?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(refreshSpy).toHaveBeenCalledTimes(1);
  });

  it('header reload button still calls cache.menuEngineering.refresh', async () => {
    const refreshSpy = vi.fn();
    const stub = makeMenuEngineeringStub({
      isLoading: () => false,
      error: () => null,
      data: () => makeReport({ items: [makeItem()] }),
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

  it('renders the cacheStatus line when cacheStatus is non-null', async () => {
    const stub = makeMenuEngineeringStub({
      isLoading: () => false,
      error: () => null,
      data: () => makeReport({ withCacheStatus: true, items: [makeItem()] }),
    });
    const fixture = await setup(stub);
    const root = getRoot(fixture);
    const text = root.textContent;

    expect(text).toContain('Caché actualizado');
    expect(text).toContain('2026-07-17T12:00:00Z');
    expect(text).toContain('v1.2.3');
    expect(text).toContain('1800');
  });

  it('renders an error p-message when error() is truthy', async () => {
    const err = new Error('Cache miss');
    const stub = makeMenuEngineeringStub({
      isLoading: () => false,
      data: () => null,
      error: () => err,
    });
    const fixture = await setup(stub);
    const root = getRoot(fixture);

    const msg = root.querySelector('p-message');
    expect(msg).toBeTruthy();
    const text = root.textContent;
    expect(text).toContain('No se pudieron cargar los datos');
    expect(text).toContain('Cache miss');
  });

  it('renders the category filter inside the table caption and filters items by categoryId', async () => {
    const stub = makeMenuEngineeringStub({
      isLoading: () => false,
      error: () => null,
      data: () =>
        makeReport({
          items: [
            makeItem({ productId: 1, productName: 'Coca Cola', categoryId: 10, categoryName: 'Bebidas' }),
            makeItem({ productId: 2, productName: 'Hamburguesa', categoryId: 20, categoryName: 'Comida' }),
            makeItem({ productId: 3, productName: 'Jugo', categoryId: 10, categoryName: 'Bebidas' }),
          ],
        }),
    });
    const fixture = await setup(stub);
    const cmp = fixture.componentInstance;
    const root = getRoot(fixture);

    // Filter control lives inside the table caption (PrimeNG renders
    // pTemplate="caption" inside a div with the "header" style class).
    const filter = root.querySelector('[data-testid="me-category-filter"]');
    expect(filter).toBeTruthy();
    const headerContainer = root.querySelector('p-table .p-datatable-header');
    expect(headerContainer).toBeTruthy();
    expect(headerContainer?.contains(filter)).toBe(true);

    // 3 items before filter
    expect(cmp.items().length).toBe(3);

    // Apply category filter (id=10)
    cmp.onCategoryChange(10);
    fixture.detectChanges();
    expect(cmp.items().length).toBe(2);
    expect(cmp.items().every((it) => it.categoryId === 10)).toBe(true);

    // Clear filter
    cmp.clearCategory();
    fixture.detectChanges();
    expect(cmp.items().length).toBe(3);
  });

  it('builds unique categories from report items (sorted by name)', async () => {
    const stub = makeMenuEngineeringStub({
      isLoading: () => false,
      error: () => null,
      data: () =>
        makeReport({
          items: [
            makeItem({ productId: 1, categoryId: 20, categoryName: 'Comida' }),
            makeItem({ productId: 2, categoryId: 10, categoryName: 'Bebidas' }),
            makeItem({ productId: 3, categoryId: 10, categoryName: 'Bebidas' }),
            makeItem({ productId: 4, categoryId: null, categoryName: null }),
          ],
        }),
    });
    const fixture = await setup(stub);
    const cmp = fixture.componentInstance;

    const cats = cmp.categories();
    // Items without categoryId are dropped; duplicates collapsed
    expect(cats).toEqual([
      { id: 10, name: 'Bebidas' },
      { id: 20, name: 'Comida' },
    ]);
  });

  it('sorts Money columns numerically (totalContribution) via onSort comparator', async () => {
    const stub = makeMenuEngineeringStub({
      isLoading: () => false,
      error: () => null,
      data: () =>
        makeReport({
          items: [
            makeItem({ productId: 1, productName: 'A', totalContribution: '9000.00' }),
            makeItem({ productId: 2, productName: 'B', totalContribution: '100000.00' }),
            makeItem({ productId: 3, productName: 'C', totalContribution: '100.00' }),
          ],
        }),
    });
    const fixture = await setup(stub);
    const cmp = fixture.componentInstance;
    const items = cmp.items().slice();
    cmp.onSort({ data: items, field: 'totalContribution', order: 1 });

    // Ascending numeric order: 100.00 < 9000.00 < 100000.00
    // (default PrimeNG localeCompare would have sorted "100000" before "9000").
    expect(items.map((i) => i.totalContribution.amount)).toEqual([
      '100.00', '9000.00', '100000.00',
    ]);
  });
});
/**
 * Tests for the MenuEngineering analytics page.
 *
 * Feature: Displays menu engineering matrix (stars, plowhorses, puzzles, dogs).
 * Contract: Loads analytics data, renders KPI cards and chart with correct values.
 * Approach: Mount component via TestBed, mock HTTP responses, assert rendered KPI values.
 */
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
    load?: () => void;
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
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      load: overrides.load ?? ((): void => {}),
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

  it('calls cache.menuEngineering.load via the period effect on construction', async () => {
    const loadSpy = vi.fn();
    const stub = makeMenuEngineeringStub({
      isLoading: () => false,
      error: () => null,
      data: () => null,
      load: loadSpy,
    });
    await setup(stub);
    expect(loadSpy).toHaveBeenCalled();
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
    const chartData = cmp.quadrantChartData();
    expect(chartData.datasets.length).toBe(4);
    const figure = root.querySelector('figure');
    expect(figure).toBeTruthy();
    expect(figure?.querySelectorAll('figcaption').length).toBe(2);
    const srFig = figure?.querySelector('figcaption.sr-only');
    expect(srFig?.textContent ?? '').toContain('Mapa');
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
    expect(srFig?.textContent ?? '').toContain('3');
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
    expect(text).toContain('Productos analizados');
    expect(text).toContain('Ganancia que generan');
    expect(text).toContain('Ventas típicas');
    expect(text).toContain('Margen típico');
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
    // Money on 9000.00 COP renders "$ 9.000" or similar localized
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
    // Three quadrant badges (icon+label spans in Cuadrante column)
    const badges = root.querySelectorAll('p-table tbody tr td:last-child span.inline-flex');
    expect(badges.length).toBe(3);
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
    expect(text).toContain('No hay productos para mostrar');
    expect(root.querySelectorAll('p-table tbody tr td:last-child span.inline-flex').length).toBe(0);
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

    expect(cmp.quadrantLabel('STAR')).toBe('Excelente');
    expect(cmp.quadrantLabel('PLOWHORSE')).toBe('Populares');
    expect(cmp.quadrantLabel('PUZZLE')).toBe('Oportunidad');
    expect(cmp.quadrantLabel('DOG')).toBe('A revisar');
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
    const items = root.querySelectorAll('ul li');
    expect(items.length).toBeGreaterThanOrEqual(1);
  });

  it('renders the EMPTY banner with "Aún no hay datos de productos" headline', async () => {
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
    expect(root.textContent).toContain('Aún no hay datos de productos');
    expect(root.textContent).not.toContain('Datos parciales');
  });

  it('does NOT render the partial banner when completeness is FULL', async () => {
    const stub = makeMenuEngineeringStub({
      isLoading: () => false,
      error: () => null,
      data: () => makeReport({ dataCompleteness: 'FULL', items: [makeItem()] }),
    });
    const fixture = await setup(stub);
    const root = getRoot(fixture);
    expect(root.textContent).not.toContain('Datos parciales');
    expect(root.textContent).not.toContain('Aún no hay datos de productos');
  });

  it('does not render the per-feature Actualizar button (lives in the shared dock now)', async () => {
    const fixture = await setup(
      makeMenuEngineeringStub({
        data: () => makeReport({ items: [makeItem()] }),
      }),
    );
    const btn = Array.from(getRoot(fixture).querySelectorAll('button')).find(
      (b) => b.textContent.trim() === 'Actualizar',
    );
    expect(btn).toBeUndefined();
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

    expect(text).toContain('Última actualización');
    expect(text).toContain('2026-07-17T12:00:00Z');
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

  it('dedupes topItems by name so products with the same name do not repeat', async () => {
    const stub = makeMenuEngineeringStub({
      isLoading: () => false,
      error: () => null,
      data: () =>
        makeReport({
          items: [
            makeItem({ productId: 1, productName: 'Hamburguesa', totalContribution: '900.00', quadrant: 'STAR' }),
            makeItem({ productId: 2, productName: 'Hamburguesa', totalContribution: '800.00', quadrant: 'STAR' }),
            makeItem({ productId: 3, productName: 'Ensalada', totalContribution: '700.00', quadrant: 'STAR' }),
            makeItem({ productId: 4, productName: 'Té', totalContribution: '600.00', quadrant: 'STAR' }),
          ],
        }),
    });
    const fixture = await setup(stub);
    const cmp = fixture.componentInstance;

    const starQuadrant = cmp.quadrantSummary().find((q) => q.quadrant === 'STAR');
    if (!starQuadrant) throw new Error('STAR quadrant not found');
    expect(starQuadrant.topItems).toEqual(['Hamburguesa', 'Ensalada', 'Té']);
    // No name appears more than once.
    const nameCount = new Map<string, number>();
    for (const name of starQuadrant.topItems) {
      nameCount.set(name, (nameCount.get(name) ?? 0) + 1);
    }
    for (const [, count] of nameCount) {
      expect(count).toBe(1);
    }
  });

  it('initialises selectedQuadrant to null', async () => {
    const fixture = await setup(makeMenuEngineeringStub({ data: () => makeReport({ items: [] }) }));
    const cmp = fixture.componentInstance;
    expect(cmp.selectedQuadrant()).toBeNull();
  });

  it('onQuadrantClick sets selectedQuadrant when clicking a new quadrant', async () => {
    const fixture = await setup(makeMenuEngineeringStub({ data: () => makeReport({ items: [] }) }));
    const cmp = fixture.componentInstance;

    cmp.onQuadrantClick('STAR');
    expect(cmp.selectedQuadrant()).toBe('STAR');

    cmp.onQuadrantClick('PLOWHORSE');
    expect(cmp.selectedQuadrant()).toBe('PLOWHORSE');
  });

  it('onQuadrantClick clears selectedQuadrant when clicking the same quadrant again', async () => {
    const fixture = await setup(makeMenuEngineeringStub({ data: () => makeReport({ items: [] }) }));
    const cmp = fixture.componentInstance;

    cmp.onQuadrantClick('STAR');
    expect(cmp.selectedQuadrant()).toBe('STAR');

    cmp.onQuadrantClick('STAR');
    expect(cmp.selectedQuadrant()).toBeNull();
  });

  it('clearQuadrantFilter resets selectedQuadrant to null', async () => {
    const fixture = await setup(makeMenuEngineeringStub({ data: () => makeReport({ items: [] }) }));
    const cmp = fixture.componentInstance;

    cmp.onQuadrantClick('DOG');
    expect(cmp.selectedQuadrant()).toBe('DOG');

    cmp.clearQuadrantFilter();
    expect(cmp.selectedQuadrant()).toBeNull();
  });

  it('items() filters by both categoryId and selectedQuadrant', async () => {
    const fixture = await setup(
      makeMenuEngineeringStub({
        data: () =>
          makeReport({
            items: [
              makeItem({ productId: 1, productName: 'A', categoryId: 10, quadrant: 'STAR' }),
              makeItem({ productId: 2, productName: 'B', categoryId: 10, quadrant: 'DOG' }),
              makeItem({ productId: 3, productName: 'C', categoryId: 20, quadrant: 'STAR' }),
              makeItem({ productId: 4, productName: 'D', categoryId: 10, quadrant: 'STAR' }),
            ],
          }),
      }),
    );
    const cmp = fixture.componentInstance;

    // No filter
    expect(cmp.items().length).toBe(4);

    // Filter by quadrant only — DOG matches only B
    cmp.onQuadrantClick('DOG');
    expect(cmp.items().length).toBe(1);
    expect(cmp.items()[0].productName).toBe('B');

    // Filter by quadrant + category 10 — B has categoryId 10 + DOG, so still 1
    cmp.onCategoryChange(10);
    expect(cmp.items().length).toBe(1);
    expect(cmp.items()[0].productName).toBe('B');
  });

  it('isQuadrantSelected returns true only for the selected quadrant', async () => {
    const fixture = await setup(makeMenuEngineeringStub({ data: () => makeReport({ items: [] }) }));
    const cmp = fixture.componentInstance;

    expect(cmp.isQuadrantSelected('STAR')).toBe(false);
    expect(cmp.isQuadrantSelected('PLOWHORSE')).toBe(false);
    expect(cmp.isQuadrantSelected('PUZZLE')).toBe(false);
    expect(cmp.isQuadrantSelected('DOG')).toBe(false);

    cmp.onQuadrantClick('STAR');
    expect(cmp.isQuadrantSelected('STAR')).toBe(true);
    expect(cmp.isQuadrantSelected('DOG')).toBe(false);
  });

  it('sellPricePerUnit returns null when unitsSold is 0', async () => {
    const fixture = await setup(makeMenuEngineeringStub({ data: () => makeReport({ items: [] }) }));
    const cmp = fixture.componentInstance;

    expect(cmp.sellPricePerUnit({ ...makeItem(), unitsSold: 0 })).toBeNull();
    expect(cmp.sellPricePerUnit(makeItem())).toEqual({ amount: '10000.00', currency: 'COP' });
  });

  it('marginPercent returns null when unitsSold is 0', async () => {
    const fixture = await setup(makeMenuEngineeringStub({ data: () => makeReport({ items: [] }) }));
    const cmp = fixture.componentInstance;

    expect(cmp.marginPercent({ ...makeItem(), unitsSold: 0 })).toBeNull();
    expect(cmp.marginPercent(makeItem())).toBeCloseTo(60, 0); // 6000/10000 = 0.6 => 60%
  });

  it('fmtPercent returns formatted percentage string', async () => {
    const fixture = await setup(makeMenuEngineeringStub({ data: () => makeReport({ items: [] }) }));
    const cmp = fixture.componentInstance;

    expect(cmp.fmtPercent(50)).toBe('50.0%');
    expect(cmp.fmtPercent(12.34)).toBe('12.3%');
    expect(cmp.fmtPercent(null)).toBe('—');
  });

  it('selectedQuadrantMeta returns the quadrant meta when a quadrant is selected', async () => {
    const fixture = await setup(makeMenuEngineeringStub({ data: () => makeReport({ items: [] }) }));
    const cmp = fixture.componentInstance;

    expect(cmp.selectedQuadrantMeta()).toBeNull();

    cmp.onQuadrantClick('STAR');
    expect(cmp.selectedQuadrantMeta()?.label).toBe('Excelente');
    expect(cmp.selectedQuadrantMeta()?.icon).toBe('pi pi-star-fill');
  });

  it('renders aria-pressed on the selected quadrant card button', async () => {
    const fixture = await setup(
      makeMenuEngineeringStub({
        data: () => makeReport({ items: [makeItem()] }),
      }),
    );
    const root = getRoot(fixture);
    const cmp = fixture.componentInstance;

    const starBtn = root.querySelector('[data-quadrant="STAR"]');
    expect(starBtn?.getAttribute('aria-pressed')).toBe('false');

    cmp.onQuadrantClick('STAR');
    fixture.detectChanges();
    expect(starBtn?.getAttribute('aria-pressed')).toBe('true');
  });

  it('sorts by recipeCost numerically via onSort comparator', async () => {
    const fixture = await setup(
      makeMenuEngineeringStub({
        data: () =>
          makeReport({
            items: [
              makeItem({ productId: 1, productName: 'A', recipeCost: '3000.00' }),
              makeItem({ productId: 2, productName: 'B', recipeCost: '1000.00' }),
              makeItem({ productId: 3, productName: 'C', recipeCost: '2000.00' }),
            ],
          }),
      }),
    );
    const cmp = fixture.componentInstance;
    const items = cmp.items().slice();
    cmp.onSort({ data: items, field: 'recipeCost', order: 1 });

    expect(items.map((i) => i.recipeCost.amount)).toEqual(['1000.00', '2000.00', '3000.00']);
  });

  it('sorts by sellPricePerUnit numerically via onSort comparator', async () => {
    const fixture = await setup(
      makeMenuEngineeringStub({
        data: () =>
          makeReport({
            items: [
              makeItem({ productId: 1, productName: 'A', revenue: '50000.00', unitsSold: 5 }),
              makeItem({ productId: 2, productName: 'B', revenue: '30000.00', unitsSold: 10 }),
              makeItem({ productId: 3, productName: 'C', revenue: '40000.00', unitsSold: 5 }),
            ],
          }),
      }),
    );
    const cmp = fixture.componentInstance;
    const items = cmp.items().slice();
    cmp.onSort({ data: items, field: 'sellPricePerUnit', order: 1 });

    // sellPricePerUnit = revenue / unitsSold
    // A: 50000/5 = 10000, B: 30000/10 = 3000, C: 40000/5 = 8000
    expect(items.map((i) => cmp.sellPricePerUnit(i)?.amount)).toEqual(['3000.00', '8000.00', '10000.00']);
  });

  it('sorts by marginPercent numerically via onSort comparator', async () => {
    const fixture = await setup(
      makeMenuEngineeringStub({
        data: () =>
          makeReport({
            items: [
              makeItem({ productId: 1, productName: 'A', grossProfitPerUnit: '8000.00', revenue: '10000.00', unitsSold: 1 }),
              makeItem({ productId: 2, productName: 'B', grossProfitPerUnit: '3000.00', revenue: '10000.00', unitsSold: 1 }),
              makeItem({ productId: 3, productName: 'C', grossProfitPerUnit: '5000.00', revenue: '10000.00', unitsSold: 1 }),
            ],
          }),
      }),
    );
    const cmp = fixture.componentInstance;
    const items = cmp.items().slice();
    cmp.onSort({ data: items, field: 'marginPercent', order: -1 });

    // marginPercent = (grossProfitPerUnit / (revenue/unitsSold)) * 100
    // For A: 8000/(10000/1) = 0.8 → 80%, B: 3000/10000 = 0.3 → 30%, C: 5000/10000 = 0.5 → 50%
    // Descending: 80, 50, 30
    expect(items.map((i) => cmp.marginPercent(i))).toEqual([80, 50, 30]);
  });

  it('quadrantMeta returns the full meta object for a quadrant', async () => {
    const fixture = await setup(makeMenuEngineeringStub({ data: () => makeReport({ items: [] }) }));
    const cmp = fixture.componentInstance;

    const meta = cmp.quadrantMeta('STAR');
    expect(meta.label).toBe('Excelente');
    expect(meta.icon).toBe('pi pi-star-fill');
    expect(meta.action).toBe('Venden bien y dejan buena ganancia. Protégelos: evita cambiarlos.');
    expect(meta.borderClass).toBe('border-green-300 dark:border-green-700');
    expect(meta.bgClass).toBe('bg-green-50 dark:bg-green-900/20');
    expect(meta.ringClass).toBe('ring-2 ring-green-500');
  });
});
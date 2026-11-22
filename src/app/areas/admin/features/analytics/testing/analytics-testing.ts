import { ɵresolveComponentResources as resolveComponentResources, signal, type Signal } from '@angular/core';
import { of, type Observable } from 'rxjs';

import type { CohortReport } from '@app/shared/models/dto/analytics/cohort-report';
import type { MenuEngineeringReport } from '@app/shared/models/dto/analytics/menu-engineering-report';
import type { Money } from '@app/shared/models/dto/analytics/money';
import type { OperationsReport } from '@app/shared/models/dto/analytics/operations-report';
import type { PrimeCostReport } from '@app/shared/models/dto/analytics/prime-cost-report';
import type { AlertsPage, SystemAlert } from '@app/shared/models/dto/analytics/system-alert';

/** Resolves the external templates a spec needs; unknown URLs become ''. */
export async function resolveTemplates(resources: Record<string, string>): Promise<void> {
  await resolveComponentResources((url: string): Promise<string> => {
    for (const [name, content] of Object.entries(resources)) {
      if (url.endsWith(name)) return Promise.resolve(content);
    }
    return Promise.resolve('');
  });
}

/** jsdom has no canvas; Chart.js only needs a context object to construct. */
export function installCanvasContextStub(): void {
  if (typeof HTMLCanvasElement === 'undefined') return;
  const proto = HTMLCanvasElement.prototype as unknown as Record<string, unknown>;
  if (proto['__analyticsStubbed'] === true) return;

  type StubCtx = Record<string, unknown>;
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
  proto['__analyticsStubbed'] = true;
}

export class CacheEntryStub<T> {
  readonly data: Signal<T | null>;
  readonly isLoading: Signal<boolean>;
  readonly error: Signal<Error | undefined>;
  readonly status: Signal<'fresh' | 'stale' | 'loading'>;
  readonly hasData: Signal<boolean>;

  load = (): void => {
    // no-op by default
  };
  refresh = (): void => {
    // no-op by default
  };
  invalidate = (): void => {
    // no-op by default
  };
  loadIfStale = (): void => {
    // no-op by default
  };

  constructor(options: { data?: T | null; loading?: boolean; error?: Error } = {}) {
    this.data = signal<T | null>(options.data ?? null);
    this.isLoading = signal(options.loading ?? false);
    this.error = signal<Error | undefined>(options.error);
    this.status = signal<'fresh' | 'stale' | 'loading'>('fresh');
    this.hasData = signal(options.data !== undefined && options.data !== null);
  }
}

export interface CacheStubOptions {
  primeCost?: { data?: PrimeCostReport | null; loading?: boolean; error?: Error };
  menuEngineering?: { data?: MenuEngineeringReport | null; loading?: boolean; error?: Error };
  operations?: { data?: OperationsReport | null; loading?: boolean; error?: Error };
  operationsPrevious?: { data?: OperationsReport | null; loading?: boolean; error?: Error };
  cohort?: { data?: CohortReport | null; loading?: boolean; error?: Error };
}

export function makeCacheStub(options: CacheStubOptions = {}): {
  primeCost: CacheEntryStub<PrimeCostReport>;
  menuEngineering: CacheEntryStub<MenuEngineeringReport>;
  operations: CacheEntryStub<OperationsReport>;
  operationsPrevious: CacheEntryStub<OperationsReport>;
  cohort: CacheEntryStub<CohortReport>;
  refreshAll: () => Observable<Record<string, unknown>>;
} {
  return {
    primeCost: new CacheEntryStub(options.primeCost),
    menuEngineering: new CacheEntryStub(options.menuEngineering),
    operations: new CacheEntryStub(options.operations),
    operationsPrevious: new CacheEntryStub(options.operationsPrevious),
    cohort: new CacheEntryStub(options.cohort),
    refreshAll: () => of({ refreshed: true }),
  };
}

export function money(amount: string, currency = 'COP'): Money {
  return { amount, currency };
}

export function makePrimeCostReport(overrides: Partial<PrimeCostReport> = {}): PrimeCostReport {
  return {
    period: {
      bucket: 'monthly',
      from: '2026-06',
      to: '2026-07',
      keys: ['2026-06', '2026-07'],
    },
    series: [
      {
        key: '2026-06',
        netSales: money('240869900.00'),
        grossSales: money('240869900.00'),
        discounts: money('0.00'),
        comped: money('0.00'),
        cogs: {
          total: money('74497484.44'),
          byCategory: [
            { category: 'FOOD', amount: money('68372993.50'), pct: 91.78 },
            { category: 'BEVERAGE', amount: money('584840.94'), pct: 0.79 },
            { category: 'ALCOHOL', amount: money('3012700.00'), pct: 4.04 },
            { category: 'OTHER', amount: money('2526950.00'), pct: 3.39 },
          ],
        },
        labor: {
          total: money('33500000.00'),
          byArea: [
            { area: 'FOH', amount: money('14400000.00'), pct: 42.99 },
            { area: 'BOH', amount: money('19100000.00'), pct: 57.01 },
          ],
        },
        primeCost: money('107997484.44'),
        primeCostPct: 44.84,
        margins: { grossProfitPct: 69.07, netProfitPct: 55.16 },
        dataCompleteness: 'FULL',
      },
      {
        key: '2026-07',
        netSales: money('221941700.00'),
        grossSales: money('221941700.00'),
        discounts: money('0.00'),
        comped: money('0.00'),
        cogs: {
          total: money('68133310.34'),
          byCategory: [
            { category: 'FOOD', amount: money('62416867.00'), pct: 91.61 },
            { category: 'BEVERAGE', amount: money('503293.34'), pct: 0.74 },
            { category: 'ALCOHOL', amount: money('2974800.00'), pct: 4.37 },
            { category: 'OTHER', amount: money('2238350.00'), pct: 3.29 },
          ],
        },
        labor: {
          total: money('33500000.00'),
          byArea: [
            { area: 'FOH', amount: money('14400000.00'), pct: 42.99 },
            { area: 'BOH', amount: money('19100000.00'), pct: 57.01 },
          ],
        },
        primeCost: money('101633310.34'),
        primeCostPct: 45.79,
        margins: { grossProfitPct: 69.3, netProfitPct: 54.21 },
        dataCompleteness: 'FULL',
      },
    ],
    dataCompleteness: 'FULL',
    ...overrides,
  };
}

function menuItem(
  productId: number,
  productName: string,
  unitsSold: number,
  grossProfit: string,
  quadrant: 'STAR' | 'PLOWHORSE' | 'PUZZLE' | 'DOG',
): MenuEngineeringReport['items'][number] {
  const gp = Number.parseFloat(grossProfit);
  return {
    productId,
    productName,
    categoryId: 1,
    categoryName: 'Hamburguesas',
    unitsSold,
    revenue: money(`${String((gp + 8000) * unitsSold)}.00`),
    recipeCost: money('8000.00'),
    avgOptionCost: money('0.00'),
    effectiveCost: money('8000.00'),
    grossProfitPerUnit: money(grossProfit),
    totalContribution: money((gp * unitsSold).toFixed(2)),
    quadrant,
  };
}

export function makeMenuReport(
  overrides: Partial<MenuEngineeringReport> = {},
): MenuEngineeringReport {
  return {
    period: { bucket: 'monthly', from: '2026-06', to: '2026-07', keys: ['2026-06', '2026-07'] },
    median: { volume: 326, margin: money('18209.00') },
    items: [
      menuItem(1, 'Hamburguesa Double Bacon Cheese', 811, '14670.00', 'PLOWHORSE'),
      menuItem(2, 'Pizza Especial Familiar', 424, '27315.00', 'STAR'),
      menuItem(4, 'Corte de Res Premium', 271, '38787.00', 'PUZZLE'),
      menuItem(8, 'Hamburguesa Veggie', 291, '13430.00', 'DOG'),
    ],
    cacheStatus: {
      lastRefreshedAt: '2026-11-21T16:59:00Z',
      sourceVersion: 'seed-v1',
      ttlSeconds: 86400,
    },
    dataCompleteness: 'FULL',
    ...overrides,
  };
}

export function makeOperationsReport(
  overrides: Partial<OperationsReport> = {},
): OperationsReport {
  return {
    period: { bucket: 'monthly', from: '2026-06', to: '2026-11', keys: ['2026-06'] },
    revPash: {
      value: money('8549.39'),
      totalNetSales: money('1389309900.00'),
      totalAvailableSeatHours: 162504,
    },
    tableTurnover: {
      overall: 2237.9,
      byDayPart: [
        { dayPart: 'LUNCH', turns: 846, covers: 16920, tables: 20 },
        { dayPart: 'DINNER', turns: 1234.85, covers: 24697, tables: 20 },
        { dayPart: 'OTHER', turns: 157.05, covers: 3141, tables: 20 },
      ],
    },
    labor: { totalCost: money('186591398.00'), sharePct: 13.43 },
    covers: 44758,
    orders: 16583,
    avgOccupancyMinutes: 60.52,
    totalOccupiedSeatMinutes: 2711125,
    dataCompleteness: 'FULL',
    ...overrides,
  };
}

export function makeCohortReport(overrides: Partial<CohortReport> = {}): CohortReport {
  return {
    period: { bucket: 'monthly', from: '2026-06', to: '2026-07', keys: ['2026-06', '2026-07'] },
    newClients: 0,
    recurringClients: 5527,
    totalOrders: 5527,
    recurringRatePct: 100,
    averageTicketPerOrder: money('83773.50'),
    averageTicketPerCover: money('31040.81'),
    fingerprintStrategy: 'TABLE_ONLY',
    cohortWindowDays: 90,
    cohorts: [
      { key: '2026-06', newClients: 0, recurringClients: 2892, totalOrders: 2892, recurringRatePct: 100 },
      { key: '2026-07', newClients: 0, recurringClients: 2635, totalOrders: 2635, recurringRatePct: 100 },
    ],
    dataCompleteness: 'PARTIAL',
    notes: ['Phone number captured on 0.00% of orders in range.'],
    ...overrides,
  };
}

export function makeAlert(overrides: Partial<SystemAlert> = {}): SystemAlert {
  return {
    id: 1,
    severity: 'RED',
    type: 'FOOD_COST_DEVIATION',
    message: 'Food cost is 2.08 pp above the 12-month moving average',
    metric: 'food_cost_pct',
    baseline: 30.62,
    current: 32.7,
    deviationPct: 6.79,
    period: '2026-10',
    bucket: 'monthly',
    detectedAt: '2026-11-20T04:00:00Z',
    status: 'OPEN',
    ...overrides,
  };
}

export function makeAlertsPage(overrides: Partial<AlertsPage> = {}): AlertsPage {
  const items = [
    makeAlert(),
    makeAlert({
      id: 2,
      severity: 'YELLOW',
      type: 'LOW_MARGIN_SKU_SPIKE',
      metric: 'dog_units',
      baseline: 50,
      current: 80,
      deviationPct: 60,
      period: '2026-W45',
      bucket: 'weekly',
      status: 'READ',
    }),
  ];
  return { items, page: { limit: 25, offset: 0, total: 2 }, ...overrides };
}

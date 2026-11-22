/**
 * Tests for the admin dashboard KPIs.
 *
 * Feature: The dashboard aggregates today's orders (sales, completed/preparing
 * counters, sales composition) after `Order.getAllTodayOrders()` has page-walked
 * the whole day.
 * Contract:
 *  - the KPI totals sum over EVERY walked page, not just the first one;
 *  - non-DELIVERED orders never contribute to `totalSales` / `salesByCategory`;
 *  - a failing walk leaves the signals empty without throwing;
 *  - `calcTotal()` delegates to `calculateTotalPrice()`, which prefers the
 *    server-computed `total` and never double-counts `extraCharge`.
 *
 * Approach: mount the component's logic through TestBed with the REAL `Order`
 * service and `HttpTestingController`, so the multi-page walk is exercised
 * end-to-end (page 0 and page 1 are flushed separately). Boundaries only
 * (HTTP, WebSocket, Auth, tables/products services) are stubbed.
 */
import { ChangeDetectorRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { NEVER, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MAX_ORDER_PAGES, Order } from '@app/core/services/orders/order';
import { Table } from '@app/core/services/tables/table';
import { Product } from '@app/core/services/products/product';
import { Logging } from '@app/core/services/logging/logging';
import { WebSocket } from '@app/core/services/websocket/websocket';
import { Auth } from '@app/core/services/auth/auth';
import { ServerStatus } from '@app/core/services/server-status/server-status';
import type { OrderResponse } from '@app/shared/models/dto/orders/order-response';
import type { MoneyLike } from '@app/shared/models/dto/common/money';
import type { TableResponse } from '@app/shared/models/dto/tables/table-response';
import { Dashboard } from './dashboard';

function makeOrder(
  id: number,
  status: string,
  details: {
    /** `MoneyDto` (`{ amount: "15000.00", currency: "COP" }`) or a bare number. */
    unitPrice: MoneyLike;
    extraCharge?: MoneyLike;
    categoryName?: string;
  }[],
): OrderResponse {
  return {
    id,
    date: '2026-07-15T12:00:00',
    status,
    tableId: 1,
    details: details.map((detail, index) => ({
      id: id * 100 + index,
      productId: index + 1,
      productName: `Producto ${String(index + 1)}`,
      categoryName: detail.categoryName ?? 'Bebidas',
      unitPrice: detail.unitPrice,
      extraCharge: detail.extraCharge,
      instructions: '',
    })),
  };
}

describe('Dashboard order aggregates', () => {
  let httpMock: HttpTestingController;
  let dashboard: Dashboard;

  const pageOne = Array.from({ length: 50 }, (_, index) =>
    makeOrder(index + 1, 'DELIVERED', [{ unitPrice: 1000, extraCharge: 0 }]),
  );
  // Second page adds one delivered order and one preparing order.
  const pageTwo = [
    makeOrder(51, 'DELIVERED', [{ unitPrice: 4000, extraCharge: 1000 }]),
    makeOrder(52, 'PREPARING', [{ unitPrice: 99_000 }]),
  ];

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        Order,
        { provide: Table, useValue: { getTables: () => of<TableResponse[]>([]) } },
        { provide: Product, useValue: { getProductById: () => of(null), getProducts: () => of([]) } },
        {
          provide: Logging,
          useValue: { debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
        },
        {
          provide: WebSocket,
          useValue: { connect: vi.fn(), subscribeToTopic: vi.fn(() => NEVER) },
        },
        { provide: Auth, useValue: { getToken: () => null } },
        { provide: ServerStatus, useValue: { status: () => 'online', check: vi.fn() } },
        {
          provide: ChangeDetectorRef,
          useValue: { markForCheck: vi.fn(), detectChanges: vi.fn() },
        },
      ],
    });

    httpMock = TestBed.inject(HttpTestingController);
    dashboard = TestBed.runInInjectionContext(() => new Dashboard());
  });

  afterEach(() => {
    httpMock.verify();
    vi.useRealTimers();
  });

  function startLoad(): void {
    dashboard.ngOnInit();
    vi.advanceTimersByTime(0);
  }

  it('sums KPIs across every walked page, not just the first', () => {
    startLoad();

    httpMock
      .expectOne((r) => r.url === 'v1/orders' && r.params.get('page') === '0')
      .flush({ items: pageOne, total: 52, page: 0, size: 50, total_pages: 2 });

    httpMock
      .expectOne((r) => r.url === 'v1/orders' && r.params.get('page') === '1')
      .flush({ items: pageTwo, total: 52, page: 1, size: 50, total_pages: 2 });

    // 50 × 1000 from page 0 + 4000 from page 1; the PREPARING order is excluded
    // and `extraCharge` is not added on top of the inclusive `unitPrice`.
    expect(dashboard.totalSales()).toBe(54_000);
    expect(dashboard.completedOrdersCount()).toBe(51);
    expect(dashboard.preparingOrdersCount()).toBe(1);
    expect(dashboard.salesByCategoryTotal()).toBe(54_000);
  });

  it('exposes the walked orders so the day is not truncated to one page', () => {
    startLoad();

    httpMock
      .expectOne((r) => r.url === 'v1/orders' && r.params.get('page') === '0')
      .flush({ items: pageOne, total: 52, page: 0, size: 50, total_pages: 2 });
    httpMock
      .expectOne((r) => r.url === 'v1/orders' && r.params.get('page') === '1')
      .flush({ items: pageTwo, total: 52, page: 1, size: 50, total_pages: 2 });
    expect(dashboard.orders()).toHaveLength(52);
    expect(dashboard.orders().at(-1)?.id).toBe(52);
  });

  it('does not double-count extraCharge in the per-order total', () => {
    const order = makeOrder(9, 'DELIVERED', [
      { unitPrice: 10_000, extraCharge: 2500 },
      { unitPrice: 5000 },
    ]);

    expect(dashboard.calcTotal(order)).toBe(15_000);
  });

  it('prefers the server-computed total over line arithmetic', () => {
    const order = makeOrder(10, 'DELIVERED', [{ unitPrice: 10_000, extraCharge: 2500 }]);
    order.total = { amount: '12500.00', currency: 'COP' };

    expect(dashboard.calcTotal(order)).toBe(12_500);
  });

  it('sums MoneyDto details to the exact KPI total instead of NaN', () => {
    // The real wire shape: every monetary field is a money object.
    const moneyOrder = makeOrder(12, 'DELIVERED', [
      { unitPrice: { amount: '15000.00', currency: 'COP' }, categoryName: 'Platos' },
      {
        unitPrice: { amount: '10000.00', currency: 'COP' },
        extraCharge: { amount: '2500.00', currency: 'COP' },
        categoryName: 'Platos',
      },
    ]);

    startLoad();
    httpMock
      .expectOne((r) => r.url === 'v1/orders' && r.params.get('page') === '0')
      .flush({ items: [moneyOrder], total: 1, page: 0, size: 50, total_pages: 1 });

    expect(dashboard.totalSales()).toBe(25_000);
    expect(Number.isNaN(dashboard.totalSales())).toBe(false);
    expect(dashboard.salesByCategoryTotal()).toBe(25_000);
    expect(dashboard.topProductsTotal()).toBe(25_000);
  });

  it('flags a capped walk so the KPIs are not presented as complete', () => {
    startLoad();

    for (let pageIndex = 0; pageIndex < MAX_ORDER_PAGES; pageIndex++) {
      httpMock
        .expectOne((r) => r.url === 'v1/orders' && r.params.get('page') === String(pageIndex))
        .flush({ items: pageOne, total: 5000, page: pageIndex, size: 50, total_pages: 100 });
    }

    expect(dashboard.orders()).toHaveLength(MAX_ORDER_PAGES * 50);
    expect(dashboard.ordersTruncated()).toBe(true);
  });

  it('keeps empty aggregates and stops loading when the order walk fails', () => {    startLoad();

    httpMock
      .expectOne((r) => r.url === 'v1/orders' && r.params.get('page') === '0')
      .flush('boom', { status: 500, statusText: 'Server Error' });
    expect(dashboard.orders()).toEqual([]);
    expect(dashboard.totalSales()).toBe(0);
    expect(dashboard.isOrdersLoading()).toBe(false);
    expect(dashboard.isStatsLoaded()).toBe(true);
  });
});

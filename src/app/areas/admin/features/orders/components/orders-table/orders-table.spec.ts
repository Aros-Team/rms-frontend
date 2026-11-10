/**
 * Tests for the admin orders table (server-side paging).
 *
 * Feature: The orders table is a PrimeNG *lazy* table; every page change is
 * answered by `Order.getOrdersByDateRangePage()`, so only one page of orders is
 * ever in memory.
 * Contract:
 *  - the initial load requests `page=0` with the table's `rows` as `size`;
 *  - a lazy-load event at `first=20, rows=10` requests `page=2`;
 *  - the duplicate lazy-load emission that PrimeNG fires right after `ngOnInit`
 *    does not trigger a second HTTP round-trip;
 *  - changing the search term resets to page 0 and sends `search`;
 *  - `totalRecords` mirrors the server `total` (drives the paginator);
 *  - a failed request surfaces an error message and clears the loading flag;
 *  - `getOrderTotal()` normalizes `MoneyDto` line values (`{ amount: "..." }`)
 *    through `calculateTotalPrice()`, so a `MoneyDto` order yields an exact
 *    number instead of `NaN`.
 *
 * Approach: mount the component with real template, provide a stub `Order`
 * service that records its arguments and returns a controlled page, drive the
 * component through its public entry points, and assert the exact query objects
 * plus the resulting component state.
 */
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ɵresolveComponentResources as resolveComponentResources } from '@angular/core';
import { MessageService } from 'primeng/api';
import { of, throwError } from 'rxjs';
import { beforeAll, beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

import { Order } from '@app/core/services/orders/order';
import { WebSocket } from '@app/core/services/websocket/websocket';
import { Auth } from '@app/core/services/auth/auth';
import type { OrderResponse } from '@app/shared/models/dto/orders/order-response';
import type { Page } from '@app/shared/models/dto/common/pagination';
import type { MoneyLike } from '@app/shared/models/dto/common/money';
import { OrdersTable } from './orders-table';
import ordersTableHtml from './orders-table.html?raw';

function makeOrder(id: number, unitPrice: MoneyLike = 2500): OrderResponse {
  return {
    id,
    date: '2026-07-15T12:00:00',
    status: 'QUEUE',
    tableId: 1,
    details: [{ id, productId: 1, productName: 'Café', unitPrice, instructions: '' }],
  };
}

function makePage(items: OrderResponse[], total: number, page = 0, size = 10): Page<OrderResponse> {
  return { items, total, page, size, totalPages: Math.ceil(total / size) };
}

describe('OrdersTable (server-side paging)', () => {
  let getPage: ReturnType<typeof vi.fn>;
  let fixture: ComponentFixture<OrdersTable>;

  beforeAll(async () => {
    await resolveComponentResources((url: string) => {
      if (url.endsWith('orders-table.html')) return Promise.resolve(ordersTableHtml as unknown as string);
      // Child widgets (datepicker, skeleton, prime components) are irrelevant here.
      return Promise.resolve('');
    });
  });

  beforeEach(async () => {
    getPage = vi.fn().mockReturnValue(of(makePage([makeOrder(1), makeOrder(2)], 42)));

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [OrdersTable],
      providers: [
        { provide: Order, useValue: { getOrdersByDateRangePage: getPage } },
        { provide: MessageService, useValue: { add: vi.fn() } },
        { provide: WebSocket, useValue: { connect: vi.fn(), subscribeToTopic: vi.fn() } },
        { provide: Auth, useValue: { getToken: () => null } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OrdersTable);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('requests the first page on init and adopts the server total', () => {
    expect(getPage).toHaveBeenCalledTimes(1);
    const [start, end, query] = getPage.mock.calls[0] as [Date, Date, Record<string, unknown>];
    expect(start.toDateString()).toBe(end.toDateString());
    expect(query).toMatchObject({
      page: 0,
      size: 10,
      sort: 'date,desc',
      status: undefined,
      search: undefined,
    });

    expect(fixture.componentInstance.orders.map((o) => o.id)).toEqual([1, 2]);
    expect(fixture.componentInstance.totalRecords).toBe(42);
    expect(fixture.componentInstance.loading).toBe(false);
  });

  it('requests page 2 when the lazy table moves to first=20 with 10 rows', () => {
    fixture.componentInstance.onLazyLoad({ first: 20, rows: 10 });

    expect(getPage).toHaveBeenCalledTimes(2);
    const query = getPage.mock.calls[1][2] as Record<string, unknown>;
    expect(query).toMatchObject({ page: 2, size: 10 });
  });

  it('ignores the duplicate lazy-load emission for the page already loaded', () => {
    fixture.componentInstance.onLazyLoad({ first: 0, rows: 10 });

    expect(getPage).toHaveBeenCalledTimes(1);
  });

  it('sends the search term and resets to the first page', () => {
    fixture.componentInstance.onLazyLoad({ first: 20, rows: 10 });
    expect(getPage).toHaveBeenCalledTimes(2);

    fixture.componentInstance.search = 'mesa 4';
    fixture.componentInstance.onSearchChange();

    expect(getPage).toHaveBeenCalledTimes(3);
    const query = getPage.mock.calls[2][2] as Record<string, unknown>;
    expect(query).toMatchObject({ page: 0, size: 10, search: 'mesa 4' });
  });

  it('sends the selected status and returns to page 0', () => {
    fixture.componentInstance.onLazyLoad({ first: 30, rows: 10 });
    fixture.componentInstance.onStatusChange('READY');

    const query = getPage.mock.calls[2][2] as Record<string, unknown>;
    expect(query).toMatchObject({ page: 0, status: 'READY' });
    expect(fixture.componentInstance.first).toBe(0);
  });

  it('totals MoneyDto line prices without producing NaN', () => {
    const order = makeOrder(7, { amount: '15000.00', currency: 'COP' });
    order.details.push({
      id: 8,
      productId: 2,
      productName: 'Jugo',
      unitPrice: { amount: '2500.00', currency: 'COP' },
      extraCharge: { amount: '0.00', currency: 'COP' },
      instructions: '',
    });

    const total = fixture.componentInstance.getOrderTotal(order);

    expect(Number.isNaN(total)).toBe(false);
    expect(total).toBe(17500);
  });

  it('reports a failed page load and stops the spinner', () => {
    getPage.mockReturnValueOnce(throwError(() => new Error('boom')));

    fixture.componentInstance.onStatusChange('QUEUE');

    expect(fixture.componentInstance.error).toBe('No se pudieron cargar los pedidos.');
    expect(fixture.componentInstance.loading).toBe(false);
  });
});

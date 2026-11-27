/**
 * Tests for the admin orders table (server-side paging).
 *
 * Feature: The orders table is a PrimeNG *lazy* table; every page change is
 * answered by `Order.getOrdersPage()`, so only one page of orders is ever in
 * memory. The list is not scoped to today: newest first, all orders, unless the
 * optional date filter is set (then `Order.getOrdersByDateRangePage()`).
 * Contract:
 *  - the initial load requests `page=0` with the table's `rows` as `size`,
 *    `sort=date,desc` and no date range;
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
  let getRange: ReturnType<typeof vi.fn>;
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
    getRange = vi.fn().mockReturnValue(of(makePage([makeOrder(1), makeOrder(2)], 42)));

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [OrdersTable],
      providers: [
        {
          provide: Order,
          useValue: {
            getOrdersPage: getPage,
            getOrdersByDateRangePage: getRange,
          },
        },
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

  it('requests the first page on init — all orders, newest first — and adopts the server total', () => {
    expect(getPage).toHaveBeenCalledTimes(1);
    expect(getRange).not.toHaveBeenCalled();
    const query = getPage.mock.calls[0][0] as Record<string, unknown>;
    expect(query).toMatchObject({
      page: 0,
      size: 10,
      sort: 'date,desc',
      status: undefined,
      search: undefined,
    });
    expect(query).not.toHaveProperty('startDate');
    expect(query).not.toHaveProperty('endDate');

    expect(fixture.componentInstance.orders.map((o) => o.id)).toEqual([1, 2]);
    expect(fixture.componentInstance.totalRecords).toBe(42);
    expect(fixture.componentInstance.loading).toBe(false);
  });

  it('scopes the request to a single day only when a date is picked', () => {
    fixture.componentInstance.onDateChange(new Date(2026, 6, 15));

    expect(getRange).toHaveBeenCalledTimes(1);
    const [start, end, query] = getRange.mock.calls[0] as [Date, Date, Record<string, unknown>];
    expect(start.toDateString()).toBe(end.toDateString());
    expect(query).toMatchObject({ page: 0, size: 10, sort: 'date,desc' });
  });

  it('reflects the active sort on the header with aria-sort', () => {
    const root = fixture.nativeElement as HTMLElement;
    const headers = Array.from(root.querySelectorAll<HTMLElement>('th[aria-sort]'));
    const dateHeader = headers.find((header) => header.textContent.includes('Fecha'));

    expect(dateHeader?.getAttribute('aria-sort')).toBe('descending');
  });

  it('requests page 2 when the lazy table moves to first=20 with 10 rows', () => {
    fixture.componentInstance.onLazyLoad({ first: 20, rows: 10 });

    expect(getPage).toHaveBeenCalledTimes(2);
    const query = getPage.mock.calls[1][0] as Record<string, unknown>;
    expect(query).toMatchObject({ page: 2, size: 10 });
  });

  it('sends the column sort chosen in the header and reflects it on the table', () => {
    fixture.componentInstance.onLazyLoad({ first: 0, rows: 10, sortField: 'id', sortOrder: 1 });

    const query = getPage.mock.calls[1][0] as Record<string, unknown>;
    expect(query).toMatchObject({ page: 0, size: 10, sort: 'id,asc' });
    expect(fixture.componentInstance.sortField).toBe('id');
    expect(fixture.componentInstance.sortOrder).toBe(1);
  });

  it('sends a descending sort when the header toggles', () => {
    fixture.componentInstance.onLazyLoad({ first: 0, rows: 10, sortField: 'tableId', sortOrder: -1 });

    const query = getPage.mock.calls[1][0] as Record<string, unknown>;
    expect(query).toMatchObject({ page: 0, sort: 'tableId,desc' });
  });

  it('resets to page 0 when the sort changes, even if the table reports a later first', () => {
    fixture.componentInstance.onLazyLoad({ first: 20, rows: 10 });
    fixture.componentInstance.onLazyLoad({ first: 20, rows: 10, sortField: 'date', sortOrder: 1 });

    const query = getPage.mock.calls[2][0] as Record<string, unknown>;
    expect(query).toMatchObject({ page: 0, sort: 'date,asc' });
    expect(fixture.componentInstance.first).toBe(0);
  });

  it('falls back to the date-desc default when the header clears sorting', () => {
    fixture.componentInstance.onLazyLoad({ first: 0, rows: 10, sortField: 'id', sortOrder: 1 });
    fixture.componentInstance.onLazyLoad({ first: 0, rows: 10, sortField: 'id', sortOrder: 0 });

    const query = getPage.mock.calls[2][0] as Record<string, unknown>;
    expect(query).toMatchObject({ page: 0, sort: 'date,desc' });
    expect(fixture.componentInstance.sortField).toBe('date');
    expect(fixture.componentInstance.sortOrder).toBe(-1);
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
    const query = getPage.mock.calls[2][0] as Record<string, unknown>;
    expect(query).toMatchObject({ page: 0, size: 10, search: 'mesa 4' });
  });

  it('sends the selected status and returns to page 0', () => {
    fixture.componentInstance.onLazyLoad({ first: 30, rows: 10 });
    fixture.componentInstance.onStatusChange('READY');

    const query = getPage.mock.calls[2][0] as Record<string, unknown>;
    expect(query).toMatchObject({ page: 0, status: 'READY' });
    expect(fixture.componentInstance.first).toBe(0);
  });

  it('labels today and yesterday, and keeps the full date for older orders', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date(2026, 10, 27, 18, 0, 0));

      expect(fixture.componentInstance.formatDate(new Date(2026, 10, 27, 9, 5))).toBe('Hoy, 09:05 a. m.');
      expect(fixture.componentInstance.formatDate(new Date(2026, 10, 26, 21, 30))).toBe('Ayer, 09:30 p. m.');
      expect(fixture.componentInstance.formatDate(new Date(2026, 10, 25, 12, 0))).toBe('25/11/2026, 12:00 p. m.');
    } finally {
      vi.useRealTimers();
    }
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

  it('never offers PREPARING as a per-order status (the API only prepares the next QUEUE order)', () => {
    const values = fixture.componentInstance.editableStatusOptions.map((option) => option.value);

    expect(values).not.toContain('PREPARING');
    expect(values).toEqual(['READY', 'DELIVERED', 'CANCELLED']);
  });

  it('reports a failed page load and stops the spinner', () => {
    getPage.mockReturnValueOnce(throwError(() => new Error('boom')));

    fixture.componentInstance.onStatusChange('QUEUE');

    expect(fixture.componentInstance.error).toBe('No se pudieron cargar los pedidos.');
    expect(fixture.componentInstance.loading).toBe(false);
  });

  it('shows the RFC 7807 detail from a failed request instead of a generic message', () => {
    getPage.mockReturnValueOnce(
      throwError(() => ({ status: 500, error: { detail: 'Servidor ocupado, inténtalo de nuevo.' } })),
    );

    fixture.componentInstance.retry();

    expect(fixture.componentInstance.error).toBe('Servidor ocupado, inténtalo de nuevo.');
    expect(fixture.componentInstance.loading).toBe(false);
  });
});

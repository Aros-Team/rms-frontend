/**
 * Tests for the cashier order-detail lookup.
 *
 * Feature: the payments API returns only a pending summary, and the orders API
 * has no by-id read, so the cashier walks the day's delivered orders and picks
 * the requested id.
 * Contract:
 *  - the query window is `[date 00:00:00, pending.deliveredAt]` (never the end
 *    of the day, which the API rejects as future when the browser timezone is
 *    ahead of the business timezone);
 *  - it walks pages until the order is found or the result set ends;
 *  - a resolved order is cached and reused;
 *  - a missing order returns `null` instead of throwing.
 *
 * Approach: stub the Order service, assert the query object and the number of
 * page requests, and read the returned order.
 */
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Order } from '@app/core/services/orders/order';
import type { Page } from '@app/shared/models/dto/common/pagination';
import type { OrderResponse } from '@app/shared/models/dto/orders/order-response';
import type { PendingOrderResponse } from '@app/shared/models/dto/payments/pending-order-response';
import { CashierOrderLookup } from './order-lookup';

function makeOrder(id: number): OrderResponse {
  return {
    id,
    date: '2026-11-21T11:01:00',
    status: 'DELIVERED',
    tableId: 2,
    total: { amount: '126000.00', currency: 'COP' },
    details: [{ id, productId: 1, productName: 'Café', unitPrice: 2500, instructions: '' }],
  };
}

function makePage(items: OrderResponse[], total: number, page = 0): Page<OrderResponse> {
  return {
    items,
    total,
    page,
    size: 100,
    totalPages: total === 0 ? 0 : Math.ceil(total / 100),
  };
}

const pending: PendingOrderResponse = {
  orderId: 900029,
  tableId: 2,
  tableNumber: 2,
  partySize: 2,
  deliveredAt: '2026-11-21T11:01:00',
  total: { amount: '126000.00', currency: 'COP' },
  paymentStatus: 'UNPAID',
};

describe('CashierOrderLookup', () => {
  let lookup: CashierOrderLookup;
  let getOrdersPage: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    getOrdersPage = vi.fn();

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [CashierOrderLookup, { provide: Order, useValue: { getOrdersPage } }],
    });
    lookup = TestBed.inject(CashierOrderLookup);
  });

  it('queries the safe window and returns the matching order', () => {
    getOrdersPage.mockReturnValue(of(makePage([makeOrder(900029)], 1)));

    let result: OrderResponse | null = null;
    lookup.find(pending).subscribe((order) => {
      result = order;
    });

    expect(getOrdersPage).toHaveBeenCalledWith({
      status: 'DELIVERED',
      startDate: '2026-11-21T00:00:00',
      endDate: '2026-11-21T11:01:00',
      size: 100,
      sort: 'date,asc',
      page: 0,
    });
    expect(result?.id).toBe(900029);
  });

  it('walks to the next page when the order is not on the first one', () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => makeOrder(index + 1));
    getOrdersPage
      .mockReturnValueOnce(of(makePage(firstPage, 150, 0)))
      .mockReturnValueOnce(of(makePage([makeOrder(900029)], 150, 1)));

    let result: OrderResponse | null = null;
    lookup.find(pending).subscribe((order) => {
      result = order;
    });

    expect(getOrdersPage).toHaveBeenCalledTimes(2);
    expect(getOrdersPage.mock.calls[1][0]).toMatchObject({ page: 1 });
    expect(result?.id).toBe(900029);
  });

  it('stops when the result set ends and returns null', () => {
    getOrdersPage.mockReturnValue(of(makePage([makeOrder(1)], 1)));

    let result: OrderResponse | null = makeOrder(1);
    lookup.find(pending).subscribe((order) => {
      result = order;
    });

    expect(getOrdersPage).toHaveBeenCalledTimes(1);
    expect(result).toBeNull();
  });

  it('caches a resolved order and does not query twice', () => {
    getOrdersPage.mockReturnValue(of(makePage([makeOrder(900029)], 1)));

    lookup.find(pending).subscribe();
    lookup.find(pending).subscribe();

    expect(getOrdersPage).toHaveBeenCalledTimes(1);
  });

  it('drops the cache when asked to forget an order', () => {
    getOrdersPage.mockReturnValue(of(makePage([makeOrder(900029)], 1)));

    lookup.find(pending).subscribe();
    lookup.forget(900029);
    lookup.find(pending).subscribe();

    expect(getOrdersPage).toHaveBeenCalledTimes(2);
  });
});

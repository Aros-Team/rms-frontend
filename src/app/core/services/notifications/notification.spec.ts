/**
 * Tests for the Notification READY-order poll.
 *
 * Feature: Every 15s the service page-walks the READY orders and queues a sound
 * for the ids it has not seen yet (`unseenReadyOrders`).
 * Contract:
 *  - a READY set spread over several pages is fully considered: an order that
 *    lives on page 2 still produces a pending notification;
 *  - the walk is bounded by `MAX_ORDER_PAGES` even when the backend ignores the
 *    `page` parameter and always echoes `page: 0` (no infinite loop);
 *  - a capped walk is logged (never silently presented as the whole set);
 *  - an empty page ends the walk without notifying anything;
 *  - a failed request is logged and does not kill the polling subscription.
 *
 * Approach: use the REAL `Order` service with `HttpTestingController` (only the
 * HTTP boundary is faked) and fake timers to advance the 15s interval, flushing
 * each page of the walk explicitly and asserting the resulting ids.
 */
import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MAX_ORDER_PAGES, Order } from '@app/core/services/orders/order';
import { Logging } from '@app/core/services/logging/logging';
import type { OrderResponse } from '@app/shared/models/dto/orders/order-response';
import { Notification } from './notification';

const POLL_MS = 15000;

function makeOrder(id: number): OrderResponse {
  return {
    id,
    date: '2026-07-15T12:00:00',
    status: 'READY',
    tableId: 3,
    details: [
      { id: id * 10, productId: 1, productName: 'Café', unitPrice: 2500, instructions: '' },
    ],
  };
}

function pageOf(from: number, count: number): OrderResponse[] {
  return Array.from({ length: count }, (_, index) => makeOrder(from + index));
}

describe('Notification READY poll', () => {
  let httpMock: HttpTestingController;
  let notification: Notification;
  let logMock: {
    debug: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    logMock = { debug: vi.fn(), warn: vi.fn(), error: vi.fn() };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        Order,
        Notification,
        { provide: Logging, useValue: logMock },
      ],
    });

    httpMock = TestBed.inject(HttpTestingController);
    notification = TestBed.inject(Notification);
  });

  afterEach(() => {
    notification.stopPolling();
    httpMock.verify();
    vi.useRealTimers();
  });

  function poll(): void {
    vi.advanceTimersByTime(POLL_MS);
  }

  /** Flushes the page `page` of the READY walk (the response always echoes page 0). */
  function flushReadyPage(page: number, items: OrderResponse[], total: number): void {
    httpMock
      .expectOne(
        (r) =>
          r.url === 'v1/orders' &&
          r.params.get('status') === 'READY' &&
          r.params.get('page') === String(page),
      )
      .flush({ items, total, page: 0, size: 50, total_pages: Math.ceil(total / 50) });
  }

  it('notifies about READY orders that live beyond the first page', () => {
    notification.startPolling();
    poll();

    flushReadyPage(0, pageOf(1, 50), 51);
    flushReadyPage(1, pageOf(51, 1), 51);

    const ids = notification.unseenReadyOrders().map((order) => order.id);
    expect(ids).toHaveLength(51);
    expect(ids[0]).toBe(1);
    expect(ids.at(-1)).toBe(51);
  });

  it('bounds the walk when the backend ignores `page` and always echoes page 0', () => {
    notification.startPolling();
    poll();

    // Bogus backend: every response reports page 0 with a huge total. Only the
    // local walk index stops the loop (with the old first-page call the tail of
    // the set would never even be requested).
    for (let pageIndex = 0; pageIndex < MAX_ORDER_PAGES; pageIndex++) {
      flushReadyPage(pageIndex, pageOf(pageIndex * 50 + 1, 50), 5000);
    }

    httpMock.expectNone((r) => r.url === 'v1/orders');
    expect(notification.unseenReadyOrders()).toHaveLength(MAX_ORDER_PAGES * 50);
    expect(logMock.warn).toHaveBeenCalledWith(
      `Notification: READY walk capped, notificando ${String(MAX_ORDER_PAGES * 50)} de 5000 pedidos`,
    );
  });

  it('ends the walk on an empty page without notifying anything', () => {
    notification.startPolling();
    poll();

    flushReadyPage(0, [], 0);

    httpMock.expectNone((r) => r.url === 'v1/orders');
    expect(notification.unseenReadyOrders()).toEqual([]);
    expect(logMock.warn).not.toHaveBeenCalled();
  });

  it('keeps polling after a failed request', () => {
    notification.startPolling();

    poll();
    httpMock
      .expectOne((r) => r.url === 'v1/orders' && r.params.get('page') === '0')
      .flush('boom', { status: 500, statusText: 'Server Error' });

    expect(logMock.error).toHaveBeenCalledWith('Error polling READY orders', expect.anything());

    poll();
    flushReadyPage(0, pageOf(7, 1), 1);

    expect(notification.unseenReadyOrders().map((order) => order.id)).toEqual([7]);
  });
});

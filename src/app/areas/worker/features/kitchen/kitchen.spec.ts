/**
 * Tests for the kitchen board (QUEUE / PREPARING / READY columns).
 *
 * Feature: Each column is loaded through `Order.getAllOrdersByStatus()`, a
 * bounded page walk, so a column longer than one page is rendered completely.
 * Contract:
 *  - every page of a column is aggregated: 2 pages flushed ⇒ all rows rendered
 *    and the column counter equals the real number of orders;
 *  - the walk requests consecutive pages of the same status (size 50, default
 *    sort) instead of a single first-page request;
 *  - a WebSocket event patches the list locally and does NOT re-walk the columns;
 *  - a capped walk is declared in the UI (`vista limitada: mostrando N de M`),
 *    never silently truncated;
 *  - a failed load shows the error banner and stops the spinner.
 *
 * Approach: two blocks. The first mounts the component with the REAL `Order`
 * service and `HttpTestingController`, flushing both pages of a status and
 * asserting the rendered order ids + counters. The second stubs only the `Order`
 * boundary (a controlled `OrderCollection`) to assert the truncation notice and
 * the error path without issuing 40 real requests. WebSocket and Auth are
 * stubbed in both blocks because they are external boundaries.
 */
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ɵresolveComponentResources as resolveComponentResources } from '@angular/core';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { BehaviorSubject, Subject, of, throwError } from 'rxjs';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { Order, type OrderCollection } from '@app/core/services/orders/order';
import { WebSocket } from '@app/core/services/websocket/websocket';
import { Auth } from '@app/core/services/auth/auth';
import { Logging } from '@app/core/services/logging/logging';
import type { OrderResponse } from '@app/shared/models/dto/orders/order-response';
import { Kitchen } from './kitchen';
import kitchenHtml from './kitchen.html?raw';

function makeOrder(id: number, status: string): OrderResponse {
  return {
    id,
    date: '2026-07-15T12:00:00',
    status,
    tableId: 3,
    details: [{ id, productId: 1, productName: 'Café', unitPrice: 2500, instructions: '' }],
  };
}

function ids(from: number, count: number, status: string): OrderResponse[] {
  return Array.from({ length: count }, (_, index) => makeOrder(from + index, status));
}

function text(element: Element | null): string {
  return element?.textContent.replace(/\s+/g, ' ').trim() ?? '';
}

function host(fixture: ComponentFixture<Kitchen>): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}

describe('Kitchen', () => {
  let wsEvents: Record<string, Subject<OrderResponse>>;
  let wsStub: {
    connect: ReturnType<typeof vi.fn>;
    connection$: BehaviorSubject<boolean>;
    subscribeToTopic: (topic: string) => unknown;
  };

  beforeAll(async () => {
    await resolveComponentResources((url: string) => {
      if (url.endsWith('kitchen.html')) {
        return Promise.resolve(kitchenHtml as unknown as string);
      }
      return Promise.resolve('');
    });
  });

  beforeEach(() => {
    wsEvents = {};
    wsStub = {
      connect: vi.fn(),
      connection$: new BehaviorSubject(true),
      subscribeToTopic: (topic: string) => {
        wsEvents[topic] ??= new Subject<OrderResponse>();
        return wsEvents[topic].asObservable();
      },
    };
    TestBed.resetTestingModule();
  });

  function configure(providers: unknown[]): Promise<ComponentFixture<Kitchen>> {
    TestBed.configureTestingModule({
      imports: [Kitchen],
      providers: [
        provideRouter([]),
        { provide: WebSocket, useValue: wsStub },
        { provide: Auth, useValue: { getToken: () => 'jwt-token' } },
        { provide: Logging, useValue: { debug: vi.fn(), warn: vi.fn(), error: vi.fn() } },
        ...(providers as never[]),
      ],
    });
    return TestBed.compileComponents().then(() => TestBed.createComponent(Kitchen));
  }

  function columnIds(fixture: ComponentFixture<Kitchen>, column: string): string[] {
    return Array.from(
      host(fixture).querySelectorAll(`[data-testid="${column}-column"] [data-testid="order-id"]`),
    ).map((el) => text(el));
  }

  describe('page walking (real Order service)', () => {
    let fixture: ComponentFixture<Kitchen>;
    let httpMock: HttpTestingController;

    beforeEach(async () => {
      fixture = await configure([provideHttpClient(), provideHttpClientTesting(), Order]);
      httpMock = TestBed.inject(HttpTestingController);
      fixture.detectChanges();
    });

    afterEach(() => {
      fixture.destroy();
      httpMock.verify();
    });

    function flushPage(status: string, page: number, items: OrderResponse[], total: number, totalPages: number): void {
      httpMock
        .expectOne(
          (r) =>
            r.url === 'v1/orders' &&
            r.params.get('status') === status &&
            r.params.get('page') === String(page),
        )
        .flush({ items, total, page, size: 50, total_pages: totalPages });
    }

    function loadBoard(): void {
      // QUEUE: 52 orders over two pages.
      flushPage('QUEUE', 0, ids(1, 50, 'QUEUE'), 52, 2);
      flushPage('QUEUE', 1, ids(51, 2, 'QUEUE'), 52, 2);
      // PREPARING: a single short page (walk stops on the short page).
      flushPage('PREPARING', 0, ids(100, 1, 'PREPARING'), 1, 1);
      // READY: 51 orders over two pages.
      flushPage('READY', 0, ids(200, 50, 'READY'), 51, 2);
      flushPage('READY', 1, ids(250, 1, 'READY'), 51, 2);
      fixture.detectChanges();
    }

    it('aggregates every page of a column so no order of the column is lost', () => {
      loadBoard();

      const queueIds = columnIds(fixture, 'queue');
      expect(queueIds).toHaveLength(52);
      expect(queueIds[0]).toBe('#1');
      expect(queueIds.at(-1)).toBe('#52');
      expect(text(host(fixture).querySelector('[data-testid="queue-count"]'))).toBe('52');

      expect(fixture.componentInstance.readyOrders().map((o) => o.id)).toHaveLength(51);
      expect(fixture.componentInstance.readyOrders().at(-1)?.id).toBe(250);
    });

    it('renders the counters from the aggregated rows, not from the first page', () => {
      loadBoard();

      expect(text(host(fixture).querySelector('[data-testid="preparing-count"]'))).toBe('1');
      expect(text(host(fixture).querySelector('[data-testid="queue-count"]'))).toBe('52');
      expect(columnIds(fixture, 'preparing')).toEqual(['#100']);
    });

    it('walks consecutive pages of the same status with size 50 and the default sort', () => {
      loadBoard();

      // Re-request page 1 of READY explicitly to inspect the query parameters.
      fixture.componentInstance.fetchAll(true);
      httpMock
        .expectOne(
          (r) =>
            r.url === 'v1/orders' &&
            r.params.get('status') === 'READY' &&
            r.params.get('page') === '0',
        )
        .flush({ items: ids(200, 50, 'READY'), total: 51, page: 0, size: 50, total_pages: 2 });

      const second = httpMock.expectOne(
        (r) =>
          r.url === 'v1/orders' &&
          r.params.get('status') === 'READY' &&
          r.params.get('page') === '1',
      );
      expect(second.request.params.get('size')).toBe('50');
      expect(second.request.params.get('sort')).toBe('date,desc');

      // Drain the remaining columns of that refresh so `httpMock.verify()` stays clean.
      second.flush({ items: ids(250, 1, 'READY'), total: 51, page: 1, size: 50, total_pages: 2 });
      flushPage('QUEUE', 0, ids(1, 2, 'QUEUE'), 2, 1);
      flushPage('PREPARING', 0, ids(100, 1, 'PREPARING'), 1, 1);
    });

    it('patches a WebSocket creation locally instead of re-walking the columns', () => {
      loadBoard();
      httpMock.expectNone((r) => r.url === 'v1/orders');

      wsEvents['/topic/orders/created'].next(makeOrder(999, 'QUEUE'));
      fixture.detectChanges();

      expect(columnIds(fixture, 'queue')).toHaveLength(53);
      expect(text(host(fixture).querySelector('[data-testid="queue-count"]'))).toBe('53');
      httpMock.expectNone((r) => r.url === 'v1/orders');
    });
  });

  describe('truncation and failure (stubbed Order boundary)', () => {
    let fixture: ComponentFixture<Kitchen>;
    let getAllByStatus: ReturnType<typeof vi.fn>;

    function collection(items: OrderResponse[], total: number, truncated = false): OrderCollection {
      return { items, total, truncated };
    }

    beforeEach(async () => {
      getAllByStatus = vi
        .fn()
        .mockImplementation((status: string) =>
          of(
            status === 'QUEUE'
              ? collection(ids(1, 2, 'QUEUE'), 5000, true)
              : status === 'READY'
                ? collection(ids(200, 2, 'READY'), 4321, true)
                : collection(ids(100, 1, 'PREPARING'), 1),
          ),
        );

      fixture = await configure([{ provide: Order, useValue: { getAllOrdersByStatus: getAllByStatus } }]);
      fixture.detectChanges();
    });

    afterEach(() => {
      fixture.destroy();
    });

    it('declares a capped column instead of showing it as complete', () => {
      const queueLimit = text(host(fixture).querySelector('[data-testid="queue-limit"]'));
      expect(queueLimit).toBe('· vista limitada: mostrando 2 de 5000 pedidos');
      expect(fixture.componentInstance.limitFor('preparing')).toBeNull();
    });

    it('declares a capped READY set on the board header', () => {
      expect(text(host(fixture).querySelector('[data-testid="ready-limit"]'))).toBe(
        'Listos · vista limitada: mostrando 2 de 4321 pedidos',
      );
      expect(fixture.componentInstance.readyOrders()).toHaveLength(2);
    });

    it('shows the error message and stops the spinner when a column fails', () => {
      getAllByStatus.mockImplementation((status: string) =>
        status === 'QUEUE'
          ? throwError(() => new Error('boom'))
          : of(collection([], 0)),
      );

      fixture.componentInstance.fetchAll(true);
      fixture.detectChanges();

      expect(fixture.componentInstance.error()).toBe('Error cargando cola.');
      expect(fixture.componentInstance.loading()).toBe(false);
      expect(fixture.componentInstance.refreshing()).toBe(false);
    });

    it('keeps the existing refresh semantics for the WebSocket fallback topics', () => {
      // No WebSocket-driven refetch: a delivered event only removes the row.
      wsEvents['/topic/orders/delivered'] ??= new Subject<OrderResponse>();
      fixture.componentInstance.readyOrders.set(ids(200, 1, 'READY'));

      wsEvents['/topic/orders/delivered'].next(makeOrder(200, 'READY'));

      expect(fixture.componentInstance.readyOrders()).toEqual([]);
      expect(getAllByStatus).toHaveBeenCalledTimes(3);
    });
  });
});

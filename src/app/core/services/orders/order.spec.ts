/**
 * Tests for the Order HTTP service.
 *
 * Feature: Fetches and manages orders via HTTP with logging integration.
 * Contract: Makes correct GET requests, handles errors, integrates with Logging service.
 * Approach: Use HttpTestingController to intercept requests, assert method and URL.
 */
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';

import { Logging } from '@app/core/services/logging/logging';
import { MAX_ORDER_PAGES, Order } from '@app/core/services/orders/order';
import type { CreateOrderRequest } from '@app/shared/models/dto/orders/create-order-request';
import type { OrderResponse } from '@app/shared/models/dto/orders/order-response';

describe('Order', () => {
  let service: Order;
  let httpMock: HttpTestingController;
  let logMock: { debug: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    logMock = { debug: vi.fn() };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        Order,
        { provide: Logging, useValue: logMock },
      ],
    });

    service = TestBed.inject(Order);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('preserves selectedProductIds in create-order request details', () => {
    const request: CreateOrderRequest = {
      tableId: 8,
      details: [
        {
          productId: 50,
          instructions: 'Sin salsa',
          selectedOptionIds: [700],
          selectedProductIds: [201, 202],
          additionIds: [900],
          clarifications: [{ questionId: 10, answer: 'Término medio' }],
        },
      ],
    };
    const response: OrderResponse = {
      id: 99,
      date: '2026-07-15T12:00:00',
      status: 'QUEUE',
      tableId: 8,
      details: [],
    };
    const next = vi.fn();

    service.createOrder(request).subscribe(next);

    const req = httpMock.expectOne('v1/orders');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(request);
    const body = req.request.body as CreateOrderRequest;
    expect(body.details[0].selectedProductIds).toEqual([201, 202]);
    req.flush(response);

    expect(next).toHaveBeenCalledWith(response);
  });

  describe('server-side pagination', () => {
    const order = (id: number): OrderResponse => ({
      id,
      date: '2026-07-15T12:00:00',
      status: 'QUEUE',
      tableId: 1,
      details: [],
    });

    it('requests an explicit page/size and unwraps { items, total, page, size, total_pages }', () => {
      const next = vi.fn();
      service.getOrdersPage({ page: 2, size: 20 }).subscribe(next);

      const req = httpMock.expectOne((r) => r.url === 'v1/orders' && r.params.get('page') === '2');
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('size')).toBe('20');
      expect(req.request.params.get('sort')).toBe('date,desc');

      req.flush({ items: [order(1), order(2)], total: 42, page: 2, size: 20, total_pages: 3 });

      expect(next).toHaveBeenCalledWith({
        items: [order(1), order(2)],
        total: 42,
        page: 2,
        size: 20,
        totalPages: 3,
      });
    });

    it('tolerates a bare array response', () => {
      const next = vi.fn();
      service.getOrdersPage().subscribe(next);

      httpMock.expectOne((r) => r.url === 'v1/orders').flush([order(7)]);

      expect(next).toHaveBeenCalledWith({
        items: [order(7)],
        total: 1,
        page: 0,
        size: 1,
        totalPages: 1,
      });
    });

    it("stops using the size:500 firehose for today's orders", () => {
      const next = vi.fn();
      service.getTodayOrdersPage({ page: 0, size: 50 }).subscribe(next);

      const req = httpMock.expectOne((r) => r.url === 'v1/orders');
      expect(req.request.params.get('size')).toBe('50');
      expect(req.request.params.get('size')).not.toBe('500');
      expect(req.request.params.get('startDate')).toMatch(/^\d{4}-\d{2}-\d{2}T00:00:00$/);
      expect(req.request.params.get('endDate')).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);

      req.flush({ items: [order(1)], total: 1, page: 0, size: 50, total_pages: 1 });
      expect(next).toHaveBeenCalled();
    });

    it('walks every page for aggregates via getAllTodayOrders()', () => {
      const next = vi.fn();
      const firstPage = Array.from({ length: 50 }, (_, i) => order(i + 1));

      service.getAllTodayOrders().subscribe(next);

      httpMock
        .expectOne((r) => r.url === 'v1/orders' && r.params.get('page') === '0')
        .flush({ items: firstPage, total: 51, page: 0, size: 50, total_pages: 2 });

      httpMock
        .expectOne((r) => r.url === 'v1/orders' && r.params.get('page') === '1')
        .flush({ items: [order(51)], total: 51, page: 1, size: 50, total_pages: 2 });

      expect(next).toHaveBeenCalledTimes(1);
      expect(next.mock.calls[0][0]).toHaveLength(51);
    });

    it('stops walking when the backend ignores `page` and always echoes page 0', () => {
      const next = vi.fn();
      service.getAllTodayOrders().subscribe(next);

      // Bogus backend: always reports page 0 with a huge total. Only the local
      // walk index bounds the loop.
      for (let pageIndex = 0; pageIndex < MAX_ORDER_PAGES; pageIndex++) {
        const items = Array.from({ length: 50 }, (_, i) => order(pageIndex * 50 + i + 1));
        httpMock
          .expectOne((r) => r.url === 'v1/orders' && r.params.get('page') === String(pageIndex))
          .flush({ items, total: 2000, page: 0, size: 50, total_pages: 40 });
      }

      httpMock.expectNone((r) => r.url === 'v1/orders');
      expect(next).toHaveBeenCalledTimes(1);
      expect(next.mock.calls[0][0]).toHaveLength(MAX_ORDER_PAGES * 50);
    });

    it('stops walking when the server returns an empty page', () => {
      const next = vi.fn();
      service.getAllTodayOrders().subscribe(next);

      httpMock
        .expectOne((r) => r.url === 'v1/orders' && r.params.get('page') === '0')
        .flush({
          items: Array.from({ length: 50 }, (_, i) => order(i + 1)),
          total: 500,
          page: 0,
          size: 50,
          total_pages: 10,
        });

      httpMock
        .expectOne((r) => r.url === 'v1/orders' && r.params.get('page') === '1')
        .flush({ items: [], total: 500, page: 1, size: 50, total_pages: 10 });

      httpMock.expectNone((r) => r.url === 'v1/orders');
      expect(next.mock.calls[0][0]).toHaveLength(50);
    });

    it('stops walking once the reported total is reached', () => {
      const next = vi.fn();
      service
        .getAllOrdersByDateRange(new Date(2026, 6, 15), new Date(2026, 6, 15), {
          size: 2,
        })
        .subscribe(next);

      httpMock
        .expectOne((r) => r.url === 'v1/orders' && r.params.get('page') === '0')
        .flush({ items: [order(1), order(2)], total: 4, page: 0, size: 2, total_pages: 2 });

      httpMock
        .expectOne((r) => r.url === 'v1/orders' && r.params.get('page') === '1')
        .flush({ items: [order(3), order(4)], total: 4, page: 1, size: 2, total_pages: 2 });

      httpMock.expectNone((r) => r.url === 'v1/orders');
      expect(next).toHaveBeenCalledWith({
        items: [order(1), order(2), order(3), order(4)],
        total: 4,
        truncated: false,
      });
    });

    it('flags truncation instead of silently dropping rows when the cap is hit', () => {
      const next = vi.fn();
      service.getAllOrdersByDateRange(new Date(2026, 6, 15), new Date(2026, 6, 15)).subscribe(next);

      for (let pageIndex = 0; pageIndex < MAX_ORDER_PAGES; pageIndex++) {
        const items = Array.from({ length: 50 }, (_, i) => order(pageIndex * 50 + i + 1));
        httpMock
          .expectOne((r) => r.url === 'v1/orders' && r.params.get('page') === String(pageIndex))
          .flush({ items, total: 5000, page: pageIndex, size: 50, total_pages: 100 });
      }

      httpMock.expectNone((r) => r.url === 'v1/orders');

      const result = next.mock.calls[0][0] as {
        items: OrderResponse[];
        total: number;
        truncated: boolean;
      };
      expect(result.items).toHaveLength(MAX_ORDER_PAGES * 50);
      expect(result.total).toBe(5000);
      expect(result.truncated).toBe(true);
    });

    it('sends the day boundaries when walking a date range', () => {
      const next = vi.fn();
      service.getAllOrdersByDateRange(new Date(2026, 6, 15), new Date(2026, 6, 15)).subscribe(next);

      const req = httpMock.expectOne((r) => r.url === 'v1/orders');
      expect(req.request.params.get('startDate')).toBe('2026-07-15T00:00:00');
      expect(req.request.params.get('endDate')).toMatch(/^2026-07-15T\d{2}:\d{2}:\d{2}$/);
      expect(req.request.params.get('size')).toBe('50');

      req.flush({ items: [order(1)], total: 1, page: 0, size: 50, total_pages: 1 });
      expect(next).toHaveBeenCalledWith({ items: [order(1)], total: 1, truncated: false });
    });

    it('walks every page of a single status for column screens', () => {
      const next = vi.fn();
      service.getAllOrdersByStatus('QUEUE').subscribe(next);

      const first = httpMock.expectOne(
        (r) => r.url === 'v1/orders' && r.params.get('page') === '0',
      );
      expect(first.request.params.get('status')).toBe('QUEUE');
      expect(first.request.params.get('size')).toBe('50');
      first.flush({
        items: Array.from({ length: 50 }, (_, i) => order(i + 1)),
        total: 51,
        page: 0,
        size: 50,
        total_pages: 2,
      });

      const second = httpMock.expectOne(
        (r) => r.url === 'v1/orders' && r.params.get('page') === '1',
      );
      expect(second.request.params.get('status')).toBe('QUEUE');
      second.flush({ items: [order(51)], total: 51, page: 1, size: 50, total_pages: 2 });

      httpMock.expectNone((r) => r.url === 'v1/orders');
      const result = next.mock.calls[0][0] as {
        items: OrderResponse[];
        total: number;
        truncated: boolean;
      };
      expect(result.items).toHaveLength(51);
      expect(result.items.at(-1)?.id).toBe(51);
      expect(result.total).toBe(51);
      expect(result.truncated).toBe(false);
    });

    it('keeps the list contract for legacy callers (first page only)', () => {
      const next = vi.fn();
      service.getOrdersByStatus('QUEUE').subscribe(next);

      const req = httpMock.expectOne((r) => r.url === 'v1/orders');
      expect(req.request.params.get('status')).toBe('QUEUE');
      expect(req.request.params.get('page')).toBe('0');
      expect(req.request.params.get('size')).toBe('50');

      req.flush({ items: [order(9)], total: 1, page: 0, size: 50, total_pages: 1 });
      expect(next).toHaveBeenCalledWith([order(9)]);
    });

    it('reports the today total without downloading the rows', () => {
      const next = vi.fn();
      service.countTodayOrders().subscribe(next);

      const req = httpMock.expectOne((r) => r.url === 'v1/orders');
      expect(req.request.params.get('size')).toBe('1');
      req.flush({ items: [], total: 137, page: 0, size: 1, total_pages: 137 });

      expect(next).toHaveBeenCalledWith(137);
    });

    it('forwards the station areaId with the status filter', () => {
      service.getAllOrdersByStatus('QUEUE', { areaId: 3, sort: 'date,asc' }).subscribe();

      const req = httpMock.expectOne((r) => r.url === 'v1/orders');
      expect(req.request.params.get('status')).toBe('QUEUE');
      expect(req.request.params.get('areaId')).toBe('3');
      expect(req.request.params.get('sort')).toBe('date,asc');

      req.flush({ items: [], total: 0, page: 0, size: 50, total_pages: 0 });
    });
  });

  describe('transitions', () => {
    it('prepares one specific order', () => {
      service.prepareOrder(42).subscribe();

      const req = httpMock.expectOne('v1/orders/42/prepare');
      expect(req.request.method).toBe('PUT');
      req.flush({ id: 42 });
    });

    it('marks one order line ready', () => {
      service.markDetailReady(42, 900).subscribe();

      const req = httpMock.expectOne('v1/orders/42/details/900/ready');
      expect(req.request.method).toBe('PUT');
      req.flush({ id: 42 });
    });
  });
});

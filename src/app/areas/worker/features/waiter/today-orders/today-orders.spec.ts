/**
 * Tests for the waiter "today's orders" screen.
 *
 * Feature: renders the orders of the current day the waiter can still act on.
 * Contract:
 *  - only `PREPARING` and `READY` orders reach the board; queued, delivered and
 *    cancelled orders are kitchen/cashier bookkeeping and stay hidden;
 *  - the service call page-walks the whole day (`getAllOrdersByDateRange`), so
 *    rows beyond the first page are present;
 *  - the day boundaries (00:00:00 → current day end) are passed to the service;
 *  - a failed load shows the error banner and stops the spinner;
 *  - the bill preview is gone: waiters only deliver.
 *
 * Approach: mount the component, provide a stub `Order` service returning a
 * controlled `OrderCollection`, then assert the rendered rows and the exact
 * arguments handed to the service.
 */
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ɵresolveComponentResources as resolveComponentResources } from '@angular/core';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { of, throwError } from 'rxjs';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { Order, type OrderCollection } from '@app/core/services/orders/order';
import { OrderDock } from '@app/core/services/order-dock/order-dock';
import { Logging } from '@app/core/services/logging/logging';
import type { OrderResponse } from '@app/shared/models/dto/orders/order-response';
import { TodayOrders } from './today-orders';
import todayOrdersHtml from './today-orders.html?raw';

function makeOrder(id: number, status: string): OrderResponse {
  return {
    id,
    date: '2026-07-15T12:00:00',
    status,
    tableId: 3,
    details: [{ id, productId: 1, productName: 'Café', unitPrice: 2500, instructions: '' }],
  };
}

function collection(items: OrderResponse[], total: number, truncated = false): OrderCollection {
  return { items, total, truncated };
}

describe('TodayOrders', () => {
  let getAll: ReturnType<typeof vi.fn>;
  let deliver: ReturnType<typeof vi.fn>;
  let fixture: ComponentFixture<TodayOrders>;

  beforeAll(async () => {
    await resolveComponentResources((url: string) => {
      if (url.endsWith('today-orders.html')) {
        return Promise.resolve(todayOrdersHtml as unknown as string);
      }
      return Promise.resolve('');
    });
  });

  beforeEach(async () => {
    getAll = vi
      .fn()
      .mockReturnValue(
        of(
          collection(
            [
              makeOrder(1, 'QUEUE'),
              makeOrder(2, 'DELIVERED'),
              makeOrder(3, 'READY'),
              makeOrder(4, 'CANCELLED'),
              makeOrder(5, 'PREPARING'),
            ],
            5,
          ),
        ),
      );
    deliver = vi.fn().mockImplementation((id: number) => of(makeOrder(id, 'DELIVERED')));

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [TodayOrders],
      providers: [
        {
          provide: Order,
          useValue: { getAllOrdersByDateRange: getAll, deliverOrder: deliver },
        },
        { provide: OrderDock, useValue: { loadAvailableTables: vi.fn() } },
        { provide: Logging, useValue: { debug: vi.fn(), error: vi.fn() } },
        { provide: MessageService, useValue: { add: vi.fn() } },
        { provide: Router, useValue: { navigate: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TodayOrders);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('only lists orders that are preparing or ready', () => {
    expect(fixture.componentInstance.orders().map((order) => order.id)).toEqual([3, 5]);

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelectorAll('.order-card').length).toBe(2);
    expect(host.textContent).not.toContain('Cancelada');
    expect(host.textContent).not.toContain('Entregada');
    expect(host.textContent).not.toContain('Ver cuenta');
  });

  it('page-walks the whole day instead of taking a single page', () => {
    expect(getAll).toHaveBeenCalledTimes(1);
    const [start, end] = getAll.mock.calls[0] as [Date, Date];
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(start.toDateString()).toBe(new Date().toDateString());
    expect(end.getTime()).toBeGreaterThan(start.getTime());
  });

  it('drops an order from the board once it is delivered', () => {
    expect(fixture.componentInstance.orders().map((order) => order.id)).toEqual([3, 5]);

    fixture.componentInstance.deliverOrder(fixture.componentInstance.orders()[0]);
    fixture.detectChanges();

    expect(fixture.componentInstance.orders().map((order) => order.id)).toEqual([5]);
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('.order-card').length).toBe(1);
  });

  it('shows the error message and stops the spinner when the load fails', () => {
    getAll.mockReturnValueOnce(throwError(() => new Error('boom')));

    fixture.componentInstance.fetchOrders();
    fixture.detectChanges();

    expect(fixture.componentInstance.error()).toBe(
      'No se pudieron cargar los pedidos. Revisa la conexión.',
    );
    expect(fixture.componentInstance.loading()).toBe(false);
  });
});

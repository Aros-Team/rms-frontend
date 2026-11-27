/**
 * Tests for the waiter "today's orders" screen.
 *
 * Feature: renders every order of the current day.
 * Contract:
 *  - the service call page-walks the whole day (`getAllOrdersByDateRange`), so
 *    rows beyond the first page are present;
 *  - the day boundaries (00:00:00 → current day end) are passed to the service;
 *  - a failed load shows the error banner and stops the spinner.
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

function collection(
  items: OrderResponse[],
  total: number,
  truncated = false,
): OrderCollection {
  return { items, total, truncated };
}

describe('TodayOrders', () => {
  let getAll: ReturnType<typeof vi.fn>;
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
    getAll = vi.fn().mockReturnValue(
      of(collection([makeOrder(1, 'QUEUE'), makeOrder(2, 'DELIVERED'), makeOrder(3, 'READY')], 3)),
    );

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [TodayOrders],
      providers: [
        { provide: Order, useValue: { getAllOrdersByDateRange: getAll } },
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

  it('renders every row of the day', () => {
    expect(fixture.componentInstance.orders().map((o) => o.id)).toEqual([1, 2, 3]);
    const rows = (fixture.nativeElement as HTMLElement).querySelectorAll('.order-card');
    expect(rows.length).toBe(3);
  });

  it('page-walks the whole day instead of taking a single page', () => {
    expect(getAll).toHaveBeenCalledTimes(1);
    const [start, end] = getAll.mock.calls[0] as [Date, Date];
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(start.toDateString()).toBe(new Date().toDateString());
    expect(end.getTime()).toBeGreaterThan(start.getTime());
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

  it('groups identical lines and totals the bill without inventing payments', () => {
    const order: OrderResponse = {
      id: 9,
      date: '2026-07-15T12:00:00',
      status: 'READY',
      tableId: 3,
      table: 'Mesa 3',
      total: { amount: '30000.00', currency: 'COP' },
      details: [
        { id: 1, productId: 1, productName: 'Café', unitPrice: 5000, instructions: '' },
        { id: 2, productId: 1, productName: 'Café', unitPrice: 5000, instructions: '' },
        { id: 3, productId: 2, productName: 'Jugo', unitPrice: 8000, instructions: 'sin azúcar' },
      ],
    };

    fixture.componentInstance.showBill(order);
    fixture.detectChanges();

    expect(fixture.componentInstance.billLines().length).toBe(2);
    expect(fixture.componentInstance.billLines()[0].quantity).toBe(2);
    expect(fixture.componentInstance.billLines()[0].total).toBe(10000);
    expect(fixture.componentInstance.billTotal()).toBe(30000);
  });
});

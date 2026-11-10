/**
 * Tests for the waiter "today's orders" screen.
 *
 * Feature: Renders every order of the selected day (status filter optional) and
 * derives the "activas / entregadas" counters from that list.
 * Contract:
 *  - the service call page-walks the whole day (`getAllOrdersByDateRange`), so
 *    rows beyond the first page are present;
 *  - the server-reported total is kept even when the walk was capped, and the
 *    header then says how many rows are actually shown (never silent truncation);
 *  - the day boundaries (00:00:00 → current day end, capped to "now") and the
 *    status filter are passed to the service;
 *  - a failed load shows the error banner and stops the spinner.
 *
 * Approach: mount the component, provide a stub `Order` service returning a
 * controlled `OrderCollection`, then assert the rendered header text (counters +
 * truncation notice) and the exact arguments handed to the service.
 */
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ɵresolveComponentResources as resolveComponentResources } from '@angular/core';
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
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TodayOrders);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
  });

  function headerText(): string {
    const header = (fixture.nativeElement as HTMLElement).querySelector('header p');
    const text = header?.textContent ?? '';
    return text.replace(/\s+/g, ' ').trim();
  }

  it('keeps every row of the day and renders the counters from all of them', () => {
    expect(fixture.componentInstance.orders().map((o) => o.id)).toEqual([1, 2, 3]);
    expect(headerText()).toBe('2 activas · 1 entregadas');
  });

  it('page-walks the whole day instead of taking a single page', () => {
    expect(getAll).toHaveBeenCalledTimes(1);
    const [start, end, query] = getAll.mock.calls[0] as [Date, Date, { status?: string }];
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(start.toDateString()).toBe(new Date().toDateString());
    expect(end.getTime()).toBeGreaterThan(start.getTime());
    expect(query).toEqual({ status: undefined });
  });

  it('declares the truncation in the header when the walk was capped', () => {
    getAll.mockReturnValueOnce(
      of(collection([makeOrder(1, 'QUEUE'), makeOrder(2, 'DELIVERED')], 5000, true)),
    );

    fixture.componentInstance.fetchOrders();
    fixture.detectChanges();

    expect(fixture.componentInstance.truncated()).toBe(true);
    expect(headerText()).toBe(
      '1 activas · 1 entregadas · vista limitada: mostrando 2 de 5000 pedidos',
    );
  });

  it('forwards the selected status filter to the service', () => {
    fixture.componentInstance.selectedStatus = 'READY';
    fixture.componentInstance.fetchOrders();

    const query = getAll.mock.calls[1][2] as { status?: string };
    expect(query).toEqual({ status: 'READY' });
  });

  it('shows the error message and stops the spinner when the load fails', () => {
    getAll.mockReturnValueOnce(throwError(() => new Error('boom')));

    fixture.componentInstance.fetchOrders();
    fixture.detectChanges();

    expect(fixture.componentInstance.error()).toBe('No se pudieron cargar las órdenes.');
    expect(fixture.componentInstance.loading()).toBe(false);
  });
});

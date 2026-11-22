/**
 * Tests for the waiter cart (order dock).
 *
 * Feature: compose an order and send it to the kitchen.
 * Contract:
 *  - the cart total adds the base price, the per-unit surcharge and quantity;
 *  - a send in flight cannot be submitted twice (double-submit guard);
 *  - a successful send clears the cart but keeps the table selected so another
 *    round can be added to the same table;
 *  - a ProblemDetail `detail` is kept in a persistent error instead of being
 *    replaced by a generic message.
 *
 * Approach: instantiate the component in the TestBed injection context with a
 * stubbed `Order` service and the real `OrderDock` cart service, then exercise
 * the signals and submission paths directly.
 */
import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Order } from '@app/core/services/orders/order';
import { OrderDock as OrderDockSvc } from '@app/core/services/order-dock/order-dock';
import { MasterData } from '@app/core/services/master-data/master-data';
import { Logging } from '@app/core/services/logging/logging';
import type { TableResponse } from '@app/shared/models/dto/tables/table-response';
import type { OrderResponse } from '@app/shared/models/dto/orders/order-response';
import { OrderDock } from './order-dock';

const tables: TableResponse[] = [
  { id: 1, tableNumber: 1, capacity: 4, status: 'AVAILABLE' },
  { id: 2, tableNumber: 2, capacity: 2, status: 'OCCUPIED' },
];

const order: OrderResponse = {
  id: 99,
  date: '2026-11-21T12:00:00',
  status: 'QUEUE',
  tableId: 1,
  details: [],
};

function orderSpy(): { createOrder: ReturnType<typeof vi.fn> } {
  return TestBed.inject(Order) as unknown as { createOrder: ReturnType<typeof vi.fn> };
}

function mount(): { component: OrderDock; cart: OrderDockSvc } {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      {
        provide: Order,
        useValue: {
          createOrder: vi.fn().mockReturnValue(of(order)),
        },
      },
      {
        provide: MasterData,
        useValue: {
          reloadTables: () => of(tables),
          getProductOptions: () => of([]),
        },
      },
      { provide: Logging, useValue: { debug: vi.fn(), warn: vi.fn(), error: vi.fn() } },
      { provide: MessageService, useValue: { add: vi.fn() } },
      { provide: Router, useValue: { navigate: vi.fn().mockResolvedValue(true) } },
    ],
  });

  const cart = TestBed.inject(OrderDockSvc);
  const component = TestBed.runInInjectionContext(() => new OrderDock());
  return { component, cart };
}

function addSampleItem(cart: OrderDockSvc): void {
  cart.selectTable(1);
  cart.addItemToDiner({
    product: {
      id: 1,
      name: 'Hamburguesa',
      basePrice: { amount: '10000.00', currency: 'COP' },
      active: true,
      categoryId: 1,
      categoryName: 'Hamburguesas',
      areaId: 1,
    },
    instructions: 'sin cebolla',
    selectedOptionIds: [3],
    optionNames: ['Queso'],
    optionGroups: [{ groupName: 'Extras', optionNames: ['Queso'] }],
    extraCharge: 2000,
    quantity: 2,
  });
}

describe('OrderDock', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('totals base price plus surcharge times quantity', () => {
    const { cart } = mount();
    addSampleItem(cart);

    expect(cart.totalItems()).toBe(2);
    expect(cart.totalAmount()).toBe(24000);
  });

  it('blocks a second submit while the first one is in flight', () => {
    const { component, cart } = mount();
    addSampleItem(cart);

    component.submitting.set(true);
    component.sendToKitchen();

    expect(orderSpy().createOrder).not.toHaveBeenCalled();
  });

  it('clears the cart but keeps the table after a successful send', () => {
    const { component, cart } = mount();
    addSampleItem(cart);

    component.sendToKitchen();

    expect(orderSpy().createOrder).toHaveBeenCalledTimes(1);
    expect(cart.totalItems()).toBe(0);
    expect(cart.selectedTableId()).toBe(1);
    expect(component.submitting()).toBe(false);
  });

  it('keeps the ProblemDetail detail in a persistent error after a failed send', () => {
    const { component, cart } = mount();
    addSampleItem(cart);

    orderSpy().createOrder.mockReturnValueOnce(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 409,
            error: { detail: 'La mesa ya está ocupada.' },
          }),
      ),
    );

    component.sendToKitchen();

    expect(component.submitError()).toBe('La mesa ya está ocupada.');
    expect(cart.totalItems()).toBe(2);
  });

  it('opens the table picker instead of sending when no table is selected', () => {
    const { component, cart } = mount();
    cart.addItemToDiner({
      product: {
        id: 1,
        name: 'Café',
        basePrice: { amount: '5000.00', currency: 'COP' },
        active: true,
        categoryId: 1,
        categoryName: 'Bebidas',
        areaId: 1,
      },
      instructions: '',
      selectedOptionIds: [],
      optionNames: [],
      quantity: 1,
    });

    component.requestSend();

    expect(component.tablePickerOpen()).toBe(true);
    expect(orderSpy().createOrder).not.toHaveBeenCalled();
  });

  it('renders the selected table and the item count in the accessible cart label', () => {
    const { component, cart } = mount();
    addSampleItem(cart);

    expect(component.cartAriaLabel()).toContain('Mesa 1');
    expect(component.cartAriaLabel()).toContain('2 productos');
  });
});

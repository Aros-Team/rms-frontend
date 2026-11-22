/**
 * Tests for the cashier receipt dialog.
 *
 * Feature: print-ready proof of a charge with the server snapshot, the tenders,
 * the change, the cashier and the void audit.
 * Contract:
 *  - money comes from the payment response, not from the order preview;
 *  - a voided payment is labelled ANULADO with the reason and timestamp;
 *  - the void action only appears for a completed payment of the open shift;
 *  - the print action uses the isolated print path;
 *  - lines are shown when the order is known, and the absence is stated
 *    otherwise.
 *
 * Approach: mount with a visible dialog, query the document body (PrimeNG
 * portals the dialog) and assert the rendered receipt + emitted actions.
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { OrderResponse } from '@app/shared/models/dto/orders/order-response';
import type { PaymentResponse } from '@app/shared/models/dto/payments/payment-response';
import { Money } from '@app/shared/pipes/money/money';
import { buttonByText, resolveCashierResources } from '../../testing/cashier-test-resources';
import { CashierReceipt } from './receipt';

function makePayment(overrides: Partial<PaymentResponse> = {}): PaymentResponse {
  return {
    id: 1,
    orderId: 900029,
    status: 'COMPLETED',
    receiptNumber: 'R-20261121-000001',
    currency: 'COP',
    subtotal: { amount: '62000.00', currency: 'COP' },
    discount: { amount: '0.00', currency: 'COP' },
    tip: { amount: '5000.00', currency: 'COP' },
    total: { amount: '67000.00', currency: 'COP' },
    tendered: { amount: '70000.00', currency: 'COP' },
    change: { amount: '3000.00', currency: 'COP' },
    tenders: [
      { method: 'CARD', amount: { amount: '30000.00', currency: 'COP' }, reference: 'AUTH-1' },
      { method: 'CASH', amount: { amount: '40000.00', currency: 'COP' }, reference: null },
    ],
    cashierId: 1013,
    shiftId: 2,
    createdAt: '2026-11-21T21:45:22',
    completedAt: '2026-11-21T21:45:22.123456789',
    voidedAt: null,
    voidedBy: null,
    voidReason: null,
    ...overrides,
  };
}

const order: OrderResponse = {
  id: 900029,
  date: '2026-11-21T11:01:00',
  status: 'DELIVERED',
  tableId: 2,
  details: [
    {
      id: 1,
      productId: 10,
      productName: 'Hamburguesa',
      unitPrice: { amount: '25000.00', currency: 'COP' },
      instructions: '',
    },
    {
      id: 2,
      productId: 11,
      productName: 'Limonada',
      unitPrice: { amount: '12000.00', currency: 'COP' },
      instructions: 'Sin hielo',
    },
  ],
};

describe('CashierReceipt', () => {
  let fixture: ComponentFixture<CashierReceipt>;
  let component: CashierReceipt;

  beforeAll(async () => {
    await resolveCashierResources();
  });

  beforeEach(async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({ imports: [CashierReceipt] }).compileComponents();

    fixture = TestBed.createComponent(CashierReceipt);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    fixture.destroy();
    for (const mask of Array.from(document.body.querySelectorAll('.p-dialog-mask'))) {
      mask.remove();
    }
  });

  function setup(overrides: Partial<CashierReceipt> = {}): void {
    Object.assign(component, {
      visible: true,
      payment: makePayment(),
      order,
      tableNumber: 2,
      cashierName: 'Cajera Uno',
      canVoid: true,
      ...overrides,
    });
    fixture.detectChanges();
  }

  function ticket(): HTMLElement {
    const element = document.body.querySelector<HTMLElement>('.receipt-ticket');
    if (element === null) throw new Error('receipt ticket not rendered');
    return element;
  }

  it('renders the receipt number, table, cashier and total snapshot', () => {
    setup();

    expect(ticket().querySelector('.receipt-ticket__number')?.textContent.trim()).toBe(
      'R-20261121-000001',
    );
    expect(ticket().textContent).toContain('Mesa');
    expect(ticket().textContent).toContain('Cajera Uno');
    expect(ticket().textContent).toContain('21/11/2026');
    expect(ticket().textContent).toContain(new Money().transform(67000));
  });

  it('renders the tenders, their reference and the change', () => {
    setup();

    const text = ticket().textContent;
    expect(text).toContain('Tarjeta');
    expect(text).toContain('Ref. AUTH-1');
    expect(text).toContain('Efectivo');
    expect(text).toContain(new Money().transform(3000));
  });

  it('renders the order lines when the detail is known', () => {
    setup();

    const names = Array.from(ticket().querySelectorAll('.receipt-ticket__items tbody tr')).map(
      (row) => row.querySelector('td')?.textContent.trim(),
    );
    expect(names[0]).toContain('Hamburguesa');
    expect(names[1]).toContain('Limonada');
  });

  it('states when the order detail is unavailable on a reprint', () => {
    setup({ order: null });

    expect(ticket().querySelector('.receipt-ticket__note')?.textContent.trim()).toBe(
      'Detalle de productos no disponible.',
    );
  });

  it('labels a voided payment with the reason', () => {
    setup({
      payment: makePayment({
        status: 'VOIDED',
        voidedAt: '2026-11-21T22:00:00',
        voidReason: 'Cobro duplicado',
      }),
    });

    expect(ticket().querySelector('.receipt-ticket__void')?.textContent.trim()).toBe('ANULADO');
    expect(ticket().textContent).toContain('Cobro duplicado');
  });

  it('offers the void action only for a completed payment of the open shift', () => {
    const spy = vi.fn();
    component.voidRequested.subscribe(spy);
    setup({ canVoid: true });

    buttonByText(document.body, 'Anular cobro').click();

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
  });

  it('hides the void action when the payment is already voided', () => {
    setup({ canVoid: true, payment: makePayment({ status: 'VOIDED' }) });

    const labels = Array.from(document.body.querySelectorAll('button')).map((button) =>
      button.textContent.trim(),
    );
    expect(labels).not.toContain('Anular cobro');
  });

  it('prints through the isolated receipt path', () => {
    setup();
    const spy = vi.spyOn(component, 'printReceipt').mockImplementation(() => undefined);

    buttonByText(document.body, 'Imprimir').click();

    expect(spy).toHaveBeenCalled();
  });

  it('closes and starts a new charge', () => {
    const visibleSpy = vi.fn();
    const newChargeSpy = vi.fn();
    component.visibleChange.subscribe(visibleSpy);
    component.newCharge.subscribe(newChargeSpy);
    setup();

    buttonByText(document.body, 'Cerrar').click();
    buttonByText(document.body, 'Nuevo cobro').click();

    expect(visibleSpy).toHaveBeenCalledWith(false);
    expect(newChargeSpy).toHaveBeenCalled();
  });
});

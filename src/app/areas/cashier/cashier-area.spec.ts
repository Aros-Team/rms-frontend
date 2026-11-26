/**
 * Tests for the cashier workspace orchestration.
 *
 * Feature: load the shift and the board, resolve the selected order, charge
 * idempotently, recover from an already-paid conflict, void with rollback, and
 * open/close the drawer.
 * Contract:
 *  - the board and the shift load on init; the journal is filtered to the shift;
 *  - selecting a row loads the full order through the lookup;
 *  - a charge reuses one idempotency key, opens the receipt and refreshes the
 *    board + shift;
 *  - a 409 with `paymentId` opens the existing receipt instead of retrying;
 *  - charging with no shift is blocked and opens the shift dialog;
 *  - void keeps local state untouched on failure and reloads on success;
 *  - search/date/page changes reset paging and call the API with the new filter.
 *
 * Approach: stub the HTTP services and the order lookup, then drive the public
 * methods and assert the service arguments + the component signals.
 */
import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { of, throwError } from 'rxjs';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { Auth } from '@app/core/services/auth/auth';
import { CashShift } from '@app/core/services/cash-shifts/cash-shift';
import { Logging } from '@app/core/services/logging/logging';
import { Payment } from '@app/core/services/payments/payment';
import type {
  CashShiftResponse,
  CashShiftSummaryResponse,
} from '@app/shared/models/dto/cash-shifts/cash-shift';
import type { Page } from '@app/shared/models/dto/common/pagination';
import type { OrderResponse } from '@app/shared/models/dto/orders/order-response';
import type { PaymentResponse } from '@app/shared/models/dto/payments/payment-response';
import type { PaymentSummaryResponse } from '@app/shared/models/dto/payments/payment-summary-response';
import type { PendingOrderResponse } from '@app/shared/models/dto/payments/pending-order-response';
import type { RegisterPaymentRequest } from '@app/shared/models/dto/payments/register-payment-request';
import { CashierOrderLookup } from './data/order-lookup';
import { CashierArea } from './cashier-area';
import { resolveCashierResources } from './testing/cashier-test-resources';

function page<T>(items: T[], total = items.length, pageIndex = 0): Page<T> {
  return { items, total, page: pageIndex, size: 20, totalPages: total === 0 ? 0 : 1 };
}

const pendingOne: PendingOrderResponse = {
  orderId: 900029,
  tableId: 2,
  tableNumber: 2,
  partySize: 2,
  deliveredAt: '2026-11-21T11:01:00',
  total: { amount: '62000.00', currency: 'COP' },
  paymentStatus: 'UNPAID',
};

const pendingTwo: PendingOrderResponse = {
  ...pendingOne,
  orderId: 900030,
  tableNumber: 3,
  total: { amount: '30000.00', currency: 'COP' },
};

const order: OrderResponse = {
  id: 900029,
  date: '2026-11-21T11:01:00',
  status: 'DELIVERED',
  tableId: 2,
  total: { amount: '62000.00', currency: 'COP' },
  details: [{ id: 1, productId: 10, productName: 'Café', unitPrice: 62000, instructions: '' }],
};

const shift: CashShiftResponse = {
  id: 2,
  status: 'OPEN',
  currency: 'COP',
  openedBy: 1013,
  openedAt: '2026-11-21T21:45:23',
  openingFloat: { amount: '100000.00', currency: 'COP' },
  notes: null,
};

const summary: CashShiftSummaryResponse = {
  id: 2,
  status: 'OPEN',
  currency: 'COP',
  openedBy: 1013,
  openedAt: '2026-11-21T21:45:23',
  closedBy: null,
  closedAt: null,
  openingFloat: { amount: '100000.00', currency: 'COP' },
  paymentsCount: 1,
  voidedCount: 0,
  subtotal: { amount: '62000.00', currency: 'COP' },
  discounts: { amount: '0.00', currency: 'COP' },
  tips: { amount: '0.00', currency: 'COP' },
  totalCharged: { amount: '62000.00', currency: 'COP' },
  cash: { amount: '62000.00', currency: 'COP' },
  card: { amount: '0.00', currency: 'COP' },
  transfer: { amount: '0.00', currency: 'COP' },
  changeGiven: { amount: '0.00', currency: 'COP' },
  paidIn: { amount: '0.00', currency: 'COP' },
  paidOut: { amount: '0.00', currency: 'COP' },
  expectedCash: { amount: '162000.00', currency: 'COP' },
  countedCash: null,
  difference: null,
  notes: null,
};

const closedSummary: CashShiftSummaryResponse = {
  ...summary,
  status: 'CLOSED',
  closedBy: 1013,
  closedAt: '2026-11-21T23:00:00',
  countedCash: { amount: '161000.00', currency: 'COP' },
  difference: { amount: '-1000.00', currency: 'COP' },
};

const payment: PaymentResponse = {
  id: 1,
  orderId: 900029,
  status: 'COMPLETED',
  receiptNumber: 'R-20261121-000001',
  currency: 'COP',
  subtotal: { amount: '62000.00', currency: 'COP' },
  discount: { amount: '0.00', currency: 'COP' },
  tip: { amount: '0.00', currency: 'COP' },
  total: { amount: '62000.00', currency: 'COP' },
  tendered: { amount: '62000.00', currency: 'COP' },
  change: { amount: '0.00', currency: 'COP' },
  tenders: [{ method: 'CASH', amount: { amount: '62000.00', currency: 'COP' }, reference: null }],
  cashierId: 1013,
  shiftId: 2,
  createdAt: '2026-11-21T21:45:22',
  completedAt: '2026-11-21T21:45:22',
  voidedAt: null,
  voidedBy: null,
  voidReason: null,
};

const journalRow: PaymentSummaryResponse = {
  id: 1,
  orderId: 900029,
  status: 'COMPLETED',
  receiptNumber: 'R-20261121-000001',
  currency: 'COP',
  subtotal: { amount: '62000.00', currency: 'COP' },
  discount: { amount: '0.00', currency: 'COP' },
  tip: { amount: '0.00', currency: 'COP' },
  total: { amount: '62000.00', currency: 'COP' },
  cashierId: 1013,
  shiftId: 2,
  completedAt: '2026-11-21T21:45:22',
  voidedAt: null,
  voidReason: null,
};

const chargeRequest: RegisterPaymentRequest = {
  orderId: 900029,
  tipAmount: '0.00',
  tenders: [{ method: 'CASH', amount: '62000.00' }],
};

describe('CashierArea', () => {
  let fixture: ComponentFixture<CashierArea>;
  let component: CashierArea;

  let payments: {
    getPending: ReturnType<typeof vi.fn>;
    charge: ReturnType<typeof vi.fn>;
    getById: ReturnType<typeof vi.fn>;
    getJournal: ReturnType<typeof vi.fn>;
    voidPayment: ReturnType<typeof vi.fn>;
  };
  let shifts: {
    getCurrent: ReturnType<typeof vi.fn>;
    getSummary: ReturnType<typeof vi.fn>;
    open: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
  };
  let lookup: {
    find: ReturnType<typeof vi.fn>;
    remember: ReturnType<typeof vi.fn>;
    forget: ReturnType<typeof vi.fn>;
    clear: ReturnType<typeof vi.fn>;
  };
  let messages: { add: ReturnType<typeof vi.fn> };

  beforeAll(async () => {
    await resolveCashierResources();
  });

  beforeEach(async () => {
    payments = {
      getPending: vi.fn().mockReturnValue(of(page([pendingOne, pendingTwo], 2))),
      charge: vi.fn().mockReturnValue(of(payment)),
      getById: vi.fn().mockReturnValue(of(payment)),
      getJournal: vi.fn().mockReturnValue(of(page([journalRow], 1))),
      voidPayment: vi.fn().mockReturnValue(of({ ...payment, status: 'VOIDED' })),
    };
    shifts = {
      getCurrent: vi.fn().mockReturnValue(of(shift)),
      getSummary: vi.fn().mockReturnValue(of(summary)),
      open: vi.fn().mockReturnValue(of(shift)),
      close: vi.fn().mockReturnValue(of(closedSummary)),
    };
    lookup = {
      find: vi.fn().mockReturnValue(of(order)),
      remember: vi.fn(),
      forget: vi.fn(),
      clear: vi.fn(),
    };
    messages = { add: vi.fn() };

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [CashierArea],
      providers: [
        { provide: Payment, useValue: payments },
        { provide: CashShift, useValue: shifts },
        { provide: CashierOrderLookup, useValue: lookup },
        { provide: Auth, useValue: { getData: () => ({ name: 'Cajera Uno' }) } },
        { provide: MessageService, useValue: messages },
        {
          provide: Logging,
          useValue: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CashierArea);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    for (const mask of Array.from(document.body.querySelectorAll('.p-dialog-mask'))) {
      mask.remove();
    }
  });

  it('loads the current shift, the board and the shift journal on init', () => {
    expect(shifts.getCurrent).toHaveBeenCalledTimes(1);
    expect(payments.getPending).toHaveBeenCalledWith(
      expect.objectContaining({ page: 0, size: 20 }),
    );
    expect(shifts.getSummary).toHaveBeenCalledWith(2);
    expect(payments.getJournal).toHaveBeenCalledWith(
      expect.objectContaining({ date: '2026-11-21', page: 0, size: 100 }),
    );
    expect(component.pending()).toHaveLength(2);
    expect(component.journal()).toEqual([journalRow]);
    expect(component.shiftOpen()).toBe(true);
  });

  it('loads the order detail when a pending row is selected', () => {
    component.onSelectOrder(pendingOne);
    fixture.detectChanges();

    expect(lookup.find).toHaveBeenCalledWith(pendingOne);
    expect(component.order()).toEqual(order);
    expect(component.orderLoading()).toBe(false);
  });

  it('charges with one idempotency key, opens the receipt and refreshes', () => {
    component.onSelectOrder(pendingOne);
    fixture.detectChanges();

    component.onCharge(chargeRequest);

    expect(payments.charge).toHaveBeenCalledTimes(1);
    const [request, key] = payments.charge.mock.calls[0] as [RegisterPaymentRequest, string];
    expect(request).toEqual(chargeRequest);
    expect(typeof key).toBe('string');
    expect(key.length).toBeGreaterThan(10);

    expect(component.receiptVisible()).toBe(true);
    expect(component.receiptPayment()).toEqual(payment);
    expect(component.receiptOrder()).toEqual(order);
    expect(component.selected()).toBeNull();
    expect(payments.getPending).toHaveBeenCalledTimes(2);
    expect(shifts.getCurrent).toHaveBeenCalledTimes(2);
    expect(messages.add).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'success', summary: 'Cobro registrado' }),
    );
  });

  it('opens the existing receipt when the order was already paid', () => {
    const existing: PaymentResponse = { ...payment, id: 77, receiptNumber: 'R-EXISTING' };
    payments.charge.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 409,
            error: { detail: 'El pedido 900029 ya fue pagado', paymentId: 77 },
          }),
      ),
    );
    payments.getById.mockReturnValue(of(existing));

    component.onCharge(chargeRequest);
    fixture.detectChanges();

    expect(payments.getById).toHaveBeenCalledWith(77);
    expect(component.chargeError()).toBeNull();
    expect(component.receiptVisible()).toBe(true);
    expect(component.receiptPayment()?.receiptNumber).toBe('R-EXISTING');
    expect(messages.add).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'warn', summary: 'La cuenta ya estaba cobrada' }),
    );
  });

  it('blocks the charge without an open shift and opens the shift dialog', () => {
    shifts.getCurrent.mockReturnValue(of(null));
    component.loadShift();
    fixture.detectChanges();

    component.onCharge(chargeRequest);

    expect(payments.charge).not.toHaveBeenCalled();
    expect(component.shiftVisible()).toBe(true);
    expect(component.chargeError()).toBe(
      'No hay un turno de caja abierto. Abre la caja para cobrar.',
    );
  });

  it('voids a payment and reloads the board and shift', () => {
    component.onVoidRequested(payment);
    expect(component.voidVisible()).toBe(true);

    component.confirmVoid('Cobro duplicado');

    expect(payments.voidPayment).toHaveBeenCalledWith(1, 'Cobro duplicado');
    expect(component.voidVisible()).toBe(false);
    expect(component.voidTarget()).toBeNull();
    expect(payments.getPending).toHaveBeenCalledTimes(2);
    expect(shifts.getCurrent).toHaveBeenCalledTimes(2);
    expect(messages.add).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'success', summary: 'Cobro anulado' }),
    );
  });

  it('keeps the void dialog and the payment untouched when the void fails', () => {
    component.onVoidRequested(payment);
    payments.voidPayment.mockReturnValue(
      throwError(
        () => new HttpErrorResponse({ status: 409, error: { detail: 'El turno está cerrado' } }),
      ),
    );

    component.confirmVoid('Cobro duplicado');

    expect(component.voidVisible()).toBe(true);
    expect(component.voidTarget()).toEqual(payment);
    expect(component.voidError()).toBe('El turno está cerrado');
    expect(component.receiptPayment()).toBeNull();
  });

  it('opens a shift and clears the closed summary', () => {
    component.closedSummary.set(closedSummary);

    component.onOpenShift(100000);

    expect(shifts.open).toHaveBeenCalledWith(100000);
    expect(component.shift()).toEqual(shift);
    expect(component.closedSummary()).toBeNull();
    expect(shifts.getSummary).toHaveBeenCalledWith(2);
  });

  it('closes a shift and keeps the frozen summary for the Z-report', () => {
    component.onCloseShift({ countedCash: 161000, notes: 'Cierre' });

    expect(shifts.close).toHaveBeenCalledWith(2, 161000, 'Cierre');
    expect(component.shift()).toBeNull();
    expect(component.closedSummary()).toEqual(closedSummary);
    expect(messages.add).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'success', summary: 'Caja cerrada' }),
    );
  });

  it('resets paging and reloads on search, date and page changes', () => {
    payments.getPending.mockClear();

    component.onSearchChange('2');
    expect(payments.getPending).toHaveBeenCalledWith(
      expect.objectContaining({ search: '2', page: 0 }),
    );

    payments.getPending.mockClear();
    component.onSearchChange('Mesa 3');
    expect(payments.getPending).toHaveBeenCalledWith(
      expect.objectContaining({ search: '3', page: 0 }),
    );

    payments.getPending.mockClear();
    component.onPageChange(1);
    expect(payments.getPending).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1 }),
    );

    payments.getPending.mockClear();
    component.onDateChange('2026-11-20');
    expect(lookup.clear).toHaveBeenCalled();
    expect(payments.getPending).toHaveBeenCalledWith(
      expect.objectContaining({ date: '2026-11-20', page: 0 }),
    );
  });

  it('keeps the board on a silent refresh failure', () => {
    payments.getPending.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 500 })),
    );

    component.loadPending(true);

    expect(component.pending()).toHaveLength(2);
    expect(component.pendingError()).toBeNull();
  });
});

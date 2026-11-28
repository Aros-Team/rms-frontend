/**
 * Tests for the cash drawer shift dialog.
 *
 * Feature: open a shift with a float, watch the live totals, close with the
 * counted cash and read the Z-summary and payment journal.
 * Contract:
 *  - a negative float is rejected inline and blocks the open;
 *  - open emits the parsed float; close is two-step and emits the counted cash
 *    plus the optional notes;
 *  - the expected-vs-counted difference is computed from the server expected
 *    cash and labelled Faltante / Sobrante / Cuadra;
 *  - the journal only offers a void for a completed payment of the open shift;
 *  - a closed summary is read-only and offers reopening for the next shift.
 *
 * Approach: mount the dialog visible, query the portalled body, drive the real
 * inputs and assert the emitted payloads and rendered totals.
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  CashShiftResponse,
  CashShiftSummaryResponse,
} from '@app/shared/models/dto/cash-shifts/cash-shift';
import type { PaymentSummaryResponse } from '@app/shared/models/dto/payments/payment-summary-response';
import { Money } from '@app/shared/pipes/money/money';
import {
  buttonByText,
  resolveCashierResources,
  setInputValue,
} from '../../testing/cashier-test-resources';
import { CashierShiftDialog } from './shift-dialog';

const shift: CashShiftResponse = {
  id: 2,
  status: 'OPEN',
  currency: 'COP',
  openedBy: 1013,
  openedAt: '2026-11-21T21:45:23',
  openingFloat: { amount: '100000.00', currency: 'COP' },
  notes: null,
};

function makeSummary(overrides: Partial<CashShiftSummaryResponse> = {}): CashShiftSummaryResponse {
  return {
    id: 2,
    status: 'OPEN',
    currency: 'COP',
    openedBy: 1013,
    openedAt: '2026-11-21T21:45:23',
    closedBy: null,
    closedAt: null,
    openingFloat: { amount: '100000.00', currency: 'COP' },
    paymentsCount: 2,
    voidedCount: 0,
    subtotal: { amount: '126000.00', currency: 'COP' },
    discounts: { amount: '0.00', currency: 'COP' },
    tips: { amount: '0.00', currency: 'COP' },
    totalCharged: { amount: '126000.00', currency: 'COP' },
    cash: { amount: '126000.00', currency: 'COP' },
    card: { amount: '0.00', currency: 'COP' },
    transfer: { amount: '0.00', currency: 'COP' },
    changeGiven: { amount: '0.00', currency: 'COP' },
    paidIn: { amount: '0.00', currency: 'COP' },
    paidOut: { amount: '0.00', currency: 'COP' },
    expectedCash: { amount: '226000.00', currency: 'COP' },
    countedCash: null,
    difference: null,
    notes: null,
    ...overrides,
  };
}

function makeSummaryRow(
  id: number,
  status: 'COMPLETED' | 'VOIDED',
  receiptNumber: string,
): PaymentSummaryResponse {
  return {
    id,
    orderId: 900029 + id,
    status,
    receiptNumber,
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
}

describe('CashierShiftDialog', () => {
  let fixture: ComponentFixture<CashierShiftDialog>;
  let component: CashierShiftDialog;

  beforeAll(async () => {
    await resolveCashierResources();
  });

  beforeEach(async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({ imports: [CashierShiftDialog] }).compileComponents();

    fixture = TestBed.createComponent(CashierShiftDialog);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    fixture.destroy();
    for (const mask of Array.from(document.body.querySelectorAll('.p-dialog-mask'))) {
      mask.remove();
    }
  });

  async function setup(overrides: Partial<CashierShiftDialog> = {}): Promise<void> {
    Object.assign(component, {
      visible: true,
      shift: null,
      summary: null,
      closedSummary: null,
      payments: [],
      loading: false,
      busy: false,
      error: null,
      ...overrides,
    });
    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();
  }

  function input(selector: string): HTMLInputElement {
    const element = document.body.querySelector<HTMLInputElement>(selector);
    if (element === null) throw new Error(`Input ${selector} not found`);
    return element;
  }

  function summaryValue(label: string): string | undefined {
    const rows = Array.from(document.body.querySelectorAll('.shift-dialog__totals div'));
    const row = rows.find((value) => value.querySelector('dt')?.textContent.trim() === label);
    return row?.querySelector('dd')?.textContent.trim();
  }

  it('opens the drawer with the entered float', async () => {
    const spy = vi.fn();
    component.openShift.subscribe(spy);
    await setup();

    setInputValue(input('#shift-float'), '100000');
    fixture.detectChanges();
    buttonByText(document.body, 'Abrir caja').click();

    expect(spy).toHaveBeenCalledWith(100000);
  });

  it('rejects a negative float inline and disables the open', async () => {
    await setup();

    setInputValue(input('#shift-float'), '-5');
    fixture.detectChanges();

    expect(document.body.textContent).toContain('El fondo no puede ser negativo.');
    expect(buttonByText(document.body, 'Abrir caja').disabled).toBe(true);
  });

  it('renders the live expected cash and the empty journal', async () => {
    await setup({ shift, summary: makeSummary() });

    expect(summaryValue('Esperado en caja')).toBe(new Money().transform(226000));
    expect(document.body.textContent).toContain('Todavía no hay cobros en este turno.');
    expect(input('#shift-counted')).toBeDefined();
  });

  it('shows a shortage and closes with the counted cash after confirmation', async () => {
    const spy = vi.fn();
    component.closeShift.subscribe(spy);
    await setup({ shift, summary: makeSummary() });

    setInputValue(input('#shift-counted'), '225000');
    setInputValue(input('#shift-notes'), '  Cierre turno noche  ');
    fixture.detectChanges();

    expect(document.body.textContent).toContain('Faltante');
    expect(document.body.querySelector('.shift-dialog__difference--short')).not.toBeNull();

    buttonByText(document.body, 'Cerrar caja').click();
    fixture.detectChanges();
    expect(document.body.textContent).toContain('¿Cerrar el turno con');

    buttonByText(document.body, 'Confirmar cierre').click();

    expect(spy).toHaveBeenCalledWith({
      countedCash: 225000,
      notes: 'Cierre turno noche',
    });
  });

  it('shows matched cash as Cuadra', async () => {
    await setup({
      shift,
      summary: makeSummary({ expectedCash: { amount: '226000.00', currency: 'COP' } }),
    });

    setInputValue(input('#shift-counted'), '226000');
    fixture.detectChanges();

    expect(document.body.textContent).toContain('Cuadra');
    expect(document.body.querySelector('.shift-dialog__difference--balanced')).not.toBeNull();
  });

  it('renders the frozen Z-summary and offers the next shift', async () => {
    await setup({
      closedSummary: makeSummary({
        status: 'CLOSED',
        closedAt: '2026-11-21T23:00:00',
        countedCash: { amount: '225000.00', currency: 'COP' },
        difference: { amount: '-1000.00', currency: 'COP' },
      }),
    });

    expect(summaryValue('Contado')).toBe(new Money().transform(225000));
    expect(summaryValue('Diferencia')).toBe(new Money().transform(-1000));
    expect(document.body.textContent).toContain('Abrir el siguiente turno');

    const labels = Array.from(document.body.querySelectorAll('button')).map((button) =>
      button.textContent.trim(),
    );
    expect(labels).not.toContain('Cerrar caja');
  });

  it('offers a void only for a completed payment of the open shift', async () => {
    const spy = vi.fn();
    component.voidRequested.subscribe(spy);
    await setup({
      shift,
      summary: makeSummary(),
      payments: [makeSummaryRow(1, 'COMPLETED', 'R-1'), makeSummaryRow(2, 'VOIDED', 'R-2')],
    });

    const voidButton = document.body.querySelector<HTMLButtonElement>(
      '[aria-label="Anular cobro R-1"]',
    );
    expect(voidButton).not.toBeNull();
    expect(document.body.querySelector('[aria-label="Anular cobro R-2"]')).toBeNull();

    voidButton?.click();
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ receiptNumber: 'R-1' }));
  });

  it('does not offer voids after the shift is closed', async () => {
    await setup({
      closedSummary: makeSummary({ status: 'CLOSED' }),
      payments: [makeSummaryRow(1, 'COMPLETED', 'R-1')],
    });

    expect(document.body.querySelector('[aria-label="Anular cobro R-1"]')).toBeNull();
  });

  it('emits a refresh', async () => {
    const spy = vi.fn();
    component.refresh.subscribe(spy);
    await setup({ shift, summary: makeSummary() });

    buttonByText(document.body, 'Actualizar').click();

    expect(spy).toHaveBeenCalled();
  });

  it('shows the server error with role alert', async () => {
    await setup({ shift, summary: makeSummary(), error: 'No se pudo cerrar la caja.' });

    expect(document.body.querySelector('.shift-dialog__error')?.textContent.trim()).toBe(
      'No se pudo cerrar la caja.',
    );
  });

  it('shows skeletons while loading', async () => {
    await setup({ loading: true });

    expect(document.body.querySelector('.shift-dialog__loading')).not.toBeNull();
    expect(document.body.querySelector('.shift-dialog__totals')).toBeNull();
  });
});

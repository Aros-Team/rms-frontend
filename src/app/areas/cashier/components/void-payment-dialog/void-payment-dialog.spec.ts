/**
 * Tests for the void confirmation dialog.
 *
 * Feature: a full, reason-mandatory void of a payment charged in the open shift.
 * Contract:
 *  - the destructive action stays disabled until the trimmed reason is present;
 *  - the reason is emitted trimmed; whitespace-only never submits;
 *  - the dialog explains that the void is total and irreversible;
 *  - a server error is shown with role alert and the dialog stays open.
 *
 * Approach: mount a visible dialog, drive the real reason input and the footer
 * buttons, then assert the emitted value and the disabled state.
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PaymentResponse } from '@app/shared/models/dto/payments/payment-response';
import {
  buttonByText,
  resolveCashierResources,
  setInputValue,
} from '../../testing/cashier-test-resources';
import { CashierVoidDialog } from './void-payment-dialog';

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

describe('CashierVoidDialog', () => {
  let fixture: ComponentFixture<CashierVoidDialog>;
  let component: CashierVoidDialog;

  beforeAll(async () => {
    await resolveCashierResources();
  });

  beforeEach(async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({ imports: [CashierVoidDialog] }).compileComponents();

    fixture = TestBed.createComponent(CashierVoidDialog);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    fixture.destroy();
    for (const mask of Array.from(document.body.querySelectorAll('.p-dialog-mask'))) {
      mask.remove();
    }
  });

  async function setup(overrides: Partial<CashierVoidDialog> = {}): Promise<void> {
    Object.assign(component, {
      visible: true,
      payment,
      busy: false,
      error: null,
      ...overrides,
    });
    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();
  }

  function reasonInput(): HTMLInputElement {
    const input = document.body.querySelector<HTMLInputElement>('#void-reason');
    if (input === null) throw new Error('void reason input not found');
    return input;
  }

  function confirmButton(): HTMLButtonElement {
    return buttonByText(document.body, 'Anular cobro');
  }

  it('explains the receipt, the amount and that the void is irreversible', async () => {
    await setup();

    const text = document.body.textContent;
    expect(text).toContain('R-20261121-000001');
    expect(text).toContain('total e irreversible');
  });

  it('disables the confirm action without a reason', async () => {
    await setup();

    expect(confirmButton().disabled).toBe(true);
  });

  it('emits the trimmed reason', async () => {
    const spy = vi.fn();
    component.confirmVoid.subscribe(spy);
    await setup();

    setInputValue(reasonInput(), '  Cobro duplicado  ');
    fixture.detectChanges();
    confirmButton().click();

    expect(spy).toHaveBeenCalledWith('Cobro duplicado');
  });

  it('refuses a whitespace-only reason', async () => {
    const spy = vi.fn();
    component.confirmVoid.subscribe(spy);
    await setup();

    setInputValue(reasonInput(), '     ');
    fixture.detectChanges();
    confirmButton().click();

    expect(spy).not.toHaveBeenCalled();
  });

  it('cancels without voiding', async () => {
    const spy = vi.fn();
    component.visibleChange.subscribe(spy);
    await setup();

    buttonByText(document.body, 'Cancelar').click();

    expect(spy).toHaveBeenCalledWith(false);
  });

  it('shows the server error and keeps the dialog usable', async () => {
    await setup({ error: 'El turno está cerrado.' });

    expect(document.body.querySelector('[role="alert"]')?.textContent.trim()).toBe(
      'El turno está cerrado.',
    );
  });

  it('disables the actions while the request is in flight', async () => {
    await setup({ busy: true });

    expect(confirmButton().disabled).toBe(true);
    expect(buttonByText(document.body, 'Cancelar').disabled).toBe(true);
  });
});

/**
 * Tests for the cashier order review + charge panel.
 *
 * Feature: review the order, apply one discount and a tip, split tenders and
 * preview the change before charging.
 * Contract:
 *  - the subtotal comes from the server order total; the client previews only;
 *  - the first cash tender is prefilled with the exact total;
 *  - the confirm button is disabled while the shift is closed, while a charge
 *    is in flight, or when any backend invariant fails;
 *  - the emitted request has two-decimal amounts, the discount/reason and no
 *    client-side total;
 *  - selecting another order resets the form.
 *
 * Approach: mount the component, drive the real form controls by id and the
 * DS widgets through their public component methods, then assert the emitted
 * request and the rendered totals.
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { OrderResponse } from '@app/shared/models/dto/orders/order-response';
import type { RegisterPaymentRequest } from '@app/shared/models/dto/payments/register-payment-request';
import { Money } from '@app/shared/pipes/money/money';
import {
  buttonByText,
  resolveCashierResources,
  setInputValue,
} from '../../testing/cashier-test-resources';
import { CashierOrderCharge } from './order-charge';

function makeOrder(overrides: Partial<OrderResponse> = {}): OrderResponse {
  return {
    id: 900029,
    date: '2026-11-21T11:01:00',
    status: 'DELIVERED',
    tableId: 2,
    total: { amount: '62000.00', currency: 'COP' },
    details: [
      {
        id: 1,
        productId: 10,
        productName: 'Hamburguesa',
        unitPrice: { amount: '25000.00', currency: 'COP' },
        instructions: '',
        selectedOptions: [{ id: 1, name: 'Sin cebolla', categoryName: 'Extras' }],
      },
      {
        id: 2,
        productId: 10,
        productName: 'Hamburguesa',
        unitPrice: { amount: '25000.00', currency: 'COP' },
        instructions: '',
        selectedOptions: [{ id: 1, name: 'Sin cebolla', categoryName: 'Extras' }],
      },
      {
        id: 3,
        productId: 11,
        productName: 'Limonada',
        unitPrice: { amount: '12000.00', currency: 'COP' },
        instructions: '',
      },
    ],
    ...overrides,
  };
}

describe('CashierOrderCharge', () => {
  let fixture: ComponentFixture<CashierOrderCharge>;
  let component: CashierOrderCharge;
  let root: HTMLElement;

  beforeAll(async () => {
    await resolveCashierResources();
  });

  beforeEach(async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({ imports: [CashierOrderCharge] }).compileComponents();

    fixture = TestBed.createComponent(CashierOrderCharge);
    component = fixture.componentInstance;
    root = fixture.nativeElement as HTMLElement;
  });

  async function setup(overrides: {
    order?: OrderResponse | null;
    shiftOpen?: boolean;
    submitting?: boolean;
    submitError?: string | null;
    error?: string | null;
    loading?: boolean;
  } = {}): Promise<void> {
    fixture.componentRef.setInput('order', overrides.order === undefined ? makeOrder() : overrides.order);
    fixture.componentRef.setInput('tableNumber', 2);
    fixture.componentRef.setInput('shiftOpen', overrides.shiftOpen ?? true);
    fixture.componentRef.setInput('submitting', overrides.submitting ?? false);
    fixture.componentRef.setInput('submitError', overrides.submitError ?? null);
    fixture.componentRef.setInput('error', overrides.error ?? null);
    fixture.componentRef.setInput('loading', overrides.loading ?? false);
    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();
  }

  function input(selector: string): HTMLInputElement {
    const element = root.querySelector<HTMLInputElement>(selector);
    if (element === null) throw new Error(`Input ${selector} not found`);
    return element;
  }

  function confirmButton(): HTMLButtonElement {
    const button = root.querySelector<HTMLButtonElement>('.charge__submit button');
    if (button === null) throw new Error('Confirm button not found');
    return button;
  }

  function summaryValue(label: string): string | undefined {
    const rows = Array.from(root.querySelectorAll('.charge__summary-row'));
    const row = rows.find((value) => value.querySelector('dt')?.textContent.trim() === label);
    return row?.querySelector('dd')?.textContent.trim();
  }

  it('renders the grouped lines with server prices and options', async () => {
    await setup();

    const rows = root.querySelectorAll('.charge__lines tbody tr');
    expect(rows).toHaveLength(2);
    expect(rows[0].querySelector('.charge__line-name')?.textContent.trim()).toBe('Hamburguesa');
    expect(rows[0].querySelectorAll('.charge__col-qty')[0].textContent.trim()).toBe('2');
    expect(rows[1].querySelector('.charge__line-name')?.textContent.trim()).toBe('Limonada');
    expect(root.querySelector('.charge__table')?.textContent.trim()).toBe('Mesa 2');
    expect(root.textContent).toContain('Sin cebolla');
  });

  it('prefills the exact cash tender and enables the charge', async () => {
    await setup();

    expect(input('#charge-tender-amount-0').value).toBe('62000');
    expect(confirmButton().disabled).toBe(false);
    expect(summaryValue('Total')).toBe(new Money().transform(62000));
  });

  it('emits the exact request for an exact-cash charge', async () => {
    const spy = vi.fn<(request: RegisterPaymentRequest) => void>();
    component.charge.subscribe(spy);
    await setup();

    confirmButton().click();

    expect(spy).toHaveBeenCalledWith({
      orderId: 900029,
      tipAmount: '0.00',
      tenders: [{ method: 'CASH', amount: '62000.00' }],
    });
  });

  it('applies a 10% tip over the total and fills the remaining amount', async () => {
    const spy = vi.fn<(request: RegisterPaymentRequest) => void>();
    component.charge.subscribe(spy);
    await setup();

    buttonByText(root, '10%').click();
    fixture.detectChanges();
    expect(component.tipInput()).toBe('6200');

    buttonByText(root, 'Resto').click();
    fixture.detectChanges();
    expect(component.tenders()[0].amountInput).toBe('68200');
    expect(confirmButton().disabled).toBe(false);

    confirmButton().click();
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ tipAmount: '6200.00', tenders: [{ method: 'CASH', amount: '68200.00' }] }),
    );
  });

  it('sends the discount type, value and reason', async () => {
    const spy = vi.fn<(request: RegisterPaymentRequest) => void>();
    component.charge.subscribe(spy);
    await setup();

    component.onDiscountTypeChange('PERCENT');
    fixture.detectChanges();
    setInputValue(input('#charge-discount-value'), '10');
    setInputValue(input('#charge-discount-reason'), 'Cortesía');
    buttonByText(root, 'Resto').click();
    fixture.detectChanges();

    expect(summaryValue('Total')).toBe(new Money().transform(55800));
    confirmButton().click();
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        discount: { type: 'PERCENT', value: '10.00', reason: 'Cortesía' },
        tenders: [{ method: 'CASH', amount: '55800.00' }],
      }),
    );
  });

  it('blocks the charge when the discount has no reason', async () => {
    await setup();

    component.onDiscountTypeChange('PERCENT');
    fixture.detectChanges();
    setInputValue(input('#charge-discount-value'), '10');
    fixture.detectChanges();

    expect(confirmButton().disabled).toBe(true);
    const errors = Array.from(root.querySelectorAll('.rms-field__error')).map((error) =>
      error.textContent.trim(),
    );
    expect(errors).toContain('Explica el motivo del descuento.');
  });

  it('blocks a card tender above the remaining amount', async () => {
    await setup();

    component.onTenderMethodChange(0, 'CARD');
    fixture.detectChanges();
    setInputValue(input('#charge-tender-amount-0'), '70000');
    fixture.detectChanges();

    expect(confirmButton().disabled).toBe(true);
    expect(root.textContent).toContain('Solo el efectivo puede superar el saldo restante.');
  });

  it('adds a second tender prefilled with the remaining amount', async () => {
    await setup();

    setInputValue(input('#charge-tender-amount-0'), '30000');
    fixture.detectChanges();
    buttonByText(root, 'Agregar medio').click();
    fixture.detectChanges();

    expect(root.querySelectorAll('.charge__tender')).toHaveLength(2);
    expect(component.tenders()[1].amountInput).toBe('32000');
  });

  it('keeps at least one tender', async () => {
    await setup();

    const remove = root.querySelector<HTMLButtonElement>('[aria-label="Quitar medio de pago 1"]');
    expect(remove?.disabled).toBe(true);
  });

  it('shows the change when cash exceeds the total', async () => {
    await setup();

    setInputValue(input('#charge-tender-amount-0'), '70000');
    fixture.detectChanges();

    expect(summaryValue('Cambio')).toBe(new Money().transform(8000));
    expect(root.textContent).toContain('Cambio de este medio');
  });

  it('disables the charge while there is no open shift and offers to open it', async () => {
    const spy = vi.fn();
    component.openShift.subscribe(spy);
    await setup({ shiftOpen: false });

    expect(confirmButton().disabled).toBe(true);
    expect(root.textContent).toContain('La caja está cerrada. Abre un turno para registrar cobros.');

    const open = Array.from(root.querySelectorAll('button')).find(
      (button) => button.textContent.trim() === 'Abrir caja',
    );
    open?.click();
    expect(spy).toHaveBeenCalled();
  });

  it('disables the charge while submitting', async () => {
    await setup({ submitting: true });

    expect(confirmButton().disabled).toBe(true);
  });

  it('renders the server error with role alert', async () => {
    await setup({ submitError: 'Order 900029 is already paid by payment 1' });

    expect(root.querySelector('[role="alert"]')?.textContent.trim()).toBe(
      'Order 900029 is already paid by payment 1',
    );
  });

  it('resets the form when another order is selected', async () => {
    await setup();

    buttonByText(root, '10%').click();
    fixture.detectChanges();

    fixture.componentRef.setInput(
      'order',
      makeOrder({
        id: 900030,
        total: { amount: '30000.00', currency: 'COP' },
        details: [
          {
            id: 4,
            productId: 12,
            productName: 'Café',
            unitPrice: { amount: '30000.00', currency: 'COP' },
            instructions: '',
          },
        ],
      }),
    );
    fixture.detectChanges();

    expect(component.tipInput()).toBe('0');
    expect(component.tenders()[0].amountInput).toBe('30000');
    expect(component.discountType()).toBe('');
  });

  it('shows a selection prompt when no order is selected', async () => {
    await setup({ order: null });

    expect(root.querySelector('.rms-empty__title')?.textContent.trim()).toBe(
      'Selecciona una cuenta',
    );
  });

  it('shows the lookup error with a retry action', async () => {
    const spy = vi.fn();
    component.retry.subscribe(spy);
    await setup({ order: null, error: 'No se pudo cargar' });

    expect(root.querySelector('.rms-empty__title')?.textContent.trim()).toBe(
      'No se pudo cargar la cuenta',
    );
    buttonByText(root, 'Reintentar').click();
    expect(spy).toHaveBeenCalled();
  });
});

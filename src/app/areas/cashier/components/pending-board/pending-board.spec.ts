/**
 * Tests for the cashier pending board.
 *
 * Feature: render today's unpaid delivered orders as keyboardable rows with an
 * exact search, a date filter, paging and explicit loading/empty/error states.
 * Contract:
 *  - each row is a button with an accessible name and `aria-pressed`;
 *  - a voided order is labelled "Anulada · re-cobrar" with text, not colour;
 *  - selecting a row emits it; Enter in the search emits the trimmed value;
 *  - the date input emits its value; the pager emits the requested page;
 *  - loading shows skeletons, error shows a retry, empty shows the next action.
 *
 * Approach: mount the presentational component, set inputs, assert the rendered
 * DOM and the emitted events.
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PendingOrderResponse } from '@app/shared/models/dto/payments/pending-order-response';
import { Money } from '@app/shared/pipes/money/money';
import {
  buttonByText,
  resolveCashierResources,
  setInputValue,
} from '../../testing/cashier-test-resources';
import { CashierPendingBoard } from './pending-board';

function pending(overrides: Partial<PendingOrderResponse> = {}): PendingOrderResponse {
  return {
    orderId: 900029,
    tableId: 2,
    tableNumber: 2,
    partySize: 2,
    deliveredAt: '2026-11-21T11:01:00',
    total: { amount: '126000.00', currency: 'COP' },
    paymentStatus: 'UNPAID',
    ...overrides,
  };
}

describe('CashierPendingBoard', () => {
  let fixture: ComponentFixture<CashierPendingBoard>;
  let component: CashierPendingBoard;
  let root: HTMLElement;

  beforeAll(async () => {
    await resolveCashierResources();
  });

  beforeEach(async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({ imports: [CashierPendingBoard] }).compileComponents();

    fixture = TestBed.createComponent(CashierPendingBoard);
    component = fixture.componentInstance;
    root = fixture.nativeElement as HTMLElement;
  });

  async function setup(overrides: Partial<CashierPendingBoard> = {}): Promise<void> {
    Object.assign(component, {
      orders: [pending()],
      date: '2026-11-21',
      total: 1,
      totalPages: 1,
      ...overrides,
    });
    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();
  }

  it('renders the table, order, amount and party size of a row', async () => {
    await setup();

    const row = root.querySelector<HTMLElement>('.pending-row');
    expect(row?.querySelector('.pending-row__table')?.textContent.trim()).toBe('Mesa 2');
    expect(row?.querySelector('.pending-row__order')?.textContent.trim()).toBe('Pedido #900029');
    expect(row?.querySelector('.pending-row__amount')?.textContent.trim()).toBe(
      new Money().transform({ amount: '126000.00', currency: 'COP' }),
    );
    expect(row?.textContent).toContain('2 pers.');
  });

  it('labels a previously voided order with text', async () => {
    await setup({ orders: [pending({ paymentStatus: 'VOIDED' })] });

    const badge = root.querySelector('.pending-row .rms-badge');
    expect(badge?.textContent.trim()).toBe('Anulada · re-cobrar');
  });

  it('marks the selected row with aria-pressed', async () => {
    await setup({ orders: [pending(), pending({ orderId: 900030 })], selectedOrderId: 900030 });

    const rows = root.querySelectorAll<HTMLButtonElement>('.pending-row');
    expect(rows[0].getAttribute('aria-pressed')).toBe('false');
    expect(rows[1].getAttribute('aria-pressed')).toBe('true');
  });

  it('emits the selected order', async () => {
    const spy = vi.fn();
    component.selectOrder.subscribe(spy);
    await setup({ orders: [pending(), pending({ orderId: 900030 })] });

    root.querySelectorAll<HTMLButtonElement>('.pending-row')[1].click();

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ orderId: 900030 }));
  });

  it('emits the trimmed search on Enter', async () => {
    const spy = vi.fn();
    component.searchChange.subscribe(spy);
    await setup();

    const input = root.querySelector<HTMLInputElement>('#cashier-search');
    if (input === null) throw new Error('search input not found');
    setInputValue(input, '  2  ');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(spy).toHaveBeenCalledWith('2');
  });

  it('clears the search and emits an empty value', async () => {
    const spy = vi.fn();
    component.searchChange.subscribe(spy);
    await setup();

    const input = root.querySelector<HTMLInputElement>('#cashier-search');
    if (input === null) throw new Error('search input not found');
    setInputValue(input, '3');
    fixture.detectChanges();
    buttonByText(root, 'Limpiar').click();

    expect(spy).toHaveBeenCalledWith('');
  });

  it('emits the selected date', async () => {
    const spy = vi.fn();
    component.dateChange.subscribe(spy);
    await setup();

    const date = root.querySelector<HTMLInputElement>('#cashier-date');
    if (date === null) throw new Error('date input not found');
    date.value = '2026-11-20';
    date.dispatchEvent(new Event('change'));

    expect(spy).toHaveBeenCalledWith('2026-11-20');
  });

  it('pagers forward and disables previous on the first page', async () => {
    const spy = vi.fn();
    component.pageChange.subscribe(spy);
    await setup({ page: 0, totalPages: 3 });

    const previous = root.querySelector<HTMLButtonElement>('[aria-label="Página anterior"]');
    const next = root.querySelector<HTMLButtonElement>('[aria-label="Página siguiente"]');
    expect(previous?.disabled).toBe(true);

    next?.click();
    expect(spy).toHaveBeenCalledWith(1);
  });

  it('shows skeletons while loading instead of the list', async () => {
    await setup({ loading: true, orders: [] });

    expect(root.querySelectorAll('.pending-row')).toHaveLength(0);
    expect(root.querySelector('[role="status"]')?.getAttribute('aria-label')).toBe(
      'Cargando cuentas por cobrar',
    );
  });

  it('shows the error with a retry action', async () => {
    const spy = vi.fn();
    component.refresh.subscribe(spy);
    await setup({ error: 'La API no responde', orders: [] });

    expect(root.querySelector('.rms-empty__title')?.textContent.trim()).toBe(
      'No se pudieron cargar las cuentas',
    );
    expect(root.querySelector('.rms-empty__message')?.textContent.trim()).toBe(
      'La API no responde',
    );
    buttonByText(root, 'Reintentar').click();
    expect(spy).toHaveBeenCalled();
  });

  it('explains an empty search result', async () => {
    await setup({ orders: [], search: '99', total: 0 });

    expect(root.querySelector('.rms-empty__title')?.textContent.trim()).toBe(
      'No hay cuentas por cobrar',
    );
    expect(root.querySelector('.rms-empty__message')?.textContent.trim()).toBe(
      'Ninguna mesa o pedido coincide con la búsqueda.',
    );
  });
});

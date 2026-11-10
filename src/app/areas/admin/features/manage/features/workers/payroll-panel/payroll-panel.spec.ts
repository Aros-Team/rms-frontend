/**
 * Tests for the admin payroll panel (`app-payroll-panel`).
 *
 * Feature: per-worker payroll view — period summary, registered events and
 * settlements, plus the create-event / settle flows.
 * Contract:
 *  - every monetary field arrives as `Money` (`{ amount: "1500000.00", currency: "COP" }`)
 *    and renders the formatted COP string — never `NaN`;
 *  - `LocalDate` fields (`eventDate`, `periodStart`, `periodEnd`) render as
 *    `dd/mm/aaaa` and `Instant` fields (`settledAt`) render as `dd/mm/aaaa HH:mm`;
 *  - activating the panel loads the events and settlements of the selected
 *    worker for the loaded period, and pressing "Cargar" reloads them for the
 *    newly selected period;
 *  - deleting an event calls the API and refreshes the events (and therefore the
 *    summary, which the backend recomputes);
 *  - "Calcular sugerido" prefills the unit rate from
 *    `PayrollCalculateResponse.suggestedUnitRate`, shows the hourly-rate ×
 *    multiplier basis, and that basis is dropped if the event type changes;
 *  - the settle modal shows the payroll's `pendingAmount` as the reference
 *    basis, recomputes the divergence live, blocks non-positive/non-finite
 *    amounts and any overpayment that was not explicitly acknowledged, rejects a
 *    settlement period outside the loaded payroll, and refreshes the basis on
 *    open instead of trusting the cache TTL;
 *  - the dialogs trap Tab, return focus on close and close on Escape even when
 *    focus sits in a PrimeNG overlay appended to `<body>`;
 *  - a failed load shows a readable message, not a raw `HttpErrorResponse`.
 *
 * Approach: mount `PayrollPanel` with stubbed `Payroll` / `Worker` services (the
 * real `PayrollCache` and `WorkersCache` sit on top of those stubs), assert the
 * exact rendered strings per table cell and the exact request payloads handed to
 * the API, and drive focus/Escape through real DOM events.
 */
import { HttpErrorResponse } from '@angular/common/http';
import { ɵresolveComponentResources as resolveComponentResources } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { ConfirmationService, MessageService } from 'primeng/api';

import { Logging } from '@app/core/services/logging/logging';
import { Payroll } from '@app/core/services/payroll/payroll';
import { PayrollCache } from '@app/core/services/payroll/payroll-cache';
import { Worker } from '@app/core/services/workers/worker';
import { WorkersCache } from '@areas/admin/features/manage/features/workers/workers-cache';
import type { Money as MoneyValue } from '@models/dto/common/money';
import type {
  PayrollCalculateResponse,
  PayrollEventResponse,
  PayrollResponse,
  PayrollSettlementResponse,
} from '@models/dto/payroll';
import type { WorkerResponse } from '@models/dto/workers/worker-response';

import { PayrollPanel } from './payroll-panel';
import payrollPanelHtml from './payroll-panel.html?raw';

const WORKER: WorkerResponse = {
  id: 7,
  document: '1094',
  name: 'Ana Pérez',
  email: 'ana@rms.co',
};

function money(amount: string): MoneyValue {
  return { amount, currency: 'COP' };
}

/** The payroll record of `WORKER` for the period the panel loads by default. */
function makePayroll(year: number, month: number, pending = '1150000.00'): PayrollResponse {
  return {
    id: 31,
    userId: 7,
    userName: 'Ana Pérez',
    year,
    month,
    periodStart: `${String(year)}-${String(month).padStart(2, '0')}-01`,
    periodEnd: `${String(year)}-${String(month).padStart(2, '0')}-30`,
    baseSalary: money('1500000.00'),
    bonuses: money('300000.00'),
    deductions: money('150000.00'),
    netAmount: money('1650000.00'),
    paidAmount: money('500000.00'),
    pendingAmount: money(pending),
    hoursWorked: 160,
    status: 'ACCRUED',
    notes: '',
    registeredBy: 1,
    createdAt: `${String(year)}-${String(month).padStart(2, '0')}-01T08:00:00`,
    updatedAt: `${String(year)}-${String(month).padStart(2, '0')}-02T08:00:00`,
  };
}

function makeEvent(overrides: Partial<PayrollEventResponse> = {}): PayrollEventResponse {
  return {
    id: 55,
    userId: 7,
    userName: 'Ana Pérez',
    eventDate: '2026-06-15',
    eventType: 'OVERTIME',
    quantity: 2,
    unitRate: money('18750.00'),
    amount: money('37500.00'),
    notes: 'Cierre de cocina',
    createdAt: '2026-06-15T22:00:00',
    createdBy: 1,
    ...overrides,
  };
}

function makeSettlement(
  overrides: Partial<PayrollSettlementResponse> = {},
): PayrollSettlementResponse {
  return {
    id: 91,
    payrollId: 31,
    userId: 7,
    userName: 'Ana Pérez',
    settlementType: 'BIWEEKLY',
    periodStart: '2026-06-01',
    periodEnd: '2026-06-15',
    amount: money('500000.00'),
    notes: 'Primera quincena',
    settledAt: '2026-06-15T18:00:00',
    settledBy: 1,
    ...overrides,
  };
}

function calculateResponse(): PayrollCalculateResponse {
  return {
    userId: 7,
    eventType: 'OVERTIME',
    hourlyRate: money('12500.00'),
    multiplier: 1.5,
    suggestedUnitRate: money('18750.00'),
    suggestedAmount: money('37500.00'),
  };
}

/** `Intl` separates the COP symbol from the amount with U+00A0. */
function normalize(text: string): string {
  return text.replace(/\u00a0|\u202f/g, ' ').replace(/\s+/g, ' ').trim();
}

function textOf(fixture: ComponentFixture<PayrollPanel>, testId: string): string {
  const node = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
    `[data-testid="${testId}"]`,
  );
  return normalize(node?.textContent ?? '');
}

function query(fixture: ComponentFixture<PayrollPanel>, testId: string): HTMLElement | null {
  return (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
    `[data-testid="${testId}"]`,
  );
}

describe('PayrollPanel', () => {
  let fixture: ComponentFixture<PayrollPanel>;
  let component: PayrollPanel;

  let payrollApi: {
    getAllPayrolls: ReturnType<typeof vi.fn>;
    getPayrollsByPeriod: ReturnType<typeof vi.fn>;
    getPayrollsByWorker: ReturnType<typeof vi.fn>;
    getPayrollByWorkerPeriod: ReturnType<typeof vi.fn>;
    createPayroll: ReturnType<typeof vi.fn>;
    updatePayroll: ReturnType<typeof vi.fn>;
    deletePayroll: ReturnType<typeof vi.fn>;
    createEvent: ReturnType<typeof vi.fn>;
    getEvents: ReturnType<typeof vi.fn>;
    deleteEvent: ReturnType<typeof vi.fn>;
    calculate: ReturnType<typeof vi.fn>;
    settle: ReturnType<typeof vi.fn>;
    getSettlements: ReturnType<typeof vi.fn>;
  };
  let confirm: ReturnType<typeof vi.fn>;

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const monthLabel = `${String(month).padStart(2, '0')}/${String(year)}`;

  beforeAll(async () => {
    await resolveComponentResources((url: string) => {
      if (url.endsWith('payroll-panel.html')) {
        return Promise.resolve(payrollPanelHtml as unknown as string);
      }
      return Promise.resolve('');
    });
  });

  beforeEach(() => {
    TestBed.resetTestingModule();

    payrollApi = {
      getAllPayrolls: vi.fn(() => of([])),
      getPayrollsByPeriod: vi.fn(() => of([])),
      getPayrollsByWorker: vi.fn(() => of([makePayroll(year, month)])),
      getPayrollByWorkerPeriod: vi.fn(() => of(makePayroll(year, month))),
      createPayroll: vi.fn(() => of(makePayroll(year, month))),
      updatePayroll: vi.fn(() => of(makePayroll(year, month))),
      deletePayroll: vi.fn(() => of(undefined)),
      createEvent: vi.fn(() => of(makeEvent())),
      getEvents: vi.fn(() => of([makeEvent()])),
      deleteEvent: vi.fn(() => of(undefined)),
      calculate: vi.fn(() => of(calculateResponse())),
      settle: vi.fn(() => of(makeSettlement())),
      getSettlements: vi.fn(() => of([makeSettlement()])),
    };
    confirm = vi.fn();

    TestBed.configureTestingModule({
      imports: [PayrollPanel],
      providers: [
        { provide: Payroll, useValue: payrollApi },
        { provide: Worker, useValue: { getWorkers: vi.fn(() => of([WORKER])) } },
        { provide: MessageService, useValue: { add: vi.fn() } },
        { provide: ConfirmationService, useValue: { confirm } },
        { provide: Logging, useValue: { debug: vi.fn(), error: vi.fn() } },
      ],
    });
  });

  async function mount(): Promise<void> {
    fixture = TestBed.createComponent(PayrollPanel);
    component = fixture.componentInstance;
    TestBed.inject(PayrollCache);
    TestBed.inject(WorkersCache);
    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();
  }

  it('renders the period summary as formatted COP strings from Money DTOs', async () => {
    await mount();

    expect(textOf(fixture, 'payroll-base')).toBe('$ 1.500.000');
    expect(textOf(fixture, 'payroll-bonuses')).toBe('$ 300.000');
    expect(textOf(fixture, 'payroll-deductions')).toBe('$ 150.000');
    expect(textOf(fixture, 'payroll-net')).toBe('$ 1.650.000');
    expect(textOf(fixture, 'payroll-paid')).toBe('$ 500.000');
    expect(textOf(fixture, 'payroll-pending')).toBe('$ 1.150.000');
    expect(textOf(fixture, 'payroll-pending')).not.toMatch(/NaN/);
  });

  it('flags the pending amount as unpaid in a status warning', async () => {
    await mount();

    expect(textOf(fixture, 'payroll-pending-warning')).toBe(
      'Pendiente por pagar: $ 1.150.000. Registra una liquidación para cerrar el periodo.',
    );
  });

  it('loads the events and settlements of the worker for the loaded period', async () => {
    await mount();

    expect(payrollApi.getEvents).toHaveBeenCalledWith(7, year, month);
    expect(payrollApi.getSettlements).toHaveBeenCalledWith(7, year, month);
    expect(textOf(fixture, 'events-count')).toBe('1 registrado(s)');
    expect(textOf(fixture, 'settlements-count')).toBe('1 registrada(s)');
    expect(textOf(fixture, 'event-amount')).toBe('$ 37.500');
    expect(textOf(fixture, 'settlement-amount')).toBe('$ 500.000');
  });

  it('renders each event cell with the Spanish type and the dd/mm/aaaa wire date', async () => {
    await mount();

    expect(query(fixture, 'event-row')).not.toBeNull();
    expect(textOf(fixture, 'event-date')).toBe('15/06/2026');
    expect(textOf(fixture, 'event-type')).toBe('Hora extra');
    expect(textOf(fixture, 'event-unit-rate')).toBe('$ 18.750');
    expect(textOf(fixture, 'event-amount')).toBe('$ 37.500');
    expect(textOf(fixture, 'event-notes')).toBe('Cierre de cocina');
  });

  it('renders the settlement "Fecha" column with the instant date and time', async () => {
    await mount();

    expect(textOf(fixture, 'settlement-date')).toBe('15/06/2026, 18:00');
    expect(textOf(fixture, 'settlement-type')).toBe('Quincenal');
    expect(textOf(fixture, 'settlement-period')).toBe('01/06/2026 – 15/06/2026');
    expect(textOf(fixture, 'settlement-amount')).toBe('$ 500.000');
    expect(textOf(fixture, 'settlement-notes')).toBe('Primera quincena');
  });

  it('reloads the events and settlements when the period changes and "Cargar" runs', async () => {
    await mount();
    expect(payrollApi.getEvents).toHaveBeenCalledTimes(1);

    component.selectedMonth.set(2);
    component.selectedYear.set(2025);
    component.applyPeriod();
    fixture.detectChanges();

    expect(payrollApi.getEvents).toHaveBeenLastCalledWith(7, 2025, 2);
    expect(payrollApi.getSettlements).toHaveBeenLastCalledWith(7, 2025, 2);
  });

  it('deletes an event and reloads the events (and therefore the summary)', async () => {
    await mount();
    const before = payrollApi.getEvents.mock.calls.length;
    // The confirmation stub accepts, i.e. the admin confirmed the deletion.
    confirm.mockImplementation((options: { accept?: () => void }) => options.accept?.());

    component.deleteEvent(makeEvent());
    fixture.detectChanges();

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(payrollApi.deleteEvent).toHaveBeenCalledWith(55);
    expect(payrollApi.getEvents.mock.calls.length).toBe(before + 1);
    expect(payrollApi.getPayrollsByWorker.mock.calls.length).toBeGreaterThan(1);
  });

  it('does not reload when the admin cancels the delete confirmation', async () => {
    await mount();
    const before = payrollApi.getEvents.mock.calls.length;

    component.deleteEvent(makeEvent());

    expect(payrollApi.deleteEvent).not.toHaveBeenCalled();
    expect(payrollApi.getEvents.mock.calls.length).toBe(before);
  });

  it('prefills the unit rate from the calculated suggestion and shows its basis', async () => {
    await mount();

    component.openEventModal();
    component.eventQuantity.set(2);
    component.eventDate.set(new Date(2026, 5, 15));
    component.calculateSuggested();
    fixture.detectChanges();

    expect(payrollApi.calculate).toHaveBeenCalledWith({
      userId: 7,
      eventType: 'OVERTIME',
      quantity: 2,
      eventDate: '2026-06-15',
    });
    expect(component.eventUnitRate()).toBe(18750);
    expect(textOf(fixture, 'calculate-basis')).toBe(
      'Base: $ 12.500/hora × 1.5 = $ 18.750 · Total $ 37.500',
    );
  });

  it('drops the calculated rate and basis when the event type changes afterwards', async () => {
    await mount();

    component.openEventModal();
    component.eventQuantity.set(2);
    component.eventDate.set(new Date(2026, 5, 15));
    component.calculateSuggested();
    fixture.detectChanges();
    expect(component.eventUnitRate()).toBe(18750);

    component.onEventTypeChange('NIGHT_SURCHARGE');
    fixture.detectChanges();

    expect(component.eventType()).toBe('NIGHT_SURCHARGE');
    expect(component.eventUnitRate()).toBeNull();
    expect(query(fixture, 'calculate-basis')).toBeNull();

    component.createEvent();
    fixture.detectChanges();

    expect(payrollApi.createEvent).not.toHaveBeenCalled();
    expect(textOf(fixture, 'event-error')).toBe(
      'Completa el valor unitario del evento (o usa "Calcular sugerido").',
    );
  });

  it('sends the created event with quantity, unit rate as Money and notes', async () => {
    await mount();

    component.openEventModal();
    component.onEventTypeChange('NIGHT_SURCHARGE');
    component.eventQuantity.set(4);
    component.eventDate.set(new Date(2026, 5, 18));
    component.eventUnitRate.set(21000);
    component.eventNotes.set('  Turno noche  ');
    const before = payrollApi.getEvents.mock.calls.length;
    component.createEvent();
    fixture.detectChanges();

    expect(payrollApi.createEvent).toHaveBeenCalledWith({
      userId: 7,
      eventDate: '2026-06-18',
      eventType: 'NIGHT_SURCHARGE',
      quantity: 4,
      unitRate: { amount: '21000.00', currency: 'COP' },
      notes: 'Turno noche',
    });
    expect(component.eventModalVisible()).toBe(false);
    expect(payrollApi.getEvents.mock.calls.length).toBe(before + 1);
  });

  it('keeps the modal open and shows the mapped error when the event is rejected', async () => {
    payrollApi.createEvent.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 400 })),
    );
    await mount();

    component.openEventModal();
    component.eventQuantity.set(2);
    component.eventDate.set(new Date(2026, 5, 15));
    component.eventUnitRate.set(18750);
    component.createEvent();
    fixture.detectChanges();

    expect(component.eventModalVisible()).toBe(true);
    expect(textOf(fixture, 'event-error')).toBe(
      'Datos de nómina inválidos: revisa la cantidad, el valor unitario y las fechas',
    );
  });

  it('prefills the settle amount with the pending amount of the payroll', async () => {
    await mount();

    component.openSettleModal();

    expect(component.settleAmount()).toBe(1150000);
    expect(component.settlementType()).toBe('MONTHLY');
    expect(component.settlePeriodStart()).toEqual(new Date(year, month - 1, 1));
    expect(component.settlePeriodEnd()).toEqual(new Date(year, month - 1, 30));
  });

  it('shows the pending amount next to the input and reports a matching amount', async () => {
    await mount();

    component.openSettleModal();
    fixture.detectChanges();

    expect(textOf(fixture, 'settle-pending-basis')).toBe('Pendiente del periodo: $ 1.150.000');
    expect(textOf(fixture, 'settle-divergence')).toBe(
      'El monto coincide con el pendiente del periodo.',
    );
  });

  it('refreshes the pending basis when the settle modal opens', async () => {
    // First read (mount) still returns the cached pending; the read triggered by
    // opening the dialog returns the value another admin's settlement left.
    payrollApi.getPayrollsByWorker.mockImplementationOnce(() => of([makePayroll(year, month)]));
    payrollApi.getPayrollsByWorker.mockImplementation(() =>
      of([makePayroll(year, month, '900000.00')]),
    );
    await mount();
    expect(textOf(fixture, 'payroll-pending')).toBe('$ 1.150.000');

    component.openSettleModal();
    fixture.detectChanges();

    expect(textOf(fixture, 'settle-pending-basis')).toBe('Pendiente del periodo: $ 900.000');
    expect(component.settleAmount()).toBe(900000);
  });

  it('submits the settlement with the pending amount as Money', async () => {
    await mount();

    component.openSettleModal();
    component.settlementType.set('WEEKLY');
    component.settleNotes.set('Pago semanal');
    component.settle();
    fixture.detectChanges();

    expect(payrollApi.settle).toHaveBeenCalledWith({
      userId: 7,
      year,
      month,
      settlementType: 'WEEKLY',
      periodStart: `${String(year)}-${String(month).padStart(2, '0')}-01`,
      periodEnd: `${String(year)}-${String(month).padStart(2, '0')}-30`,
      amount: { amount: '1150000.00', currency: 'COP' },
      notes: 'Pago semanal',
    });
    expect(component.settleModalVisible()).toBe(false);
    expect(payrollApi.getSettlements.mock.calls.length).toBeGreaterThan(1);
  });

  it('warns about an underpayment but still submits it', async () => {
    await mount();

    component.openSettleModal();
    component.onSettleAmountChange(100000);
    fixture.detectChanges();

    expect(textOf(fixture, 'settle-divergence')).toBe(
      'El monto es menor que el pendiente por $ 1.050.000.',
    );

    component.settle();
    fixture.detectChanges();

    expect(payrollApi.settle).toHaveBeenCalledWith(
      expect.objectContaining({ amount: { amount: '100000.00', currency: 'COP' } }),
    );
  });

  it('blocks an overpayment until the difference is acknowledged', async () => {
    await mount();

    component.openSettleModal();
    component.onSettleAmountChange(1200000);
    fixture.detectChanges();

    expect(textOf(fixture, 'settle-divergence')).toBe(
      'El monto supera el pendiente por $ 50.000.',
    );

    component.settle();
    fixture.detectChanges();

    expect(payrollApi.settle).not.toHaveBeenCalled();
    expect(textOf(fixture, 'settle-error')).toBe(
      'El monto supera el pendiente del periodo. Confirma la diferencia para continuar.',
    );

    component.settleOverpaymentAcknowledged.set(true);
    component.settle();
    fixture.detectChanges();

    expect(payrollApi.settle).toHaveBeenCalledWith(
      expect.objectContaining({ amount: { amount: '1200000.00', currency: 'COP' } }),
    );
  });

  it('refuses to settle a zero amount', async () => {
    await mount();

    component.openSettleModal();
    component.onSettleAmountChange(0);
    component.settle();
    fixture.detectChanges();

    expect(payrollApi.settle).not.toHaveBeenCalled();
    expect(textOf(fixture, 'settle-error')).toBe('Indica un monto mayor a cero para liquidar.');
  });

  it('refuses to settle a negative amount', async () => {
    await mount();

    component.openSettleModal();
    component.onSettleAmountChange(-50000);
    component.settle();
    fixture.detectChanges();

    expect(payrollApi.settle).not.toHaveBeenCalled();
    expect(textOf(fixture, 'settle-error')).toBe('Indica un monto mayor a cero para liquidar.');
  });

  it('refuses to settle a non-finite amount', async () => {
    await mount();

    component.openSettleModal();
    component.onSettleAmountChange(Number.NaN);
    fixture.detectChanges();
    expect(textOf(fixture, 'settle-divergence')).toBe('Indica un monto mayor a cero.');

    component.settle();
    fixture.detectChanges();

    expect(payrollApi.settle).not.toHaveBeenCalled();
    expect(textOf(fixture, 'settle-error')).toBe('Indica un monto mayor a cero para liquidar.');
  });

  it('refuses a settlement period that starts after it ends', async () => {
    await mount();

    component.openSettleModal();
    component.settlePeriodStart.set(new Date(year, month - 1, 20));
    component.settlePeriodEnd.set(new Date(year, month - 1, 5));
    component.settle();
    fixture.detectChanges();

    expect(payrollApi.settle).not.toHaveBeenCalled();
    expect(textOf(fixture, 'settle-error')).toBe(
      'La fecha de fin del periodo no puede ser anterior a la de inicio.',
    );
  });

  it('refuses a settlement period outside the loaded payroll', async () => {
    await mount();

    component.openSettleModal();
    component.settlePeriodStart.set(new Date(year, month - 2, 1));
    component.settlePeriodEnd.set(new Date(year, month - 2, 28));
    component.settle();
    fixture.detectChanges();

    expect(payrollApi.settle).not.toHaveBeenCalled();
    expect(textOf(fixture, 'settle-error')).toBe(
      `El periodo liquidado debe estar dentro de la nómina cargada (${monthLabel}).`,
    );
  });

  it('traps Tab inside the open dialog', async () => {
    await mount();

    component.openSettleModal();
    fixture.detectChanges();

    const dialog = query(fixture, 'settle-dialog');
    if (dialog === null) throw new Error('Settle dialog not rendered');
    const focusables = Array.from(
      dialog.querySelectorAll<HTMLElement>('button:not([disabled]), input'),
    );
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    expect(first).toBeDefined();

    last.focus();
    last.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));

    // Tab on the last focusable wraps inside the dialog instead of escaping it.
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).not.toBe(last);
  });

  it('closes the dialog on Escape even when focus is in an overlay appended to body', async () => {
    await mount();

    component.openSettleModal();
    fixture.detectChanges();

    // A PrimeNG select/datepicker panel lives in `<body>`, outside the dialog.
    const overlay = document.createElement('button');
    document.body.appendChild(overlay);
    overlay.focus();

    overlay.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(component.settleModalVisible()).toBe(false);
    overlay.remove();
  });

  it('returns focus to the trigger when the dialog is cancelled', async () => {
    await mount();

    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();

    component.openSettleModal();
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(document.activeElement).toBe(query(fixture, 'settle-dialog'));

    component.closeSettleModal();

    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });

  it('shows a readable message when the events cannot be loaded', async () => {
    payrollApi.getEvents.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 500, statusText: 'Server Error' })),
    );
    await mount();

    expect(textOf(fixture, 'payroll-load-error')).toBe(
      'No se pudieron cargar los datos de nómina.',
    );
  });

  it('renders an empty state with a call to action when there are no events', async () => {
    payrollApi.getEvents.mockReturnValue(of([]));
    await mount();

    expect(textOf(fixture, 'events-count')).toBe('0 registrado(s)');
    expect(textOf(fixture, 'events-empty-title')).toBe(
      'No hay eventos registrados en este periodo.',
    );
  });

  it('maps every event type to its Spanish label and tag severity', async () => {
    await mount();

    expect(component.eventLabel('OVERTIME')).toBe('Hora extra');
    expect(component.eventLabel('DEDUCTION')).toBe('Deducción');
    expect(component.eventSeverity('ABSENCE')).toBe('danger');
    expect(component.eventSeverity('OVERTIME')).toBe('info');
    expect(component.eventSeverity('BONUS_ATTENDANCE')).toBe('success');
  });
});

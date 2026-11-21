/**
 * Tests for the workers management screen (`app-workers`) tab navigation.
 *
 * Feature: three-tab layout — "Empleados", "Registros de Ingreso" and the new
 * "Nómina" tab that hosts `app-payroll-panel`.
 * Contract:
 *  - the tablist exposes exactly three tabs, only one of them selected;
 *  - the payroll tab is NOT mounted — and therefore makes no payroll request —
 *    until the admin activates it (lazy load on first activation);
 *  - activating it mounts `app-payroll-panel`, which immediately loads the
 *    events and settlements of the first employee for the current period;
 *  - switching back to "Empleados" leaves the payroll tab unmounted;
 *  - the pre-existing "Registros de Ingreso" tab still requests the time logs
 *    when activated (the regression site of the rewritten `switchTab`).
 *
 * Approach: mount `Workers` with stubbed `Worker` / `Area` / `Payroll` services,
 * drive the tab through `switchTab()` (the same entry point the tab buttons and
 * their Enter/Space handlers use), and assert `aria-selected` plus the presence
 * of the panel in the DOM and the payroll requests it issues.
 */
import { ɵresolveComponentResources as resolveComponentResources } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { ConfirmationService, MessageService } from 'primeng/api';

import { Area } from '@app/core/services/areas/area';
import { Logging } from '@app/core/services/logging/logging';
import { Payroll } from '@app/core/services/payroll/payroll';
import { TimeLog } from '@app/core/services/schedules/time-log';
import { Schedule } from '@app/core/services/schedules/schedule';
import { ScheduleAssignment } from '@app/core/services/schedules/schedule-assignment';
import { Worker } from '@app/core/services/workers/worker';
import type { PayrollEventResponse, PayrollResponse } from '@models/dto/payroll';
import type { WorkerResponse } from '@models/dto/workers/worker-response';

import { Workers } from './workers';
import workersHtml from './workers.html?raw';

const WORKER: WorkerResponse = {
  id: 7,
  document: '1094',
  name: 'Ana Pérez',
  email: 'ana@rms.co',
};

function money(amount: string): { amount: string; currency: string } {
  return { amount, currency: 'COP' };
}

function makePayroll(year: number, month: number): PayrollResponse {
  return {
    id: 31,
    userId: 7,
    userName: 'Ana Pérez',
    year,
    month,
    periodStart: `${String(year)}-${String(month).padStart(2, '0')}-01`,
    periodEnd: `${String(year)}-${String(month).padStart(2, '0')}-30`,
    baseSalary: money('1500000.00'),
    bonuses: money('0.00'),
    deductions: money('0.00'),
    netAmount: money('1500000.00'),
    paidAmount: money('0.00'),
    pendingAmount: money('1500000.00'),
    hoursWorked: 160,
    status: 'ACCRUED',
    notes: '',
    registeredBy: 1,
    createdAt: '2026-06-01T08:00:00',
    updatedAt: '2026-06-02T08:00:00',
  };
}

function makeEvent(): PayrollEventResponse {
  return {
    id: 55,
    userId: 7,
    eventDate: '2026-06-15',
    eventType: 'OVERTIME',
    quantity: 2,
    unitRate: money('18750.00'),
    amount: money('37500.00'),
    notes: '',
    createdAt: '2026-06-15T22:00:00',
    createdBy: 'system',
  };
}

describe('Workers — payroll tab', () => {
  let fixture: ComponentFixture<Workers>;
  let component: Workers;
  let payrollApi: Record<string, ReturnType<typeof vi.fn>>;
  let timeLogApi: { getTimeLogs: ReturnType<typeof vi.fn> };
  let workerApi: {
    getWorkers: ReturnType<typeof vi.fn>;
    createWorker: ReturnType<typeof vi.fn>;
  };

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  beforeAll(async () => {
    // jsdom has no IntersectionObserver; the `appLazyLoad` directive needs one.
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(_callback: unknown, _options?: unknown) {
          void _callback;
          void _options;
        }
        observe(): void {
          /* the lazy-load directive only needs a non-throwing observer in jsdom */
        }
        unobserve(): void {
          /* no-op */
        }
        disconnect(): void {
          /* no-op */
        }
        takeRecords(): [] {
          return [];
        }
      },
    );

    await resolveComponentResources((url: string) => {
      if (url.endsWith('workers.html')) {
        return Promise.resolve(workersHtml as unknown as string);
      }
      return Promise.resolve('');
    });
  });

  beforeEach(() => {
    TestBed.resetTestingModule();

    timeLogApi = { getTimeLogs: vi.fn(() => of([])) };

    workerApi = {
      getWorkers: vi.fn(() => of([WORKER])),
      createWorker: vi.fn(() => of({ ...WORKER, password: null })),
    };

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
      calculate: vi.fn(() =>
        of({
          userId: 7,
          eventType: 'OVERTIME',
          hourlyRate: money('12500.00'),
          multiplier: 1.5,
          suggestedUnitRate: money('18750.00'),
          suggestedAmount: money('37500.00'),
        }),
      ),
      settle: vi.fn(() => of(undefined)),
      getSettlements: vi.fn(() => of([])),
    };

    TestBed.configureTestingModule({
      imports: [Workers],
      providers: [
        { provide: Worker, useValue: workerApi },
        { provide: Area, useValue: { getAreas: vi.fn(() => of([])) } },
        { provide: Payroll, useValue: payrollApi },
        { provide: TimeLog, useValue: timeLogApi },
        { provide: Schedule, useValue: { getAll: vi.fn(() => of([])) } },
        {
          provide: ScheduleAssignment,
          useValue: { getAssignments: vi.fn(() => of([])) },
        },
        { provide: MessageService, useValue: { add: vi.fn() } },
        ConfirmationService,
        { provide: Logging, useValue: { debug: vi.fn(), error: vi.fn() } },
      ],
    });
  });

  async function mount(): Promise<void> {
    fixture = TestBed.createComponent(Workers);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();
  }

  function tab(selector: string): HTMLButtonElement {
    const node = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(selector);
    if (node === null) throw new Error(`Tab ${selector} not found`);
    return node;
  }

  function panel(): HTMLElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('app-payroll-panel');
  }

  it('exposes three tabs and selects "Empleados" by default', async () => {
    await mount();

    const tabs = (fixture.nativeElement as HTMLElement).querySelectorAll('[role="tab"]');
    expect(tabs.length).toBe(3);
    expect(tab('#tab-empleados').getAttribute('aria-selected')).toBe('true');
    expect(tab('#tab-time-logs').getAttribute('aria-selected')).toBe('false');
    expect(tab('#tab-payroll').getAttribute('aria-selected')).toBe('false');
    expect(tab('#tab-payroll').textContent.trim()).toBe('Nómina');
  });

  it('does not mount the payroll panel nor request payroll data before activation', async () => {
    await mount();

    expect(panel()).toBeNull();
    expect(payrollApi['getEvents']).not.toHaveBeenCalled();
    expect(payrollApi['getSettlements']).not.toHaveBeenCalled();
  });

  it('mounts the panel and loads its data on first activation of the "Nómina" tab', async () => {
    await mount();

    component.switchTab('payroll');
    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();

    expect(tab('#tab-payroll').getAttribute('aria-selected')).toBe('true');
    expect(panel()).not.toBeNull();
    expect(payrollApi['getEvents']).toHaveBeenCalledWith(7, year, month);
    expect(payrollApi['getSettlements']).toHaveBeenCalledWith(7, year, month);
  });

  it('unmounts the panel when switching back to "Empleados"', async () => {
    await mount();

    component.switchTab('payroll');
    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();
    expect(panel()).not.toBeNull();

    component.switchTab('list');
    fixture.detectChanges();

    expect(panel()).toBeNull();
    expect(tab('#tab-empleados').getAttribute('aria-selected')).toBe('true');
    expect(tab('#tab-payroll').getAttribute('aria-selected')).toBe('false');
  });

  it('activates the payroll tab from its click handler', async () => {
    await mount();

    tab('#tab-payroll').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();

    expect(component.activeEmployeeTab()).toBe('payroll');
    expect(panel()).not.toBeNull();
  });

  it('still requests the time logs when the existing "Registros de Ingreso" tab is activated', async () => {
    await mount();
    expect(timeLogApi.getTimeLogs).not.toHaveBeenCalled();

    component.switchTab('time-logs');
    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();

    expect(timeLogApi.getTimeLogs).toHaveBeenCalledTimes(1);
    expect(tab('#tab-time-logs').getAttribute('aria-selected')).toBe('true');
  });
  describe('RFC 7807 error mapping', () => {
    it('surfaces the problem `detail` on the matching form field', async () => {
      await mount();
      workerApi.createWorker.mockReturnValue(
        throwError(
          () =>
            new HttpErrorResponse({
              status: 400,
              error: {
                detail: 'document: Document must contain only digits',
                status: 400,
                title: 'Bad Request',
              },
            }),
        ),
      );

      component.showCreationModal();
      component.userForm.patchValue({
        document: '123',
        name: 'Ana Perez',
        email: 'ana@rms.co',
        phone: '3001234567',
        areaId: 1,
      });
      component.createWorker();

      // Read through the component's public accessor, as the template does.
      expect(component.getBackendError('document')).toBe(
        'Document must contain only digits',
      );
    });
  });

  describe('salary field — Money DTO on the wire, number in the form', () => {
    it('normalizes a Money salary into the numeric form control', async () => {
      await mount();
      component.showModificationModal({ ...WORKER, salary: money('1200000.00') });

      expect(component.userForm.get('salary')?.value).toBe(1200000);
      expect(component.originalSalary()).toBe(1200000);
      expect(component.salaryValue()).toBe(1200000);
      expect(component.salaryChanged()).toBe(false);
    });

    it('leaves the salary null when the worker has none and reports no change', async () => {
      await mount();
      component.showModificationModal({ ...WORKER, salary: null });

      expect(component.userForm.get('salary')?.value).toBeNull();
      expect(component.originalSalary()).toBeNull();
      expect(component.salaryChanged()).toBe(false);
      expect(Number.isNaN(Number(component.userForm.get('salary')?.value))).toBe(false);
    });

    it('flags a change when the admin types a different salary', async () => {
      await mount();
      component.showModificationModal({ ...WORKER, salary: money('1200000.00') });

      component.userForm.get('salary')?.setValue(1500000);

      expect(component.salaryChanged()).toBe(true);
    });
  });
});

/**
 * Tests for the Payroll HTTP service.
 *
 * Feature: HTTP client for the payroll API — payroll records, payroll events
 * (overtime / night surcharge / absence / bonuses) and settlements.
 * Contract:
 *  - one method per documented endpoint, hitting the exact URL and verb:
 *    `v1/payroll`, `v1/payroll/{year}/{month}`, `v1/payroll/worker/{userId}`,
 *    `v1/payroll/worker/{userId}/{year}/{month}`, `v1/payroll/{id}` (PATCH/DELETE),
 *    `v1/payroll/events`, `v1/payroll/events/{userId}/{year}/{month}`,
 *    `v1/payroll/events/{id}` (DELETE), `v1/payroll/events/calculate`,
 *    `v1/payroll/settle`, `v1/payroll/settlements/{userId}/{year}/{month}`
 *  - request bodies are sent verbatim (no `{ data: ... }` envelope is added
 *    client-side; the interceptor owns that) and responses are typed without
 *    the envelope;
 *  - responses are passed through untouched: `Money.amount` stays the decimal
 *    string the backend sent, never coerced to a number;
 *  - `204 No Content` deletes emit `undefined`.
 *
 * Approach: `HttpTestingController` intercepts every call; each test asserts
 * the method, the exact URL, the exact body/response contract, and flushes a
 * wire-shaped payload. `httpMock.verify()` in `afterEach` fails the suite on any
 * unasserted request.
 */
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { Payroll } from './payroll';

import { Money } from '@models/dto/common/money';
import { PayrollRequest } from '@models/dto/payroll/payroll-request';
import { PayrollResponse } from '@models/dto/payroll/payroll-response';
import { PayrollEventRequest } from '@models/dto/payroll/payroll-event-request';
import { PayrollEventResponse } from '@models/dto/payroll/payroll-event-response';
import { PayrollCalculateRequest } from '@models/dto/payroll/payroll-calculate-request';
import { PayrollCalculateResponse } from '@models/dto/payroll/payroll-calculate-response';
import { PayrollSettlementRequest } from '@models/dto/payroll/payroll-settlement-request';
import { PayrollSettlementResponse } from '@models/dto/payroll/payroll-settlement-response';

/**
 * Builds a wire-shaped money DTO.
 *
 * The backend sends `amount` as a decimal string (`"125000000.00"`). The shared
 * `Money` interface is being migrated in another lane, so the cast keeps this
 * spec faithful to the wire without pinning the shared type either way.
 */
function moneyDto(amount: string): Money {
  return { amount, currency: 'COP' } as unknown as Money;
}

const payrollRequest: PayrollRequest = {
  userId: 7,
  year: 2026,
  month: 6,
  periodStart: '2026-06-01',
  periodEnd: '2026-06-30',
  baseSalary: 3000000,
  hoursWorked: 192,
};

const payrollResponse: PayrollResponse = {
  id: 11,
  userId: 7,
  userName: 'Juan Pérez',
  year: 2026,
  month: 6,
  periodStart: '2026-06-01',
  periodEnd: '2026-06-30',
  baseSalary: moneyDto('3000000.00'),
  bonuses: moneyDto('150000.00'),
  deductions: moneyDto('0.00'),
  netAmount: moneyDto('3150000.00'),
  paidAmount: moneyDto('1000000.00'),
  pendingAmount: moneyDto('2150000.00'),
  hoursWorked: 192,
  status: 'ACCRUED',
  notes: 'Junio',
  registeredBy: 1,
  createdAt: '2026-06-01T08:00:00Z',
  updatedAt: '2026-06-15T08:00:00Z',
};

const eventRequest: PayrollEventRequest = {
  userId: 7,
  eventDate: '2026-06-15',
  eventType: 'OVERTIME',
  quantity: 2,
  unitRate: 23437.5,
  notes: 'Cierre de mes',
};

const eventResponse: PayrollEventResponse = {
  id: 31,
  userId: 7,
  eventDate: '2026-06-15',
  eventType: 'OVERTIME',
  quantity: 2,
  unitRate: moneyDto('23437.50'),
  amount: moneyDto('46875.00'),
  notes: 'Cierre de mes',
  createdAt: '2026-06-15T20:00:00Z',
  createdBy: 'system',
};

const calculateRequest: PayrollCalculateRequest = {
  userId: 7,
  eventType: 'NIGHT_SURCHARGE',
  quantity: 4,
};

const calculateResponse: PayrollCalculateResponse = {
  userId: 7,
  eventType: 'NIGHT_SURCHARGE',
  hourlyRate: moneyDto('15625.00'),
  multiplier: 1.75,
  suggestedUnitRate: moneyDto('27343.75'),
  suggestedAmount: moneyDto('109375.00'),
};

const settlementRequest: PayrollSettlementRequest = {
  payrollId: 11,
  userId: 7,
  settlementType: 'WEEKLY',
  periodStart: '2026-06-01',
  periodEnd: '2026-06-07',
  amount: 1000000,
  notes: 'Primera semana',
};

const settlementResponse: PayrollSettlementResponse = {
  id: 51,
  payrollId: 11,
  userId: 7,
  settlementType: 'WEEKLY',
  periodStart: '2026-06-01',
  periodEnd: '2026-06-07',
  amount: moneyDto('1000000.00'),
  notes: 'Primera semana',
  settledAt: '2026-06-08T10:00:00Z',
  settledBy: 'system',
};

describe('Payroll service', () => {
  let service: Payroll;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(Payroll);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    TestBed.resetTestingModule();
  });

  describe('payroll records', () => {
    it('getAllPayrolls issues GET v1/payroll and emits every record', () => {
      let emitted: PayrollResponse[] | undefined;
      service.getAllPayrolls().subscribe((value) => (emitted = value));

      const req = httpMock.expectOne('v1/payroll');
      expect(req.request.method).toBe('GET');
      expect(req.request.body).toBeNull();

      req.flush([payrollResponse]);

      expect(emitted).toEqual([payrollResponse]);
    });

    it('getPayrollsByPeriod issues GET v1/payroll/{year}/{month}', () => {
      let emitted: PayrollResponse[] | undefined;
      service.getPayrollsByPeriod(2026, 6).subscribe((value) => (emitted = value));

      const req = httpMock.expectOne('v1/payroll/2026/6');
      expect(req.request.method).toBe('GET');

      req.flush([payrollResponse]);

      expect(emitted).toEqual([payrollResponse]);
    });

    it('getPayrollsByWorker issues GET v1/payroll/worker/{userId}', () => {
      let emitted: PayrollResponse[] | undefined;
      service.getPayrollsByWorker(7).subscribe((value) => (emitted = value));

      const req = httpMock.expectOne('v1/payroll/worker/7');
      expect(req.request.method).toBe('GET');

      req.flush([payrollResponse]);

      expect(emitted).toEqual([payrollResponse]);
    });

    it('getPayrollByWorkerPeriod issues GET v1/payroll/worker/{userId}/{year}/{month}', () => {
      let emitted: PayrollResponse | undefined;
      service.getPayrollByWorkerPeriod(7, 2026, 6).subscribe((value) => (emitted = value));

      const req = httpMock.expectOne('v1/payroll/worker/7/2026/6');
      expect(req.request.method).toBe('GET');

      req.flush(payrollResponse);

      expect(emitted).toEqual(payrollResponse);
    });

    it('createPayroll posts the request body verbatim to v1/payroll', () => {
      let emitted: PayrollResponse | undefined;
      service.createPayroll(payrollRequest).subscribe((value) => (emitted = value));

      const req = httpMock.expectOne('v1/payroll');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(payrollRequest);

      req.flush(payrollResponse);

      expect(emitted).toEqual(payrollResponse);
    });

    it('updatePayroll PATCHes v1/payroll/{id} with only the changed fields', () => {
      let emitted: PayrollResponse | undefined;
      service.updatePayroll(11, { status: 'PAID' }).subscribe((value) => (emitted = value));

      const req = httpMock.expectOne('v1/payroll/11');
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ status: 'PAID' });

      req.flush({ ...payrollResponse, status: 'PAID' });

      expect(emitted?.status).toBe('PAID');
    });

    it('deletePayroll DELETEs v1/payroll/{id} and emits undefined on 204', () => {
      let emitted: unknown = 'not-emitted';
      let completed = false;
      service.deletePayroll(11).subscribe({
        next: (value) => (emitted = value),
        complete: () => (completed = true),
      });

      const req = httpMock.expectOne('v1/payroll/11');
      expect(req.request.method).toBe('DELETE');

      req.flush(null, { status: 204, statusText: 'No Content' });

      expect(emitted).toBeUndefined();
      expect(completed).toBe(true);
    });
  });

  describe('payroll events', () => {
    it('createEvent posts the request body verbatim to v1/payroll/events', () => {
      let emitted: PayrollEventResponse | undefined;
      service.createEvent(eventRequest).subscribe((value) => (emitted = value));

      const req = httpMock.expectOne('v1/payroll/events');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(eventRequest);
      // The amount is backend-computed: the client must never send it.
      expect(req.request.body).not.toHaveProperty('amount');

      req.flush(eventResponse);

      expect(emitted).toEqual(eventResponse);
    });

    it('getEvents issues GET v1/payroll/events/{userId}/{year}/{month}', () => {
      let emitted: PayrollEventResponse[] | undefined;
      service.getEvents(7, 2026, 6).subscribe((value) => (emitted = value));

      const req = httpMock.expectOne('v1/payroll/events/7/2026/6');
      expect(req.request.method).toBe('GET');

      req.flush([eventResponse]);

      expect(emitted).toEqual([eventResponse]);
    });

    it('deleteEvent DELETEs v1/payroll/events/{id} and emits undefined on 204', () => {
      let emitted: unknown = 'not-emitted';
      service.deleteEvent(31).subscribe((value) => (emitted = value));

      const req = httpMock.expectOne('v1/payroll/events/31');
      expect(req.request.method).toBe('DELETE');

      req.flush(null, { status: 204, statusText: 'No Content' });

      expect(emitted).toBeUndefined();
    });

    it('calculate posts the request body verbatim to v1/payroll/events/calculate', () => {
      let emitted: PayrollCalculateResponse | undefined;
      service.calculate(calculateRequest).subscribe((value) => (emitted = value));

      const req = httpMock.expectOne('v1/payroll/events/calculate');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(calculateRequest);

      req.flush(calculateResponse);

      expect(emitted).toEqual(calculateResponse);
    });
  });

  describe('settlements', () => {
    it('settle posts the request body verbatim to v1/payroll/settle', () => {
      let emitted: PayrollSettlementResponse | undefined;
      service.settle(settlementRequest).subscribe((value) => (emitted = value));

      const req = httpMock.expectOne('v1/payroll/settle');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(settlementRequest);

      req.flush(settlementResponse);

      expect(emitted).toEqual(settlementResponse);
    });

    it('getSettlements issues GET v1/payroll/settlements/{userId}/{year}/{month}', () => {
      let emitted: PayrollSettlementResponse[] | undefined;
      service.getSettlements(7, 2026, 6).subscribe((value) => (emitted = value));

      const req = httpMock.expectOne('v1/payroll/settlements/7/2026/6');
      expect(req.request.method).toBe('GET');

      req.flush([settlementResponse]);

      expect(emitted).toEqual([settlementResponse]);
    });
  });

  describe('wire contract', () => {
    it('keeps Money.amount as the decimal string the backend sent', () => {
      let emitted: PayrollResponse | undefined;
      service.getPayrollByWorkerPeriod(7, 2026, 6).subscribe((value) => (emitted = value));

      httpMock.expectOne('v1/payroll/worker/7/2026/6').flush(payrollResponse);

      // A `moneyDto` fixture carries `"3000000.00"`; coercion to 3000000 would
      // silently corrupt every sum downstream.
      expect(emitted?.baseSalary.amount).toBe('3000000.00');
      expect(emitted?.pendingAmount.amount).toBe('2150000.00');
      expect(emitted?.baseSalary.currency).toBe('COP');
    });

    it('does not unwrap or re-shape the response body', () => {
      let emitted: PayrollEventResponse[] | undefined;
      service.getEvents(7, 2026, 6).subscribe((value) => (emitted = value));

      httpMock.expectOne('v1/payroll/events/7/2026/6').flush([eventResponse]);

      // The envelope interceptor owns unwrapping; the service must hand over
      // the bare payload it received.
      expect(emitted).toHaveLength(1);
      expect(emitted?.[0].id).toBe(31);
      expect(emitted?.[0].eventType).toBe('OVERTIME');
    });
  });

  describe('error paths', () => {
    it('propagates a server error and emits nothing', () => {
      let emitted: PayrollResponse[] | undefined;
      let received: unknown;
      service.getAllPayrolls().subscribe({
        next: (value) => (emitted = value),
        error: (err: unknown) => (received = err),
      });

      httpMock
        .expectOne('v1/payroll')
        .flush({ detail: 'boom' }, { status: 500, statusText: 'Server Error' });

      expect(emitted).toBeUndefined();
      expect((received as { status: number }).status).toBe(500);
    });

    it('propagates a 404 on a missing worker payroll', () => {
      let received: unknown;
      service.getPayrollByWorkerPeriod(999, 2026, 6).subscribe({
        error: (err: unknown) => (received = err),
      });

      httpMock
        .expectOne('v1/payroll/worker/999/2026/6')
        .flush(null, { status: 404, statusText: 'Not Found' });

      expect((received as { status: number }).status).toBe(404);
    });
  });
});

import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { PayrollRequest } from '@models/dto/payroll/payroll-request';
import { PayrollUpdateRequest } from '@models/dto/payroll/payroll-update-request';
import { PayrollResponse } from '@models/dto/payroll/payroll-response';
import { PayrollEventRequest } from '@models/dto/payroll/payroll-event-request';
import { PayrollEventResponse } from '@models/dto/payroll/payroll-event-response';
import { PayrollCalculateRequest } from '@models/dto/payroll/payroll-calculate-request';
import { PayrollCalculateResponse } from '@models/dto/payroll/payroll-calculate-response';
import { PayrollSettlementRequest } from '@models/dto/payroll/payroll-settlement-request';
import { PayrollSettlementResponse } from '@models/dto/payroll/payroll-settlement-response';

/**
 * HTTP client for the payroll API (`/api/v1/payroll*`).
 *
 * Conventions that matter when reading this file:
 *  - URLs are relative — `'v1/payroll/...'` — because the app-wide base URL and the
 *    `{ data: ... }` envelope are handled by the HTTP interceptors. Response
 *    types below are therefore typed WITHOUT the envelope wrapper.
 *  - Response monetary fields are `Money` objects
 *    (`{ amount: "125000000.00", currency: "COP" }`), not numbers. Request
 *    monetary fields (`baseSalary`, `unitRate`, `amount`) are plain numbers,
 *    matching the backend request DTOs. This service deliberately performs no
 *    arithmetic: `netAmount`, `pendingAmount`, `amount` and the settlement
 *    accumulation are all computed by the backend, so there is no money math to
 *    get wrong on the client.
 *  - `DELETE` endpoints answer `204 No Content`, so they map to `void`.
 */
@Injectable({ providedIn: 'root' })
export class Payroll {
  private readonly http = inject(HttpClient);

  // ── Payroll records ──────────────────────────────────────────────────────

  /** `GET /v1/payroll` — every payroll record. */
  getAllPayrolls(): Observable<PayrollResponse[]> {
    return this.http.get<PayrollResponse[]>('v1/payroll');
  }

  /** `GET /v1/payroll/{year}/{month}` — payroll records of a whole period. */
  getPayrollsByPeriod(year: number, month: number): Observable<PayrollResponse[]> {
    return this.http.get<PayrollResponse[]>(`v1/payroll/${String(year)}/${String(month)}`);
  }

  /** `GET /v1/payroll/worker/{userId}` — every payroll record of one worker. */
  getPayrollsByWorker(userId: number): Observable<PayrollResponse[]> {
    return this.http.get<PayrollResponse[]>(`v1/payroll/worker/${String(userId)}`);
  }

  /** `GET /v1/payroll/worker/{userId}/{year}/{month}` — one worker's payroll for a period. */
  getPayrollByWorkerPeriod(
    userId: number,
    year: number,
    month: number,
  ): Observable<PayrollResponse> {
    return this.http.get<PayrollResponse>(
      `v1/payroll/worker/${String(userId)}/${String(year)}/${String(month)}`,
    );
  }

  /** `POST /v1/payroll` — registers a payroll for a worker/period. */
  createPayroll(request: PayrollRequest): Observable<PayrollResponse> {
    return this.http.post<PayrollResponse>('v1/payroll', request);
  }

  /** `PATCH /v1/payroll/{id}` — partial update (status, notes, amounts, …). */
  updatePayroll(id: number, request: PayrollUpdateRequest): Observable<PayrollResponse> {
    return this.http.patch<PayrollResponse>(`v1/payroll/${String(id)}`, request);
  }

  /** `DELETE /v1/payroll/{id}` — `204 No Content`. */
  deletePayroll(id: number): Observable<void> {
    return this.http.delete(`v1/payroll/${String(id)}`).pipe(map(() => undefined));
  }

  // ── Payroll events ───────────────────────────────────────────────────────

  /** `POST /v1/payroll/events` — registers one event (overtime, absence, bonus, …). */
  createEvent(request: PayrollEventRequest): Observable<PayrollEventResponse> {
    return this.http.post<PayrollEventResponse>('v1/payroll/events', request);
  }

  /** `GET /v1/payroll/events/{userId}/{year}/{month}` — events of a worker in a period. */
  getEvents(userId: number, year: number, month: number): Observable<PayrollEventResponse[]> {
    return this.http.get<PayrollEventResponse[]>(
      `v1/payroll/events/${String(userId)}/${String(year)}/${String(month)}`,
    );
  }

  /** `DELETE /v1/payroll/events/{id}` — `204 No Content`. */
  deleteEvent(id: number): Observable<void> {
    return this.http.delete(`v1/payroll/events/${String(id)}`).pipe(map(() => undefined));
  }

  /** `POST /v1/payroll/events/calculate` — suggested rate/amount for an event. */
  calculate(request: PayrollCalculateRequest): Observable<PayrollCalculateResponse> {
    return this.http.post<PayrollCalculateResponse>('v1/payroll/events/calculate', request);
  }

  // ── Settlements ──────────────────────────────────────────────────────────

  /** `POST /v1/payroll/settle` — registers a partial/closing payment. */
  settle(request: PayrollSettlementRequest): Observable<PayrollSettlementResponse> {
    return this.http.post<PayrollSettlementResponse>('v1/payroll/settle', request);
  }

  /** `GET /v1/payroll/settlements/{userId}/{year}/{month}` — settlements of a period. */
  getSettlements(
    userId: number,
    year: number,
    month: number,
  ): Observable<PayrollSettlementResponse[]> {
    return this.http.get<PayrollSettlementResponse[]>(
      `v1/payroll/settlements/${String(userId)}/${String(year)}/${String(month)}`,
    );
  }
}

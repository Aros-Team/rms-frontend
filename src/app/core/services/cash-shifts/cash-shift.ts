import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import type {
  CashShiftResponse,
  CashShiftSummaryResponse,
} from '@app/shared/models/dto/cash-shifts/cash-shift';
import { formatMoneyAmount } from '@app/shared/models/dto/payments/money-amount';

/**
 * Typed client for the cash-shift slice.
 *
 * Endpoints (payments backend lane):
 *
 *  - `GET  /v1/cash-shifts/current` → `200` with the open shift, `204` when none
 *  - `POST /v1/cash-shifts/open` (opening float)
 *  - `POST /v1/cash-shifts/{id}/close` (counted cash + optional notes)
 *  - `GET  /v1/cash-shifts/{id}` (Z-summary; live totals while open)
 *
 * The backend clamps and validates amounts; the client always sends the
 * two-decimal string form. The 204 body is normalized to `null` so callers do
 * not have to branch on an empty response.
 */
@Injectable({ providedIn: 'root' })
export class CashShift {
  private readonly http = inject(HttpClient);

  /** The open shift, or `null` when the drawer is closed. */
  getCurrent(): Observable<CashShiftResponse | null> {
    return this.http
      .get<CashShiftResponse | null>('v1/cash-shifts/current')
      .pipe(map((response) => response ?? null));
  }

  /** Live summary while open; the frozen Z-summary after close. */
  getSummary(id: number): Observable<CashShiftSummaryResponse> {
    return this.http.get<CashShiftSummaryResponse>(`v1/cash-shifts/${String(id)}`);
  }

  /** Opens a shift with a non-negative opening float. */
  open(openingFloat: number): Observable<CashShiftResponse> {
    return this.http.post<CashShiftResponse>('v1/cash-shifts/open', {
      openingFloat: formatMoneyAmount(openingFloat),
    });
  }

  /** Closes a shift with the counted cash and an optional note. */
  close(id: number, countedCash: number, notes?: string): Observable<CashShiftSummaryResponse> {
    const trimmedNotes = notes?.trim() ?? '';
    return this.http.post<CashShiftSummaryResponse>(`v1/cash-shifts/${String(id)}/close`, {
      countedCash: formatMoneyAmount(countedCash),
      ...(trimmedNotes.length > 0 ? { notes: trimmedNotes } : {}),
    });
  }
}

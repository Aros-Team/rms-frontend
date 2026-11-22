import type { MoneyDto } from '../common/money';

/**
 * Shift header returned by `GET /v1/cash-shifts/current` and
 * `POST /v1/cash-shifts/open`.
 *
 * `GET /current` answers `204 No Content` when no shift is open, so the
 * service normalizes the body to `null`.
 */
export interface CashShiftResponse {
  id: number;
  status: 'OPEN' | 'CLOSED';
  currency: string;
  openedBy: number | null;
  /** `YYYY-MM-DDTHH:mm:ss` */
  openedAt: string | null;
  openingFloat: MoneyDto | null;
  notes: string | null;
}

/** Body of `POST /v1/cash-shifts/open`. */
export interface OpenCashShiftRequest {
  /** Non-negative two-decimal string. */
  openingFloat: string;
}

/** Body of `POST /v1/cash-shifts/{id}/close`. */
export interface CloseCashShiftRequest {
  /** Non-negative two-decimal string counted by the cashier. */
  countedCash: string;
  /** Optional close note, max 500 characters. */
  notes?: string;
}

/**
 * Z-summary returned by `POST /v1/cash-shifts/{id}/close` and
 * `GET /v1/cash-shifts/{id}`.
 *
 * While the shift is open the totals are live; at close the backend snapshots
 * expected/counted/difference so the Z-report never changes retroactively.
 * `cash`, `card` and `transfer` are tendered amounts; `changeGiven` is the cash
 * returned to guests, so expected cash is
 * `openingFloat + cash - changeGiven + paidIn - paidOut`.
 */
export interface CashShiftSummaryResponse {
  id: number;
  status: 'OPEN' | 'CLOSED';
  currency: string;
  openedBy: number | null;
  openedAt: string | null;
  closedBy: number | null;
  closedAt: string | null;
  openingFloat: MoneyDto | null;
  paymentsCount: number;
  voidedCount: number;
  subtotal: MoneyDto | null;
  discounts: MoneyDto | null;
  tips: MoneyDto | null;
  totalCharged: MoneyDto | null;
  cash: MoneyDto | null;
  card: MoneyDto | null;
  transfer: MoneyDto | null;
  changeGiven: MoneyDto | null;
  paidIn: MoneyDto | null;
  paidOut: MoneyDto | null;
  expectedCash: MoneyDto | null;
  countedCash: MoneyDto | null;
  difference: MoneyDto | null;
  notes: string | null;
}

/** Difference label for the close form: overage, shortage or balanced. */
export type ShiftDifferenceKind = 'over' | 'short' | 'balanced';

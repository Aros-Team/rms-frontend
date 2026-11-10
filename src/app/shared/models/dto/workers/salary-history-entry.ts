import type { Money } from '@app/shared/models/dto/common/money';

/**
 * One salary change of a worker, as returned by
 * `GET /v1/users/{id}/salary-history`.
 *
 * Both salaries are `Money` DTOs (`{ amount: "1200000.00", currency: "COP" }` on
 * the wire) — never treat `amount` as a number. Use `toAmount()` for arithmetic
 * and the `money` pipe for rendering.
 *
 * `oldSalary` is `null` for the first salary assignment (there was no previous
 * value); the `money` pipe renders that as an em dash.
 */
export interface SalaryHistoryEntry {
  /** `null` when this is the first salary of the worker. */
  oldSalary: Money | null;
  newSalary: Money;
  /** ISO instant of the change. */
  changedAt: string;
  reason: string;
  observations?: string | null;
}

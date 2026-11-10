import { Money } from '@models/dto/common/money';

import { PayrollStatus } from './payroll-status';

/**
 * Payload for `POST /v1/payroll` and, partially, `PATCH /v1/payroll/{id}`.
 *
 * Field-by-field mirror of the backend `PayrollRequest` record. Required:
 * `userId`, `year`, `month`, `periodStart`, `periodEnd`, `baseSalary`,
 * `hoursWorked`. `bonuses` / `deductions` may be omitted (backend defaults them
 * to zero) and `status` may be omitted on creation (backend defaults it).
 *
 * All monetary fields are `Money` DTOs — the wire format is
 * `{ amount: "125000000.00", currency: "COP" }`, never a bare number.
 */
export interface PayrollRequest {
  userId: number;
  year: number;
  month: number;
  /** `YYYY-MM-DD` */
  periodStart: string;
  /** `YYYY-MM-DD` */
  periodEnd: string;
  baseSalary: Money;
  bonuses?: Money;
  deductions?: Money;
  /** Hours actually worked in the period (also the denominator for hourly rate). */
  hoursWorked: number;
  status?: PayrollStatus;
  notes?: string;
}

import { Money } from '@models/dto/common/money';

import { PayrollStatus } from './payroll-status';

/**
 * A monthly payroll record as returned by every `GET|PATCH /v1/payroll*`
 * endpoint.
 *
 * Field-by-field mirror of the backend `PayrollResponse` record. Every monetary
 * field is a `Money` DTO (`{ amount: "125000000.00", currency: "COP" }`) — do
 * not treat `amount` as a number.
 *
 * `netAmount` is `baseSalary + bonuses - deductions` and `pendingAmount` is
 * `netAmount - paidAmount`; both are computed by the backend, so the frontend
 * only renders them.
 */
export interface PayrollResponse {
  id: number;
  userId: number;
  userName: string;
  year: number;
  month: number;
  /** `YYYY-MM-DD` */
  periodStart: string;
  /** `YYYY-MM-DD` */
  periodEnd: string;
  baseSalary: Money;
  bonuses: Money;
  deductions: Money;
  netAmount: Money;
  /** Sum of every settlement registered against this payroll. */
  paidAmount: Money;
  /** `netAmount - paidAmount`, computed by the backend. */
  pendingAmount: Money;
  hoursWorked: number;
  status: PayrollStatus;
  notes: string;
  registeredBy: number;
  createdAt: string;
  updatedAt: string;
}

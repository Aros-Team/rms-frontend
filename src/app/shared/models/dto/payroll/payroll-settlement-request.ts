import { SettlementType } from './settlement-type';

/**
 * Payload for `POST /v1/payroll/settle` — registers a partial or closing
 * payment against a worker's monthly payroll.
 *
 * Field-by-field mirror of the backend `PayrollSettlementRequest` record. The
 * backend addresses the payroll by `payrollId` (it does not derive it from
 * `userId`/period), and `amount` is a plain number on this API, not a `Money`
 * DTO. Only responses carry `{ amount, currency }`.
 */
export interface PayrollSettlementRequest {
  /** ID of the payroll record this settlement pays against. */
  payrollId: number;
  userId: number;
  settlementType: SettlementType;
  /** `YYYY-MM-DD` */
  periodStart: string;
  /** `YYYY-MM-DD` */
  periodEnd: string;
  amount: number;
  notes?: string;
}

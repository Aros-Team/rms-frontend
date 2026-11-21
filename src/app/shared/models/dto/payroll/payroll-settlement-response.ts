import { Money } from '@models/dto/common/money';

import { SettlementType } from './settlement-type';

/**
 * A registered settlement (partial payment) of a payroll.
 *
 * Returned by `POST /v1/payroll/settle` and
 * `GET /v1/payroll/settlements/{userId}/{year}/{month}`.
 *
 * `amount` is a `Money` DTO (decimal string amount), not a bare number.
 * `settledBy` is a free-form actor label (the API currently sends `"system"`).
 */
export interface PayrollSettlementResponse {
  id: number;
  payrollId: number;
  userId: number;
  settlementType: SettlementType;
  /** `YYYY-MM-DD` */
  periodStart: string;
  /** `YYYY-MM-DD` */
  periodEnd: string;
  amount: Money;
  notes: string;
  settledAt: string;
  settledBy: string;
}

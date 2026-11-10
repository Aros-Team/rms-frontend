import { Money } from '@models/dto/common/money';

import { SettlementType } from './settlement-type';

/**
 * Payload for `POST /v1/payroll/settle` — registers a partial or closing
 * payment against a worker's monthly payroll.
 *
 * Field-by-field mirror of the backend `PayrollSettlementRequest` record.
 * `amount` is a `Money` DTO: the wire format is
 * `{ amount: "1250000.00", currency: "COP" }`, never a bare number.
 */
export interface PayrollSettlementRequest {
  userId: number;
  year: number;
  month: number;
  settlementType: SettlementType;
  /** `YYYY-MM-DD` */
  periodStart: string;
  /** `YYYY-MM-DD` */
  periodEnd: string;
  amount: Money;
  notes?: string;
}

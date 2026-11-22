import type { MoneyDto } from '../common/money';
import type { PaymentStatus, PaymentTenderMethod } from './payment-method';

/**
 * One tender of a payment (`payment_tenders` child table).
 *
 * `reference` is free text for CARD/TRANSFER (auth code, transfer id) and
 * always null for CASH.
 */
export interface PaymentTenderResponse {
  method: PaymentTenderMethod;
  amount: MoneyDto | null;
  reference: string | null;
}

/**
 * Full payment + receipt payload (`POST /v1/payments`, `GET /v1/payments/{id}`).
 *
 * Every monetary field is a `MoneyDto`; use `toAmount()` before arithmetic and
 * the `money` pipe before rendering. `total` is authoritative: never recompute
 * it on the client for the receipt.
 */
export interface PaymentResponse {
  id: number;
  orderId: number;
  status: PaymentStatus;
  receiptNumber: string;
  currency: string;
  subtotal: MoneyDto | null;
  discount: MoneyDto | null;
  tip: MoneyDto | null;
  total: MoneyDto | null;
  tendered: MoneyDto | null;
  change: MoneyDto | null;
  tenders: PaymentTenderResponse[];
  cashierId: number | null;
  shiftId: number | null;
  /** `YYYY-MM-DDTHH:mm:ss` */
  createdAt: string | null;
  completedAt: string | null;
  voidedAt: string | null;
  voidedBy: number | null;
  voidReason: string | null;
}

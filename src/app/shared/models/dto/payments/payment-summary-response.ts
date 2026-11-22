import type { MoneyDto } from '../common/money';
import type { PaymentStatus } from './payment-method';

/**
 * Compact payment row returned by `GET /v1/payments` (journal).
 *
 * It carries no tenders, so the journal shows the total and the receipt number;
 * `GET /v1/payments/{id}` is fetched when the full receipt is needed.
 */
export interface PaymentSummaryResponse {
  id: number;
  orderId: number;
  status: PaymentStatus;
  receiptNumber: string;
  currency: string;
  subtotal: MoneyDto | null;
  discount: MoneyDto | null;
  tip: MoneyDto | null;
  total: MoneyDto | null;
  cashierId: number | null;
  shiftId: number | null;
  completedAt: string | null;
  voidedAt: string | null;
  voidReason: string | null;
}

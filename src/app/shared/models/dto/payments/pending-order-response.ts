import type { MoneyDto } from '../common/money';
import type { PendingPaymentStatus } from './payment-method';

/**
 * One row of `GET /v1/payments/pending`.
 *
 * Contract notes (payments backend lane):
 *  - `deliveredAt` is the order's business timestamp (`orders.date`), not a
 *    separate delivery instant. The UI labels it as the order time.
 *  - `tableId` / `tableNumber` / `partySize` are nullable because an order can
 *    exist without a table (legacy rows) and API-created orders have no party
 *    size (spike finding F-012).
 *  - `total` is the server-computed order total and is the only subtotal the
 *    cashier may display; the payment endpoint recomputes it again.
 *  - `paymentStatus` is `VOIDED` when the order's previous payment was voided.
 */
export interface PendingOrderResponse {
  orderId: number;
  tableId: number | null;
  tableNumber: number | null;
  partySize: number | null;
  /** `YYYY-MM-DDTHH:mm:ss` (business timezone, no offset). */
  deliveredAt: string;
  total: MoneyDto | null;
  paymentStatus: PendingPaymentStatus;
}

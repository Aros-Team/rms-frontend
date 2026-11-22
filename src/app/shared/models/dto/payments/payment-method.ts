/**
 * Payment vocabulary shared by the wire DTOs and the cashier UI.
 *
 * The backend accepts exactly three tender methods and two payment states.
 * Keeping the unions here (instead of re-typing strings in every component)
 * means a new method cannot be added in one place and forgotten in another.
 */

/** Tender method accepted by `POST /v1/payments`. */
export type PaymentTenderMethod = 'CASH' | 'CARD' | 'TRANSFER';

/** Persisted payment state. There is no draft/pending state on the wire. */
export type PaymentStatus = 'COMPLETED' | 'VOIDED';

/**
 * Derived state of a delivered order on the pending board.
 *
 * `VOIDED` means the only payment for the order was voided, so the order is
 * chargeable again (the backend allows one non-voided payment per order).
 */
export type PendingPaymentStatus = 'UNPAID' | 'VOIDED';

/** Manual discount kinds. Only one discount is allowed per payment. */
export type PaymentDiscountType = 'PERCENT' | 'AMOUNT';

/** Spanish labels for the UI (D-010: copy stays in Spanish). */
export const PAYMENT_METHOD_LABEL: Readonly<Record<PaymentTenderMethod, string>> = {
  CASH: 'Efectivo',
  CARD: 'Tarjeta',
  TRANSFER: 'Transferencia',
};

/** Spanish labels for the persisted payment state. */
export const PAYMENT_STATUS_LABEL: Readonly<Record<PaymentStatus, string>> = {
  COMPLETED: 'Completado',
  VOIDED: 'Anulado',
};

/** Narrowing helper for values that arrive from a form or a filter. */
export function isPaymentTenderMethod(value: unknown): value is PaymentTenderMethod {
  return value === 'CASH' || value === 'CARD' || value === 'TRANSFER';
}

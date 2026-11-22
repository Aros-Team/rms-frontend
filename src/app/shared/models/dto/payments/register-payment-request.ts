import type { PaymentDiscountType, PaymentTenderMethod } from './payment-method';

/**
 * Body of `POST /v1/payments`.
 *
 * There is deliberately no subtotal or total: the server derives both from the
 * order (`PaymentCalculator`), so the request cannot influence the amount
 * charged. Amounts are decimal strings (`"58000.00"`), matching `MoneyDto`.
 *
 * `Idempotency-Key` travels as a header, not in this body.
 */
export interface RegisterPaymentRequest {
  orderId: number;
  /** Optional tip; the server defaults to zero when omitted. */
  tipAmount?: string;
  /** At most one manual discount, with a mandatory reason. */
  discount?: RegisterPaymentDiscount | null;
  /** One or more tenders (split payment). */
  tenders: RegisterPaymentTender[];
}

/** One manual discount (`PERCENT` value is a percentage, `AMOUNT` is money). */
export interface RegisterPaymentDiscount {
  type: PaymentDiscountType;
  /** Percentage (`"10.00"`) or money (`"5000.00"`) as a decimal string. */
  value: string;
  /** Mandatory justification, max 255 characters. */
  reason: string;
}

/** One tender of the split payment. */
export interface RegisterPaymentTender {
  method: PaymentTenderMethod;
  /** Positive decimal string. */
  amount: string;
  /** Optional card/transfer reference, max 100 characters. */
  reference?: string | null;
}

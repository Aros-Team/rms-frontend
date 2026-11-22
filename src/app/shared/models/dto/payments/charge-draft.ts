import type { PaymentDiscountType, PaymentTenderMethod } from './payment-method';

/** One tender as edited in the charge panel, before serialization. */
export interface TenderDraft {
  method: PaymentTenderMethod;
  /** Positive amount; `0` while the cashier has not typed one yet. */
  amount: number;
  /** Free text for CARD/TRANSFER; ignored for CASH. */
  reference: string;
}

/** The single optional discount of the charge. */
export interface DiscountDraft {
  /** `PERCENT` (`value` is a percentage) or `AMOUNT` (`value` is money). */
  type: PaymentDiscountType;
  value: number;
  reason: string;
}

/**
 * Everything the cashier has entered for one charge attempt.
 *
 * `subtotal` always comes from the server (the pending order / order total).
 * The draft never carries a total: `computeCharge()` derives it so the preview
 * matches the backend formula.
 */
export interface ChargeDraft {
  subtotal: number;
  tip: number;
  discount: DiscountDraft | null;
  tenders: TenderDraft[];
}

/**
 * One reason the charge cannot be submitted.
 *
 * Codes are stable so the component owns the Spanish copy (D-010) and the
 * tests can assert behavior without matching prose.
 */
export type ChargeIssueCode =
  | 'SUBTOTAL_MISSING'
  | 'TIP_NEGATIVE'
  | 'TIP_INVALID'
  | 'DISCOUNT_VALUE_REQUIRED'
  | 'DISCOUNT_PERCENT_RANGE'
  | 'DISCOUNT_TOO_LARGE'
  | 'DISCOUNT_REASON_REQUIRED'
  | 'TENDER_REQUIRED'
  | 'TENDER_AMOUNT_REQUIRED'
  | 'NON_CASH_OVER_REMAINING'
  | 'CASH_OVER_NOT_LAST'
  | 'UNDERPAID'
  | 'TOTAL_NOT_POSITIVE';

/** A single validation issue; `index` points at the offending tender. */
export interface ChargeIssue {
  code: ChargeIssueCode;
  /** Tender index, when the issue belongs to one row. */
  index?: number;
  /** Missing/overpaid amount in currency units, when relevant. */
  amount?: number;
}

/** Per-tender result used to render the remaining amount and change. */
export interface TenderComputation {
  /** Remaining amount after this tender (negative means overpaid). */
  remainingAfter: number;
  /** Change produced by this tender (only cash can produce it). */
  change: number;
}

/** Result of `computeCharge()`: the preview plus every blocking issue. */
export interface ChargeComputation {
  subtotal: number;
  discountAmount: number;
  tip: number;
  total: number;
  tendered: number;
  change: number;
  remaining: number;
  tenders: TenderComputation[];
  issues: ChargeIssue[];
  valid: boolean;
}

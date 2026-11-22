import type {
  ChargeDraft,
  ChargeIssue,
  ChargeComputation,
  TenderDraft,
} from '@app/shared/models/dto/payments/charge-draft';
import type { RegisterPaymentRequest } from '@app/shared/models/dto/payments/register-payment-request';
import { formatMoneyAmount } from '@app/shared/models/dto/payments/money-amount';

export type { ChargeDraft, ChargeIssue, ChargeComputation, TenderDraft };

/** Converts an amount to integer cents, matching the server's 2-decimal scale. */
function toCents(amount: number): number {
  return Math.round(amount * 100);
}

/** Converts integer cents back to a 2-decimal amount. */
function fromCents(cents: number): number {
  return cents / 100;
}

function isFinitePositive(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/**
 * Computes the discount amount in cents for a draft discount.
 *
 * PERCENT mirrors the backend exactly: the percentage becomes basis points
 * (`value * 100`) and is applied with HALF_UP to the 2-decimal subtotal. That
 * is why the client preview and the server total agree to the cent.
 */
function discountCents(subtotalCents: number, draft: ChargeDraft): number {
  const discount = draft.discount;
  if (discount === null) return 0;
  if (!isFinitePositive(discount.value)) return 0;

  if (discount.type === 'PERCENT') {
    const basisPoints = Math.round(discount.value * 100);
    return Math.round((subtotalCents * basisPoints) / 10000);
  }

  return toCents(discount.value);
}

/**
 * Pure charge calculator for the cashier panel.
 *
 * Mirrors the backend `PaymentCalculator` so the cashier sees the exact total,
 * remaining amount and change **before** submitting, and so the confirm button
 * can be disabled until every server invariant holds:
 *
 *  - `total = subtotal - discount + tip`
 *  - one discount, always with a reason, lower than the subtotal
 *  - at least one positive tender
 *  - non-cash tenders never exceed the remaining amount
 *  - only the last tender may exceed the remaining amount, and only if cash
 *  - tenders must cover the total; the excess is change
 *
 * The computation never throws and reports every problem it finds, so the UI
 * can list all issues at once instead of one at a time.
 */
export function computeCharge(draft: ChargeDraft): ChargeComputation {
  const issues: ChargeIssue[] = [];

  const subtotalCents = Number.isFinite(draft.subtotal) ? toCents(draft.subtotal) : 0;
  if (subtotalCents <= 0) {
    issues.push({ code: 'SUBTOTAL_MISSING' });
  }

  let tipCents = 0;
  if (Number.isFinite(draft.tip)) {
    tipCents = toCents(draft.tip);
    if (tipCents < 0) issues.push({ code: 'TIP_NEGATIVE' });
  } else {
    issues.push({ code: 'TIP_INVALID' });
  }

  const discount = draft.discount;
  if (discount !== null) {
    if (!isFinitePositive(discount.value)) {
      issues.push({ code: 'DISCOUNT_VALUE_REQUIRED' });
    }
    if (discount.type === 'PERCENT' && isFinitePositive(discount.value) && discount.value > 100) {
      issues.push({ code: 'DISCOUNT_PERCENT_RANGE' });
    }
    if (discount.reason.trim().length === 0) {
      issues.push({ code: 'DISCOUNT_REASON_REQUIRED' });
    }
  }

  const discountAmountCents = discountCents(subtotalCents, draft);
  if (discountAmountCents > 0 && subtotalCents > 0 && discountAmountCents >= subtotalCents) {
    issues.push({ code: 'DISCOUNT_TOO_LARGE' });
  }

  const totalCents = subtotalCents - discountAmountCents + tipCents;
  if (totalCents <= 0 && subtotalCents > 0) {
    issues.push({ code: 'TOTAL_NOT_POSITIVE' });
  }

  const tenders = draft.tenders;
  if (tenders.length === 0) {
    issues.push({ code: 'TENDER_REQUIRED' });
  }

  let remainingCents = totalCents;
  let tenderedCents = 0;
  const tenderStates = tenders.map((tender, index) => {
    const isLast = index === tenders.length - 1;
    const amountCents =
      Number.isFinite(tender.amount) && tender.amount > 0 ? toCents(tender.amount) : 0;

    if (amountCents <= 0) {
      issues.push({ code: 'TENDER_AMOUNT_REQUIRED', index });
    }

    if (amountCents > remainingCents) {
      if (tender.method !== 'CASH') {
        issues.push({ code: 'NON_CASH_OVER_REMAINING', index });
      } else if (!isLast) {
        issues.push({ code: 'CASH_OVER_NOT_LAST', index });
      }
    }

    remainingCents -= amountCents;
    tenderedCents += amountCents;

    return {
      remainingAfter: fromCents(remainingCents),
      change: fromCents(Math.max(0, -remainingCents)),
    };
  });

  if (remainingCents > 0) {
    issues.push({ code: 'UNDERPAID', amount: fromCents(remainingCents) });
  }

  return {
    subtotal: fromCents(subtotalCents),
    discountAmount: fromCents(discountAmountCents),
    tip: fromCents(tipCents),
    total: fromCents(totalCents),
    tendered: fromCents(tenderedCents),
    change: fromCents(Math.max(0, -remainingCents)),
    remaining: fromCents(Math.max(0, remainingCents)),
    tenders: tenderStates,
    issues,
    valid: issues.length === 0 && totalCents > 0,
  };
}

/**
 * Discount amount for the tip presets (`subtotal - discount`), even when the
 * discount is incomplete. Returns 0 when there is no usable discount.
 */
export function computeDiscountAmount(draft: ChargeDraft): number {
  const subtotalCents = Number.isFinite(draft.subtotal) ? toCents(draft.subtotal) : 0;
  if (subtotalCents <= 0) return 0;
  const amount = discountCents(subtotalCents, draft);
  return amount > 0 && amount < subtotalCents ? fromCents(amount) : 0;
}

/** Percentage preset applied to the discounted subtotal, rounded to cents. */
export function tipFromPercent(totalBeforeTip: number, percent: number): number {
  if (!Number.isFinite(totalBeforeTip) || !Number.isFinite(percent)) return 0;
  return fromCents(Math.round((toCents(totalBeforeTip) * percent) / 100));
}

/**
 * Serializes a draft into the wire request.
 *
 * Amounts use the two-decimal string form the API expects. The order id is
 * passed in because the draft itself describes money, not identity.
 */
export function toRegisterPaymentRequest(
  draft: ChargeDraft,
  orderId: number,
): RegisterPaymentRequest {
  const discount = draft.discount;
  const request: RegisterPaymentRequest = {
    orderId,
    tipAmount: formatMoneyAmount(Number.isFinite(draft.tip) ? draft.tip : 0),
    tenders: draft.tenders.map((tender) => {
      const reference = tender.reference.trim();
      return {
        method: tender.method,
        amount: formatMoneyAmount(Number.isFinite(tender.amount) ? tender.amount : 0),
        ...(tender.method !== 'CASH' && reference.length > 0 ? { reference } : {}),
      };
    }),
  };

  if (discount !== null && isFinitePositive(discount.value)) {
    request.discount = {
      type: discount.type,
      value:
        discount.type === 'PERCENT'
          ? formatMoneyAmount(Math.round(discount.value * 100) / 100)
          : formatMoneyAmount(discount.value),
      reason: discount.reason.trim(),
    };
  }

  return request;
}

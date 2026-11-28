/**
 * Tests for the pure charge calculator.
 *
 * Feature: mirror the backend `PaymentCalculator` so the cashier preview, the
 * change and the confirm-button state agree with the server to the cent.
 * Contract:
 *  - total = subtotal - discount + tip;
 *  - one discount, reasoned, lower than the subtotal; PERCENT uses basis points
 *    with HALF_UP rounding (the backend's formula);
 *  - at least one positive tender; non-cash never overpays; only the last
 *    cash tender may overpay, producing change;
 *  - tenders must cover the total; the shortfall is reported with its amount;
 *  - serialization sends two-decimal strings, omits the discount when absent
 *    and omits the reference for cash.
 *
 * Approach: build drafts and assert exact numbers, issue codes and wire bodies.
 */
import { describe, expect, it } from 'vitest';

import {
  computeCharge,
  computeDiscountAmount,
  tipFromPercent,
  toRegisterPaymentRequest,
} from './charge-draft';
import type {
  ChargeDraft,
  ChargeIssueCode,
  TenderDraft,
} from '@app/shared/models/dto/payments/charge-draft';

function cash(amount: number): TenderDraft {
  return { method: 'CASH', amount, reference: '' };
}

function draft(overrides: Partial<ChargeDraft> = {}): ChargeDraft {
  return {
    subtotal: 62000,
    tip: 0,
    discount: null,
    tenders: [cash(62000)],
    ...overrides,
  };
}

function codes(result: { issues: { code: ChargeIssueCode }[] }): ChargeIssueCode[] {
  return result.issues.map((issue) => issue.code);
}

describe('computeCharge', () => {
  it('accepts exact cash and produces no change', () => {
    const result = computeCharge(draft());

    expect(result.total).toBe(62000);
    expect(result.tendered).toBe(62000);
    expect(result.change).toBe(0);
    expect(result.remaining).toBe(0);
    expect(result.valid).toBe(true);
  });

  it('computes a percentage discount with the backend basis-point rounding', () => {
    const result = computeCharge(
      draft({
        subtotal: 100.05,
        discount: { type: 'PERCENT', value: 10, reason: 'Cortesía' },
        tenders: [cash(90.04)],
      }),
    );

    expect(result.discountAmount).toBe(10.01);
    expect(result.total).toBe(90.04);
    expect(result.valid).toBe(true);
  });

  it('computes an amount discount and a tip in the total', () => {
    const result = computeCharge(
      draft({
        discount: { type: 'AMOUNT', value: 5000, reason: 'Gerencia' },
        tip: 3000,
        tenders: [cash(60000)],
      }),
    );

    expect(result.discountAmount).toBe(5000);
    expect(result.total).toBe(60000);
    expect(result.tip).toBe(3000);
    expect(result.valid).toBe(true);
  });

  it('splits between card and cash and returns the cash change', () => {
    const result = computeCharge(
      draft({
        tenders: [{ method: 'CARD', amount: 30000, reference: 'AUTH-1' }, cash(40000)],
      }),
    );

    expect(result.tendered).toBe(70000);
    expect(result.change).toBe(8000);
    expect(result.tenders[0].remainingAfter).toBe(32000);
    expect(result.tenders[1].change).toBe(8000);
    expect(result.valid).toBe(true);
  });

  it('rejects a card tender above the remaining amount', () => {
    const result = computeCharge(
      draft({ tenders: [{ method: 'CARD', amount: 70000, reference: '' }] }),
    );

    expect(codes(result)).toContain('NON_CASH_OVER_REMAINING');
    expect(result.valid).toBe(false);
  });

  it('rejects cash that overpays when it is not the last tender', () => {
    const result = computeCharge(
      draft({ tenders: [cash(70000), { method: 'CARD', amount: 10000, reference: '' }] }),
    );

    expect(codes(result)).toContain('CASH_OVER_NOT_LAST');
    expect(result.valid).toBe(false);
  });

  it('reports the shortfall amount when tenders do not cover the total', () => {
    const result = computeCharge(draft({ tenders: [cash(50000)] }));

    expect(result.remaining).toBe(12000);
    expect(result.issues).toContainEqual({ code: 'UNDERPAID', amount: 12000 });
    expect(result.valid).toBe(false);
  });

  it('requires a reason for a discount', () => {
    const result = computeCharge(
      draft({ discount: { type: 'PERCENT', value: 10, reason: '   ' } }),
    );

    expect(codes(result)).toContain('DISCOUNT_REASON_REQUIRED');
    expect(result.valid).toBe(false);
  });

  it('rejects a zero or negative discount value', () => {
    const result = computeCharge(
      draft({ discount: { type: 'AMOUNT', value: 0, reason: 'Cortesía' } }),
    );

    expect(codes(result)).toContain('DISCOUNT_VALUE_REQUIRED');
  });

  it('rejects a percentage above 100', () => {
    const result = computeCharge(
      draft({ discount: { type: 'PERCENT', value: 120, reason: 'Error' } }),
    );

    expect(codes(result)).toContain('DISCOUNT_PERCENT_RANGE');
  });

  it('rejects a discount equal to the subtotal', () => {
    const result = computeCharge(
      draft({ discount: { type: 'PERCENT', value: 100, reason: 'Cortesía total' } }),
    );

    expect(codes(result)).toContain('DISCOUNT_TOO_LARGE');
  });

  it('rejects a negative tip', () => {
    const result = computeCharge(draft({ tip: -1000 }));

    expect(codes(result)).toContain('TIP_NEGATIVE');
    expect(result.valid).toBe(false);
  });

  it('rejects a non-numeric tip', () => {
    const result = computeCharge(draft({ tip: Number.NaN }));

    expect(codes(result)).toContain('TIP_INVALID');
  });

  it('requires at least one tender', () => {
    const result = computeCharge(draft({ tenders: [] }));

    expect(codes(result)).toContain('TENDER_REQUIRED');
  });

  it('flags an empty tender row by index', () => {
    const result = computeCharge(draft({ tenders: [cash(62000), cash(0)] }));

    expect(result.issues).toContainEqual({ code: 'TENDER_AMOUNT_REQUIRED', index: 1 });
  });

  it('rejects an order without a chargeable amount', () => {
    const result = computeCharge(draft({ subtotal: 0, tenders: [] }));

    expect(codes(result)).toContain('SUBTOTAL_MISSING');
    expect(result.valid).toBe(false);
  });
});

describe('computeDiscountAmount', () => {
  it('returns the percentage amount even when the reason is missing', () => {
    const amount = computeDiscountAmount({
      subtotal: 62000,
      tip: 0,
      discount: { type: 'PERCENT', value: 10, reason: '' },
      tenders: [cash(62000)],
    });

    expect(amount).toBe(6200);
  });

  it('returns zero when the discount is not usable', () => {
    expect(
      computeDiscountAmount({
        subtotal: 62000,
        tip: 0,
        discount: { type: 'AMOUNT', value: 62000, reason: 'Todo' },
        tenders: [cash(0)],
      }),
    ).toBe(0);
  });
});

describe('tipFromPercent', () => {
  it('computes ten percent of the discounted subtotal', () => {
    expect(tipFromPercent(55800, 10)).toBe(5580);
  });

  it('returns zero for a zero preset', () => {
    expect(tipFromPercent(55800, 0)).toBe(0);
  });
});

describe('toRegisterPaymentRequest', () => {
  it('serializes amounts as two-decimal strings and omits the discount', () => {
    const request = toRegisterPaymentRequest(draft({ tip: 5000 }), 900029);

    expect(request.orderId).toBe(900029);
    expect(request.tipAmount).toBe('5000.00');
    expect(request.discount).toBeUndefined();
    expect(request.tenders).toEqual([{ method: 'CASH', amount: '62000.00' }]);
  });

  it('rounds a percentage to two decimals and trims the reason', () => {
    const request = toRegisterPaymentRequest(
      draft({
        discount: { type: 'PERCENT', value: 10.555, reason: '  Cortesía  ' },
        tenders: [cash(55456)],
      }),
      1,
    );

    expect(request.discount).toEqual({
      type: 'PERCENT',
      value: '10.56',
      reason: 'Cortesía',
    });
  });

  it('keeps a card reference and drops the cash reference', () => {
    const request = toRegisterPaymentRequest(
      draft({
        tenders: [
          { method: 'CARD', amount: 30000, reference: '  AUTH-1  ' },
          { method: 'CASH', amount: 40000, reference: 'ignored' },
        ],
      }),
      1,
    );

    expect(request.tenders[0]).toEqual({
      method: 'CARD',
      amount: '30000.00',
      reference: 'AUTH-1',
    });
    expect(request.tenders[1]).toEqual({ method: 'CASH', amount: '40000.00' });
  });
});

/**
 * Tests for `calculateLineTotal` / `calculateTotalPrice`, the single source of
 * truth for an order's monetary values.
 *
 * Feature: `OrderResponse.total` / `OrderDetailItem.unitPrice` /
 * `OrderDetailItem.extraCharge` are `MoneyDto` objects on the wire
 * (`{ amount: "15000.00", currency: "COP" }`), not numbers.
 * Contract:
 *  - the server-computed `total` wins whenever it is present (it already folds
 *    every line surcharge);
 *  - without a usable `total`, an order's contribution is the sum of its line
 *    `unitPrice` values; `extraCharge` is NOT added again because the backend
 *    builds `unitPrice = basePrice + extraCharge`;
 *  - two `MoneyDto` details `15000.00` + `2500.00` ⇒ exactly 17500 (the bug was
 *    `NaN`, because objects were added directly);
 *  - string amounts, bare numbers and a missing `extraCharge` all normalize;
 *  - an order without details ⇒ 0 (never `NaN`).
 *
 * Approach: call the helpers with the REAL payload shape (string amounts inside
 * money objects) and assert the exact numeric total.
 */
import { describe, expect, it } from 'vitest';

import {
  calculateLineTotal,
  calculateTotalPrice,
  type OrderDetailItem,
  type OrderResponse,
} from './order-response';

function makeDetail(overrides: Partial<OrderDetailItem> = {}): OrderDetailItem {
  return {
    id: 1,
    productId: 1,
    productName: 'Hamburguesa',
    instructions: '',
    unitPrice: 0,
    ...overrides,
  };
}

function makeOrder(details: OrderDetailItem[], total?: OrderDetailItem['unitPrice']): OrderResponse {
  return {
    id: 1,
    date: '2026-07-15T12:00:00',
    status: 'DELIVERED',
    tableId: 3,
    details,
    ...(total === undefined ? {} : { total }),
  };
}

describe('calculateTotalPrice', () => {
  it('prefers the server-computed total', () => {
    const order = makeOrder(
      [makeDetail({ unitPrice: { amount: '15000.00', currency: 'COP' } })],
      { amount: '17500.00', currency: 'COP' },
    );

    expect(calculateTotalPrice(order)).toBe(17500);
  });

  it('sums the line unit prices when the payload has no total', () => {
    const order = makeOrder([
      makeDetail({ id: 1, unitPrice: { amount: '15000.00', currency: 'COP' } }),
      makeDetail({ id: 2, unitPrice: { amount: '2500.00', currency: 'COP' } }),
    ]);

    expect(calculateTotalPrice(order)).toBe(17500);
  });

  it('does not double-count extraCharge (already included in unitPrice)', () => {
    const order = makeOrder([
      makeDetail({
        id: 1,
        unitPrice: { amount: '12500.00', currency: 'COP' },
        extraCharge: { amount: '2500.00', currency: 'COP' },
      }),
      makeDetail({ id: 2, unitPrice: { amount: '5000.00', currency: 'COP' } }),
    ]);

    expect(calculateTotalPrice(order)).toBe(17500);
  });

  it('tolerates bare numbers mixed with money objects', () => {
    const order = makeOrder([
      makeDetail({ id: 1, unitPrice: 12500, extraCharge: 2500 }),
      makeDetail({ id: 2, unitPrice: { amount: '5000.00', currency: 'COP' } }),
    ]);

    expect(calculateTotalPrice(order)).toBe(17500);
  });

  it('never yields NaN when an amount is unparseable', () => {
    const order = makeOrder([
      makeDetail({ id: 1, unitPrice: { amount: 'notanumber', currency: 'COP' } }),
      makeDetail({ id: 2, unitPrice: { amount: '1000.00', currency: 'COP' } }),
    ]);

    const total = calculateTotalPrice(order);
    expect(Number.isNaN(total)).toBe(false);
    expect(total).toBe(1000);
  });

  it('returns 0 for an order without details', () => {
    expect(calculateTotalPrice(makeOrder([]))).toBe(0);
  });
});

describe('calculateLineTotal', () => {
  it('normalizes a MoneyDto unit price', () => {
    expect(calculateLineTotal(makeDetail({ unitPrice: { amount: '15000.00', currency: 'COP' } }))).toBe(
      15000,
    );
  });

  it('ignores extraCharge so the surcharge is not counted twice', () => {
    const detail = makeDetail({
      unitPrice: { amount: '12500.00', currency: 'COP' },
      extraCharge: { amount: '2500.00', currency: 'COP' },
    });

    expect(calculateLineTotal(detail)).toBe(12500);
  });
});

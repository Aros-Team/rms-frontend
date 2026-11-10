/**
 * Tests for `calculateTotalPrice` — the single source of order money math.
 *
 * Feature: Sums every order line as `unitPrice + extraCharge`.
 * Contract:
 *  - empty details → 0
 *  - `extraCharge` is folded into the total (options/additions surcharges)
 *  - missing `extraCharge` behaves as 0
 * Approach: Build `OrderResponse` fixtures and assert exact numeric totals.
 */
import { describe, expect, it } from 'vitest';

import { calculateTotalPrice, type OrderResponse } from './order-response';

function orderWith(details: { unitPrice: number; extraCharge?: number }[]): OrderResponse {
  return {
    id: 1,
    date: '2026-07-15T12:00:00',
    status: 'QUEUE',
    tableId: 1,
    details: details.map((d, i) => ({
      id: i + 1,
      productId: 100 + i,
      productName: `Producto ${String(i + 1)}`,
      unitPrice: d.unitPrice,
      extraCharge: d.extraCharge,
      instructions: '',
    })),
  };
}

describe('calculateTotalPrice', () => {
  it('returns 0 when there are no details', () => {
    expect(calculateTotalPrice(orderWith([]))).toBe(0);
  });

  it('folds extraCharge into the total', () => {
    const order = orderWith([
      { unitPrice: 10000, extraCharge: 2000 },
      { unitPrice: 5000, extraCharge: 500 },
    ]);

    expect(calculateTotalPrice(order)).toBe(17500);
  });

  it('treats a missing extraCharge as zero', () => {
    expect(calculateTotalPrice(orderWith([{ unitPrice: 8000 }]))).toBe(8000);
  });
});

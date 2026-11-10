/**
 * Tests for the purchase order money contract.
 *
 * Feature: `PurchaseResponse.totalAmount` and every
 * `PurchaseItemResponse.unitPrice` arrive as `MoneyDto`
 * (`{ amount: "15000.00", currency: "COP" }`), so any consumer must normalize
 * them through `toAmount()` before arithmetic.
 *
 * Contract:
 *  - `sum(unitPrice * quantityOrdered)` over the items equals the order's
 *    `totalAmount`, computed as an exact number (not "15000.002500.00" string
 *    concatenation, not `NaN`);
 *  - a missing/malformed money field normalizes to `0`, never `NaN`.
 *
 * Approach: build fixtures from the real wire shape and assert exact numeric
 * aggregates via `toAmount()`.
 */
import { describe, expect, it } from 'vitest';

import { toAmount, tryToAmount, type Money } from '@app/shared/models/dto/common/money';
import type { PurchaseResponse } from './purchase-response';
import type { PurchaseItemResponse } from './purchase-item-response';

function makeItem(unitPrice: Money, quantityOrdered: number): PurchaseItemResponse {
  return {
    id: quantityOrdered,
    supplyVariantId: quantityOrdered * 10,
    quantityOrdered,
    quantityReceived: quantityOrdered,
    unitPrice,
  };
}

function makePurchase(totalAmount: Money, items: PurchaseItemResponse[]): PurchaseResponse {
  return {
    id: 7,
    supplierId: 1,
    registeredById: 2,
    purchasedAt: '2026-11-10T09:30:00',
    totalAmount,
    notes: null,
    createdAt: '2026-11-10T09:30:05',
    items,
  };
}

describe('PurchaseResponse — MoneyDto totals', () => {
  it('normalizes the item prices to an exact numeric order total', () => {
    const purchase = makePurchase({ amount: '31600.00', currency: 'COP' }, [
      makeItem({ amount: '15000.00', currency: 'COP' }, 2),
      makeItem({ amount: '1600.00', currency: 'COP' }, 1),
    ]);

    const itemsTotal = purchase.items.reduce(
      (sum, item) => sum + toAmount(item.unitPrice) * item.quantityOrdered,
      0,
    );

    expect(itemsTotal).toBe(31600);
    expect(toAmount(purchase.totalAmount)).toBe(31600);
  });

  it('treats a missing totalAmount as 0 instead of NaN', () => {
    const purchase = makePurchase(undefined as unknown as Money, [
      makeItem({ amount: '15000.00', currency: 'COP' }, 1),
    ]);

    expect(tryToAmount(purchase.totalAmount)).toBeNull();
    expect(toAmount(purchase.totalAmount)).toBe(0);
    expect(Number.isNaN(toAmount(purchase.totalAmount))).toBe(false);
  });

  it('treats a malformed item price as 0 so the aggregate stays finite', () => {
    const purchase = makePurchase({ amount: '15000.00', currency: 'COP' }, [
      makeItem({ amount: 'notanumber', currency: 'COP' }, 1),
    ]);

    const itemsTotal = purchase.items.reduce(
      (sum, item) => sum + toAmount(item.unitPrice) * item.quantityOrdered,
      0,
    );

    expect(itemsTotal).toBe(0);
    expect(Number.isNaN(itemsTotal)).toBe(false);
  });
});

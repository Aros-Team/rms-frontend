/**
 * Tests for the order detail dialog money helpers.
 *
 * Feature: The dialog renders each line's money total and the order total.
 * Contract:
 *  - `getLineTotal()` = `calculateLineTotal(detail)`, i.e. `toAmount(unitPrice)`
 *    only, because `unitPrice` already includes `extraCharge`; a `MoneyDto`
 *    line yields an exact number instead of `NaN`;
 *  - `getTotalPrice()` = `calculateTotalPrice(order)` and 0 when no order;
 *  - money objects never reach the template as raw objects for arithmetic.
 *
 * Approach: instantiate the component class directly (no TestBed needed: the
 * helpers are pure) and assert exact numeric results for real wire payloads.
 */
import { describe, expect, it } from 'vitest';

import type { OrderDetailItem, OrderResponse } from '@app/shared/models/dto/orders/order-response';
import { OrderDetailDialog } from './order-detail-dialog';

function makeDetail(overrides: Partial<OrderDetailItem> = {}): OrderDetailItem {
  return {
    id: 1,
    productId: 1,
    productName: 'Hamburguesa',
    instructions: '',
    unitPrice: { amount: '15000.00', currency: 'COP' },
    ...overrides,
  };
}

describe('OrderDetailDialog', () => {
  it('does not add extraCharge on top of an inclusive unitPrice', () => {
    const dialog = new OrderDetailDialog();
    const detail = makeDetail({
      unitPrice: { amount: '17500.00', currency: 'COP' },
      extraCharge: { amount: '2500.00', currency: 'COP' },
    });

    const total = dialog.getLineTotal(detail);

    expect(Number.isNaN(total)).toBe(false);
    expect(total).toBe(17500);
  });

  it('normalizes a MoneyDto unitPrice', () => {
    const dialog = new OrderDetailDialog();

    expect(dialog.getLineTotal(makeDetail())).toBe(15000);
  });

  it('returns 0 for an unparseable amount instead of NaN', () => {
    const dialog = new OrderDetailDialog();

    const total = dialog.getLineTotal(
      makeDetail({ unitPrice: { amount: 'oops', currency: 'COP' } }),
    );

    expect(Number.isNaN(total)).toBe(false);
    expect(total).toBe(0);
  });

  it('delegates the order total to calculateTotalPrice', () => {
    const dialog = new OrderDetailDialog();
    const order: OrderResponse = {
      id: 3,
      date: '2026-07-15T12:00:00',
      status: 'DELIVERED',
      tableId: 2,
      details: [
        makeDetail({ id: 1, unitPrice: { amount: '15000.00', currency: 'COP' } }),
        makeDetail({ id: 2, unitPrice: { amount: '2500.00', currency: 'COP' } }),
      ],
    };
    dialog.order = order;

    expect(dialog.getTotalPrice()).toBe(17500);
  });

  it('returns 0 when there is no order', () => {
    const dialog = new OrderDetailDialog();

    expect(dialog.getTotalPrice()).toBe(0);
  });
});

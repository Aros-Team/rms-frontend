/**
 * Tests for the cashier order-line grouping.
 *
 * Feature: turn the API's flattened detail lines (no quantity column) into a
 * readable review with quantity, options, combos, additions, clarifications and
 * server-priced line totals.
 * Contract:
 *  - identical product/price/options/instructions lines group into one row with
 *    quantity N and total = unitPrice × N;
 *  - different options or instructions stay separate;
 *  - MoneyDto line prices are normalized through `calculateLineTotal`;
 *  - resolved additions prefer the option-group label.
 *
 * Approach: call `groupOrderLines` with handwritten detail fixtures.
 */
import { describe, expect, it } from 'vitest';

import type { OrderDetailItem } from '@app/shared/models/dto/orders/order-response';
import { countOrderItems, groupOrderLines } from './order-lines';

function detail(overrides: Partial<OrderDetailItem> = {}): OrderDetailItem {
  return {
    id: 1,
    productId: 10,
    productName: 'Hamburguesa',
    unitPrice: { amount: '25000.00', currency: 'COP' },
    instructions: '',
    ...overrides,
  };
}

describe('groupOrderLines', () => {
  it('groups repeated identical lines and multiplies the server price', () => {
    const lines = groupOrderLines([detail({ id: 1 }), detail({ id: 2 })]);

    expect(lines).toHaveLength(1);
    expect(lines[0].quantity).toBe(2);
    expect(lines[0].unitPrice).toBe(25000);
    expect(lines[0].total).toBe(50000);
  });

  it('keeps different options in separate rows', () => {
    const lines = groupOrderLines([
      detail({ id: 1, selectedOptions: [{ id: 1, name: 'Sin cebolla', categoryName: 'Extras' }] }),
      detail({ id: 2, selectedOptions: [{ id: 2, name: 'Con queso', categoryName: 'Extras' }] }),
    ]);

    expect(lines).toHaveLength(2);
    expect(lines.map((line) => line.options.join(','))).toEqual(['Sin cebolla', 'Con queso']);
  });

  it('keeps different instructions in separate rows', () => {
    const lines = groupOrderLines([
      detail({ id: 1, instructions: 'Sin sal' }),
      detail({ id: 2, instructions: '' }),
    ]);

    expect(lines).toHaveLength(2);
    expect(lines[0].instructions).toBe('Sin sal');
  });

  it('resolves combo products, additions and clarifications', () => {
    const lines = groupOrderLines([
      detail({
        selectedProducts: [{ id: 7, name: 'Ensalada', basePrice: { amount: '3000.00', currency: 'COP' } }],
        additionsResolved: [
          {
            id: 9,
            name: 'Queso',
            extraPrice: { amount: '2000.00', currency: 'COP' },
            optionName: 'Adiciones',
          },
        ],
        clarifications: [{ questionId: 1, question: 'Término', answer: 'Tres cuartos' }],
      }),
    ]);

    expect(lines[0].combos).toEqual(['Ensalada']);
    expect(lines[0].additions).toEqual(['Adiciones: Queso']);
    expect(lines[0].clarifications).toEqual(['Término: Tres cuartos']);
  });

  it('falls back to the selected addition name when it is not resolved', () => {
    const lines = groupOrderLines([
      detail({
        selectedAdditions: [{ id: 5, name: 'Tocineta', extraPrice: { amount: '1500.00', currency: 'COP' } }],
      }),
    ]);

    expect(lines[0].additions).toEqual(['Tocineta']);
  });

  it('normalizes null instructions and product names from the wire', () => {
    const lines = groupOrderLines([
      {
        ...detail(),
        instructions: null,
        productName: null,
      } as unknown as OrderDetailItem,
    ]);

    expect(lines[0].instructions).toBe('');
    expect(lines[0].name).toBe('Producto');
  });

  it('sums the physical item count across grouped lines', () => {
    const lines = groupOrderLines([
      detail({ id: 1 }),
      detail({ id: 2 }),
      detail({ id: 3, productId: 11, productName: 'Café', unitPrice: 2500 }),
    ]);

    expect(countOrderItems(lines)).toBe(3);
  });
});

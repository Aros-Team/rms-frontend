/**
 * Tests for the ProductCostResponse DTO type contract.
 *
 * Feature: TypeScript interface for product cost responses.
 * Contract: Money fields use the wire `MoneyDto` shape (`amount` is a decimal string).
 * Approach: Create objects matching DTO interfaces and normalize them with `toAmount`.
 */
import { toAmount } from '@app/shared/models/dto/common/money';
import type { CostItem, CostItemType, ProductCostResponse } from './product-cost-response';

describe('ProductCostResponse DTO contract', () => {
  it('accepts the backend production-cost shape', () => {
    const payload: ProductCostResponse = {
      productId: 1,
      totalCost: { amount: '25.75', currency: 'COP' },
      materialCost: { amount: '15.50', currency: 'COP' },
      laborCost: { amount: '10.25', currency: 'COP' },
      breakdown: [
        {
          description: 'Material: variant 3',
          amount: { amount: '15.50', currency: 'COP' },
          type: 'MATERIAL',
        },
        {
          description: 'Labor: kitchen',
          amount: { amount: '10.25', currency: 'COP' },
          type: 'LABOR',
        },
      ],
    };

    expect(payload.productId).toBe(1);
    expect(toAmount(payload.totalCost)).toBe(25.75);
    expect(toAmount(payload.materialCost)).toBe(15.5);
    expect(toAmount(payload.laborCost)).toBe(10.25);
    expect(payload.breakdown).toHaveLength(2);
  });

  it('constrains CostItem.type to MATERIAL or LABOR', () => {
    const item: CostItem = {
      description: 'Material: variant 3',
      amount: { amount: '15.50', currency: 'COP' },
      type: 'MATERIAL',
    };

    expectTypeOf<CostItem['type']>().toEqualTypeOf<CostItemType>();
    expectTypeOf<CostItemType>().toEqualTypeOf<'MATERIAL' | 'LABOR'>();
    expect(item.type).toBe('MATERIAL');
  });
});

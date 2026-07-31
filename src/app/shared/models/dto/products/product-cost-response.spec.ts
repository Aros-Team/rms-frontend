import type {
  CostItem,
  CostItemType,
  ProductCostResponse,
} from './product-cost-response';

describe('ProductCostResponse DTO contract', () => {
  it('accepts the backend production-cost shape', () => {
    const payload: ProductCostResponse = {
      productId: 1,
      totalCost: 25.75,
      materialCost: 15.5,
      laborCost: 10.25,
      breakdown: [
        { description: 'Material: variant 3', amount: 15.5, type: 'MATERIAL' },
        { description: 'Labor: kitchen', amount: 10.25, type: 'LABOR' },
      ],
    };

    expect(payload.productId).toBe(1);
    expect(payload.totalCost).toBe(25.75);
    expect(payload.materialCost).toBe(15.5);
    expect(payload.laborCost).toBe(10.25);
    expect(payload.breakdown).toHaveLength(2);
  });

  it('constrains CostItem.type to MATERIAL or LABOR', () => {
    const item: CostItem = {
      description: 'Material: variant 3',
      amount: 15.5,
      type: 'MATERIAL',
    };

    expectTypeOf<CostItem['type']>().toEqualTypeOf<CostItemType>();
    expectTypeOf<CostItemType>().toEqualTypeOf<'MATERIAL' | 'LABOR'>();
    expect(item.type).toBe('MATERIAL');
  });
});
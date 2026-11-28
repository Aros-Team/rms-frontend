/**
 * Tests for the kitchen line model.
 *
 * Feature: a ticket must be unambiguous at a glance: quantity, options, combo
 * contents, additions, clarification answers and the cook note.
 * Contract:
 *  - repeated identical rows collapse into one line with a quantity;
 *  - a different note or option keeps a separate line;
 *  - station comes from the API line, with the catalogue as fallback;
 *  - readiness is tracked per physical row;
 *  - empty/null labels never render "null".
 */
import type { OrderDetailItem } from '@app/shared/models/dto/orders/order-response';
import type { ProductListResponse } from '@app/shared/models/dto/products/product-list-response';

import {
  groupKitchenLines,
  isLineReady,
  lineReadyAt,
  pendingDetailIds,
  totalKitchenItems,
} from './kitchen-lines';
import { buildStationMap } from './kitchen-stations';

const PRICE = { amount: '10000.00', currency: 'COP' };

const PRODUCTS: ProductListResponse[] = [
  {
    id: 1,
    name: 'Hamburguesa',
    basePrice: PRICE,
    active: true,
    categoryId: 1,
    categoryName: 'Hamburguesas',
    areaId: 1,
    areaName: 'Cocina',
  },
  {
    id: 2,
    name: 'Limonada',
    basePrice: PRICE,
    active: true,
    categoryId: 6,
    categoryName: 'Bebidas',
    areaId: 3,
    areaName: 'Bar',
  },
];

const stations = buildStationMap(PRODUCTS);

function line(overrides: Partial<OrderDetailItem> = {}): OrderDetailItem {
  return {
    id: 1,
    productId: 1,
    productName: 'Hamburguesa',
    unitPrice: PRICE,
    instructions: '',
    ...overrides,
  };
}

describe('kitchen lines', () => {
  it('collapses repeated identical rows into a quantity', () => {
    const lines = groupKitchenLines(
      [line({ id: 1 }), line({ id: 2 }), line({ id: 3, instructions: 'Sin cebolla' })],
      stations,
    );

    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({
      name: 'Hamburguesa',
      quantity: 2,
      station: { name: 'Cocina' },
    });
    expect(lines[1]).toMatchObject({
      quantity: 1,
      note: 'Sin cebolla',
      station: { name: 'Cocina' },
    });
    expect(totalKitchenItems(lines)).toBe(3);
  });

  it('reads options with their group name', () => {
    const [burger] = groupKitchenLines(
      [
        line({
          selectedOptions: [
            { id: 39, name: 'Yuca Frita 150g', categoryName: 'Guarnición' },
            { id: 40, name: 'Sin tomate', categoryName: 'Sin tomate' },
          ],
        }),
      ],
      stations,
    );

    expect(burger.options).toEqual(['Guarnición: Yuca Frita 150g', 'Sin tomate']);
  });

  it('reads combo products, additions, clarifications and notes', () => {
    const [combo] = groupKitchenLines(
      [
        line({
          productId: 2,
          productName: 'Combo familiar',
          selectedProductIds: [1, 2],
          selectedProducts: [
            { id: 1, name: 'Hamburguesa', basePrice: PRICE },
            { id: 2, name: null, basePrice: null },
          ],
          additionIds: [5],
          selectedAdditions: [{ id: 5, name: 'Queso extra', extraPrice: PRICE }],
          clarifications: [{ questionId: 7, question: 'Término', answer: 'Tres cuartos' }],
          instructions: 'Empacar para llevar',
        }),
      ],
      stations,
    );

    expect(combo.station.name).toBe('Bar');
    expect(combo.combos).toEqual(['Hamburguesa']);
    expect(combo.additions).toEqual(['Queso extra']);
    expect(combo.clarifications).toEqual([{ question: 'Término', answer: 'Tres cuartos' }]);
    expect(combo.note).toBe('Empacar para llevar');
  });

  it('falls back to a readable name and never emits an empty option label', () => {
    const [unnamed] = groupKitchenLines(
      [
        line({
          productId: 999,
          productName: '   ',
          selectedOptions: [{ id: 1, name: ' ', categoryName: '' }],
        }),
      ],
      stations,
    );

    expect(unnamed.name).toBe('Producto #999');
    expect(unnamed.station.name).toBe('Sin estación');
    expect(unnamed.options).toEqual([]);
  });

  it('keeps two combos of the same product separate by their resolved contents', () => {
    const lines = groupKitchenLines(
      [
        line({
          id: 1,
          productId: 2,
          productName: 'Combo',
          selectedProducts: [{ id: 1, name: 'Hamburguesa', basePrice: PRICE }],
        }),
        line({
          id: 2,
          productId: 2,
          productName: 'Combo',
          selectedProducts: [{ id: 2, name: null, basePrice: PRICE }],
        }),
      ],
      stations,
    );

    expect(lines).toHaveLength(2);
    expect(lines.map((combo) => combo.quantity)).toEqual([1, 1]);
  });

  it('tolerates the wire sending a null note for a plain line', () => {
    const [plain] = groupKitchenLines(
      [line({ instructions: null as unknown as string })],
      stations,
    );

    expect(plain.note).toBe('');
  });

  it('tolerates a null product name and keeps a readable fallback', () => {
    const [lineWithoutName] = groupKitchenLines(
      [line({ productId: 77, productName: null })],
      stations,
    );

    expect(lineWithoutName.name).toBe('Producto #77');
  });

  it('keeps every physical row readiness on a grouped line', () => {
    const [grouped] = groupKitchenLines(
      [line({ id: 1, ready: true, readyAt: '2026-11-22T12:00:00' }), line({ id: 2, ready: false })],
      stations,
    );

    expect(grouped.quantity).toBe(2);
    expect(grouped.details).toEqual([
      { id: 1, ready: true, readyAt: '2026-11-22T12:00:00', preparationStartedAt: null },
      { id: 2, ready: false, readyAt: null, preparationStartedAt: null },
    ]);
    expect(isLineReady(grouped)).toBe(false);
    expect(pendingDetailIds(grouped)).toEqual([2]);
    expect(lineReadyAt(grouped)).toBeNull();

    const bothReady = {
      ...grouped,
      details: grouped.details.map((detail) => ({ ...detail, ready: true })),
    };
    expect(isLineReady(bothReady)).toBe(true);
    expect(lineReadyAt(bothReady)).toBe('2026-11-22T12:00:00');
  });
});

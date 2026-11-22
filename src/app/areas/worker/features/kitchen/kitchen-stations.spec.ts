/**
 * Tests for the kitchen station model.
 *
 * Feature: the board groups every order line by the preparation station, even
 * though the order API has no station field.
 * Contract:
 *  - `productId -> preparation area` comes from the product catalogue;
 *  - a product without an area falls back to its category, then "Sin estación";
 *  - a line already carrying `categoryName` uses it instead of "Sin estación";
 *  - station counts include an order once per station and keep empty stations;
 *  - station order is stable (prep areas first, unknown last).
 */
import type { OrderDetailItem, OrderResponse } from '@app/shared/models/dto/orders/order-response';
import type { ProductListResponse } from '@app/shared/models/dto/products/product-list-response';

import {
  UNKNOWN_STATION,
  buildStationMap,
  groupLinesByStation,
  orderHasStation,
  orderStations,
  stationCounts,
  stationForDetail,
  stationFromProduct,
  type KitchenStation,
} from './kitchen-stations';

const PRICE = { amount: '10000.00', currency: 'COP' };

function product(overrides: Partial<ProductListResponse> & Pick<ProductListResponse, 'id' | 'name'>): ProductListResponse {
  return {
    basePrice: PRICE,
    active: true,
    categoryId: 0,
    categoryName: '',
    areaId: 0,
    ...overrides,
  };
}

function detail(productId: number, categoryName = '', categoryId = 0): OrderDetailItem {
  return {
    id: productId * 100,
    productId,
    productName: `Producto ${String(productId)}`,
    unitPrice: PRICE,
    instructions: '',
    categoryId: categoryId > 0 ? categoryId : null,
    categoryName: categoryName.length > 0 ? categoryName : null,
  };
}

function order(id: number, details: OrderDetailItem[]): OrderResponse {
  return { id, date: '2026-01-01T12:00:00', status: 'QUEUE', tableId: 1, details };
}

const PRODUCTS: ProductListResponse[] = [
  product({ id: 1, name: 'Hamburguesa', areaId: 1, areaName: 'Cocina', categoryId: 1, categoryName: 'Hamburguesas' }),
  product({ id: 2, name: 'Limonada', areaId: 3, areaName: 'Bar', categoryId: 6, categoryName: 'Bebidas' }),
  product({ id: 3, name: 'Suelto', areaId: 0, categoryId: 2, categoryName: 'Platos' }),
  product({ id: 4, name: 'Sin datos', areaId: 0, categoryId: 0, categoryName: '' }),
];

describe('kitchen stations', () => {
  const map = buildStationMap(PRODUCTS);

  it('resolves a product to its preparation area', () => {
    expect(stationFromProduct(PRODUCTS[0])).toEqual({ key: 'area:1', name: 'Cocina', rank: 1 });
    expect(map.get(2)).toEqual({ key: 'area:3', name: 'Bar', rank: 3 });
  });

  it('falls back to the category and finally to "Sin estación"', () => {
    expect(stationFromProduct(PRODUCTS[2])).toEqual({ key: 'category:2', name: 'Platos', rank: 1002 });
    expect(stationFromProduct(PRODUCTS[3])).toBe(UNKNOWN_STATION);
    expect(
      stationFromProduct({
        ...PRODUCTS[2],
        id: 5,
        categoryId: 9,
        categoryName: null as unknown as string,
      }),
    ).toEqual({ key: 'category:9', name: 'Categoría 9', rank: 1009 });
  });

  it('uses the category fields on an order line when the catalogue lacks the product', () => {
    expect(stationForDetail(detail(99, 'Postres', 8), map)).toEqual({
      key: 'category:8',
      name: 'Postres',
      rank: 1008,
    });
    expect(stationForDetail(detail(99, 'Postres'), map).key).toBe('category:Postres');
    expect(stationForDetail(detail(99), map)).toBe(UNKNOWN_STATION);
  });

  it('groups lines by station in a stable order', () => {
    const lines: { station: KitchenStation }[] = [
      { station: { key: 'area:3', name: 'Bar', rank: 3 } },
      { station: { key: 'area:1', name: 'Cocina', rank: 1 } },
      { station: { key: 'area:3', name: 'Bar', rank: 3 } },
    ];

    expect(groupLinesByStation(lines).map((group) => [group.station.name, group.items.length])).toEqual([
      ['Cocina', 1],
      ['Bar', 2],
    ]);
  });

  it('finds each station of an order and tests the filter', () => {
    const mixed = order(10, [detail(1), detail(2)]);

    expect(orderStations(mixed, map).map((station) => station.name)).toEqual(['Cocina', 'Bar']);
    expect(orderHasStation(mixed, 'area:1', map)).toBe(true);
    expect(orderHasStation(mixed, 'area:3', map)).toBe(true);
    expect(orderHasStation(mixed, 'category:2', map)).toBe(false);
  });

  it('counts an order once per station and keeps stations with no orders', () => {
    const counts = stationCounts(
      {
        queue: [order(10, [detail(1), detail(2)])],
        preparing: [order(11, [detail(1)])],
        ready: [],
      },
      map,
    );

    expect(counts.map((station) => [station.name, station.queue, station.preparing, station.ready, station.total])).toEqual([
      ['Cocina', 1, 1, 0, 2],
      ['Bar', 1, 0, 0, 1],
      ['Platos', 0, 0, 0, 0],
    ]);
    expect(counts.some((station) => station.key === 'unknown')).toBe(false);
  });

  it('adds an unknown station only when an active line needs it', () => {
    const counts = stationCounts(
      { queue: [order(10, [detail(4)])], preparing: [], ready: [] },
      map,
    );

    expect(counts.at(-1)).toMatchObject({ key: 'unknown', name: 'Sin estación', total: 1 });
  });
});

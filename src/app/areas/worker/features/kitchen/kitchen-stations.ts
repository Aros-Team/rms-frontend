import type { OrderDetailItem, OrderResponse } from '@app/shared/models/dto/orders/order-response';
import type { ProductListResponse } from '@app/shared/models/dto/products/product-list-response';

/**
 * Kitchen station model.
 *
 * The order API does not carry a station/area on each line
 * (`OrderDetailResponse` has no `areaId`/`areaName`), but the product catalogue
 * does: every product has `areaId` + `areaName`, and a category fallback when
 * the area is missing. This module resolves `productId -> station` once and
 * every board surface groups by it.
 *
 * If the catalogue fails to load, or a product is unknown, the line is grouped
 * under "Sin estación" instead of being dropped. When the API eventually adds
 * `categoryId`/`categoryName` to the order line, `stationForDetail` already
 * uses the category instead of "Sin estación".
 */
export interface KitchenStation {
  /** Stable key: `area:<id>`, `category:<id>` or `unknown`. */
  key: string;
  name: string;
  /** Ordering hint: prep areas first, then category fallbacks, unknown last. */
  rank: number;
}

export const UNKNOWN_STATION: KitchenStation = {
  key: 'unknown',
  name: 'Sin estación',
  rank: 10_000,
};

/** `productId -> station` for the whole catalogue. */
export type KitchenStationMap = ReadonlyMap<number, KitchenStation>;

export function stationFromProduct(product: ProductListResponse): KitchenStation {
  if (typeof product.areaId === 'number' && product.areaId > 0) {
    const name = product.areaName?.trim();
    return {
      key: `area:${String(product.areaId)}`,
      name: name && name.length > 0 ? name : `Área ${String(product.areaId)}`,
      rank: product.areaId,
    };
  }

  if (typeof product.categoryId === 'number' && product.categoryId > 0) {
    const rawCategoryName: unknown = product.categoryName;
    const categoryName = typeof rawCategoryName === 'string' ? rawCategoryName.trim() : '';
    return {
      key: `category:${String(product.categoryId)}`,
      name: categoryName.length > 0 ? categoryName : `Categoría ${String(product.categoryId)}`,
      rank: 1000 + product.categoryId,
    };
  }

  return UNKNOWN_STATION;
}

export function buildStationMap(products: readonly ProductListResponse[]): KitchenStationMap {
  const map = new Map<number, KitchenStation>();
  for (const product of products) {
    map.set(product.id, stationFromProduct(product));
  }
  return map;
}

/**
 * Station of an order line.
 *
 * Prefers the catalogue (product -> preparation area). Falls back to the
 * category fields if the API starts sending them on the order line, and
 * finally to "Sin estación".
 */
export function stationForDetail(
  detail: Pick<OrderDetailItem, 'productId' | 'categoryId' | 'categoryName'>,
  stations: KitchenStationMap,
): KitchenStation {
  const productStation = stations.get(detail.productId);
  if (productStation) return productStation;

  const categoryName = (detail.categoryName ?? '').trim();

  if (typeof detail.categoryId === 'number' && detail.categoryId > 0) {
    return {
      key: `category:${String(detail.categoryId)}`,
      name: categoryName.length > 0 ? categoryName : `Categoría ${String(detail.categoryId)}`,
      rank: 1000 + detail.categoryId,
    };
  }

  if (categoryName.length > 0) {
    return { key: `category:${categoryName}`, name: categoryName, rank: 1500 };
  }

  return UNKNOWN_STATION;
}

export interface StationGroup<T> {
  station: KitchenStation;
  items: T[];
}

function compareStations(left: KitchenStation, right: KitchenStation): number {
  if (left.rank !== right.rank) return left.rank - right.rank;
  return left.name.localeCompare(right.name, 'es');
}

/** Groups already-resolved lines by station, keeping station order stable. */
export function groupLinesByStation<T extends { station: KitchenStation }>(
  lines: readonly T[],
): StationGroup<T>[] {
  const groups = new Map<string, StationGroup<T>>();
  for (const line of lines) {
    const current = groups.get(line.station.key);
    if (current) {
      current.items.push(line);
      continue;
    }
    groups.set(line.station.key, { station: line.station, items: [line] });
  }
  return [...groups.values()].sort((left, right) => compareStations(left.station, right.station));
}

/** Unique stations present in an order, in board order. */
export function orderStations(
  order: Pick<OrderResponse, 'details'>,
  stations: KitchenStationMap,
): KitchenStation[] {
  const found = new Map<string, KitchenStation>();
  for (const detail of order.details) {
    const station = stationForDetail(detail, stations);
    found.set(station.key, station);
  }
  return [...found.values()].sort(compareStations);
}

export interface StationCount {
  key: string;
  name: string;
  rank: number;
  queue: number;
  preparing: number;
  ready: number;
  total: number;
}

export interface StationColumns {
  queue: readonly OrderResponse[];
  preparing: readonly OrderResponse[];
  ready: readonly OrderResponse[];
}

/**
 * Counts active orders per station.
 *
 * Each order counts once per station it contains, so an order with a burger
 * and a drink appears in both Cocina and Bar. Stations with zero active orders
 * stay in the list, so the filter does not disappear between services.
 */
export function stationCounts(
  columns: StationColumns,
  stations: KitchenStationMap,
): StationCount[] {
  const index = new Map<string, StationCount>();
  for (const station of stations.values()) {
    // "Sin estación" is only useful when a line actually needs it; keeping it
    // in the filter for every service would be a permanent dead chip.
    if (station.key === UNKNOWN_STATION.key) continue;
    index.set(station.key, {
      key: station.key,
      name: station.name,
      rank: station.rank,
      queue: 0,
      preparing: 0,
      ready: 0,
      total: 0,
    });
  }

  const apply = (orders: readonly OrderResponse[], column: 'queue' | 'preparing' | 'ready'): void => {
    for (const order of orders) {
      for (const station of orderStations(order, stations)) {
        let count = index.get(station.key);
        if (!count) {
          count = { key: station.key, name: station.name, rank: station.rank, queue: 0, preparing: 0, ready: 0, total: 0 };
          index.set(station.key, count);
        }
        count[column] += 1;
        count.total += 1;
      }
    }
  };

  apply(columns.queue, 'queue');
  apply(columns.preparing, 'preparing');
  apply(columns.ready, 'ready');

  return [...index.values()].sort((left, right) => {
    if (left.rank !== right.rank) return left.rank - right.rank;
    return left.name.localeCompare(right.name, 'es');
  });
}

/** `true` when the order has at least one line in the given station. */
export function orderHasStation(
  order: OrderResponse,
  stationKey: string,
  stations: KitchenStationMap,
): boolean {
  return orderStations(order, stations).some((station) => station.key === stationKey);
}

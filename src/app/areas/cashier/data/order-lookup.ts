import { Injectable, inject } from '@angular/core';
import { EMPTY, Observable, expand, of, reduce, tap } from 'rxjs';

import { Order, type OrderQuery } from '@app/core/services/orders/order';
import type { OrderResponse } from '@app/shared/models/dto/orders/order-response';
import type { PendingOrderResponse } from '@app/shared/models/dto/payments/pending-order-response';

/** Bounded walk size: one page covers a normal cashier day. */
const LOOKUP_PAGE_SIZE = 100;

/** Hard cap on lookup pages (100 × 20 = 2,000 orders for one day). */
const MAX_LOOKUP_PAGES = 20;

/**
 * Resolves the full detail of a pending order for the cashier review.
 *
 * Contract gap (documented in the lane report): the payments API exposes only
 * the pending **summary** (order id, table, total), and the orders API has no
 * usable `GET /orders/{id}`. The cashier therefore walks the day's delivered
 * orders through the existing order flow and picks the requested id.
 *
 * The window is `[date 00:00:00, pending.deliveredAt]`, not the end of the day:
 * the orders API rejects an `endDate` in its own future, and the browser may be
 * in a different timezone than the business (D-021). The pending order's own
 * timestamp is always in the server's past, so the query is safe.
 *
 * The order detail is display-only. Totals never come from here: the charge
 * preview uses `order.total`, and the receipt uses the payment response.
 */
@Injectable({ providedIn: 'root' })
export class CashierOrderLookup {
  private readonly orders = inject(Order);
  private readonly cache = new Map<number, OrderResponse>();

  /** Finds the full order for a pending row, or `null` when it is not found. */
  find(pending: PendingOrderResponse): Observable<OrderResponse | null> {
    const cached = this.cache.get(pending.orderId);
    if (cached !== undefined) {
      return of(cached);
    }

    const businessDate = pending.deliveredAt.slice(0, 10);
    const query: OrderQuery = {
      status: 'DELIVERED',
      startDate: `${businessDate}T00:00:00`,
      endDate: pending.deliveredAt,
      size: LOOKUP_PAGE_SIZE,
      sort: 'date,asc',
    };

    let found: OrderResponse | null = null;

    return this.orders.getOrdersPage({ ...query, page: 0 }).pipe(
      expand((page, index) => {
        found = found ?? page.items.find((order) => order.id === pending.orderId) ?? null;
        if (found !== null) return EMPTY;

        const nextPage = index + 1;
        if (nextPage >= MAX_LOOKUP_PAGES) return EMPTY;
        if (page.items.length === 0) return EMPTY;
        if (page.items.length < LOOKUP_PAGE_SIZE) return EMPTY;
        if (page.totalPages > 0 && nextPage >= page.totalPages) return EMPTY;
        if (page.total > 0 && nextPage * LOOKUP_PAGE_SIZE >= page.total) return EMPTY;

        return this.orders.getOrdersPage({ ...query, page: nextPage });
      }),
      reduce(
        (match: OrderResponse | null, page) =>
          match ?? page.items.find((order) => order.id === pending.orderId) ?? null,
        null,
      ),
      tap((order) => {
        if (order !== null) this.cache.set(order.id, order);
      }),
    );
  }

  /** Caches an order already loaded by another flow (e.g. after a charge). */
  remember(order: OrderResponse): void {
    this.cache.set(order.id, order);
  }

  /** Drops one cached order (used when its lines may have changed). */
  forget(orderId: number): void {
    this.cache.delete(orderId);
  }

  /** Drops the whole cache (date or data changes). */
  clear(): void {
    this.cache.clear();
  }
}

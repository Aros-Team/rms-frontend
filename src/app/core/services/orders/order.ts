import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { EMPTY, Observable, expand, map, reduce } from 'rxjs';

import { Logging } from '@app/core/services/logging/logging';
import { OrderResponse } from '@app/shared/models/dto/orders/order-response';
import { UpdateOrderRequest } from '@app/shared/models/dto/orders/update-order-status';
import { CreateOrderRequest } from '@app/shared/models/dto/orders/create-order-request';
import { type Page, type PageEnvelope, unwrapPage } from '@app/shared/models/dto/common/pagination';

export type OrderStatus = 'QUEUE' | 'PREPARING' | 'READY' | 'DELIVERED' | 'CANCELLED';

/** Default page size for order lists (matches `docs/architecture.md` §10.9). */
export const DEFAULT_ORDERS_PAGE_SIZE = 50;

/**
 * Hard cap on pages walked by the aggregation helpers (`getAllTodayOrders()`,
 * `getAllOrdersByDateRange()`). Guards against an unbounded walk if the backend
 * ever reports a bogus `total` or ignores the `page` parameter.
 *
 * The cap is applied to the *walk index*, never to the page number echoed by the
 * server: a backend that always replies `page: 0` must not defeat the bound.
 */
export const MAX_ORDER_PAGES = 40;

/** Result of a bounded, multi-page walk. */
export interface OrderCollection {
  items: OrderResponse[];
  /** Server-reported total for the query (never less than `items.length`). */
  total: number;
  /**
   * `true` when the walk hit `MAX_ORDER_PAGES` before reaching `total`, i.e.
   * `items` is a prefix of the real result set. Callers must surface this in the
   * UI instead of pretending the list is complete.
   */
  truncated: boolean;
}

/** Server-side query for `GET /v1/orders`. */
export interface OrderQuery {
  page?: number;
  size?: number;
  sort?: string;
  status?: string;
  search?: string;
  /**
   * Preparation area (station) filter. The server returns every order with at
   * least one line prepared in that area; the ticket keeps all its lines.
   */
  areaId?: number;
  /** `YYYY-MM-DDTHH:mm:ss` */
  startDate?: string;
  /** `YYYY-MM-DDTHH:mm:ss` */
  endDate?: string;
}

@Injectable({ providedIn: 'root' })
export class Order {
  private http = inject(HttpClient);
  private log = inject(Logging);

  private formatDateLocal(d: Date): string {
    const y = String(d.getFullYear());
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  /** Formats a Date as local ISO‑like string: YYYY‑MM‑DDTHH:mm:ss */
  private toLocalISO(d: Date): string {
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${this.formatDateLocal(d)}T${hh}:${mm}:${ss}`;
  }

  private buildParams(query: OrderQuery): HttpParams {
    let httpParams = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') {
        httpParams = httpParams.set(key, String(value));
      }
    }
    return httpParams;
  }

  // ── Paged API (preferred) ────────────────────────────────────────────────

  /**
   * Single page of orders. Normalizes the backend pagination envelope
   * (`{ items, total, page, size, total_pages }`) through `unwrapPage`, so the
   * caller always receives `total` and `totalPages`.
   */
  getOrdersPage(query: OrderQuery = {}): Observable<Page<OrderResponse>> {
    const { page = 0, size = DEFAULT_ORDERS_PAGE_SIZE, sort = 'date,desc', ...rest } = query;
    const params = this.buildParams({ ...rest, page, size, sort });
    return this.http
      .get<PageEnvelope<OrderResponse>>('v1/orders', { params })
      .pipe(map((res) => unwrapPage<OrderResponse>(res)));
  }

  /** Single page of today's orders (00:00:00 → now). */
  getTodayOrdersPage(query: OrderQuery = {}): Observable<Page<OrderResponse>> {
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    return this.getOrdersPage({
      ...query,
      startDate: this.toLocalISO(today),
      endDate: this.toLocalISO(now),
    });
  }

  /** Single page of orders inside a date range, capped to "now" for today. */
  getOrdersByDateRangePage(
    startDate: Date,
    endDate: Date,
    query: OrderQuery = {},
  ): Observable<Page<OrderResponse>> {
    const now = new Date();
    const endOfDay = new Date(endDate);
    endOfDay.setHours(23, 59, 59, 999);
    const effectiveEnd = endOfDay > now ? now : endOfDay;

    return this.getOrdersPage({
      ...query,
      startDate: `${this.formatDateLocal(startDate)}T00:00:00`,
      endDate: this.toLocalISO(effectiveEnd),
    });
  }

  // ── Aggregation helpers ──────────────────────────────────────────────────

  /**
   * Every order of today, walked page by page.
   *
   * Used by aggregates (dashboard KPIs, sales composition) that need the whole
   * day, not a single page. Replaces the old `size: 500` firehose: each request
   * is a normal page, and the walk stops at `totalPages`/`total` or
   * `MAX_ORDER_PAGES`.
   *
   * Note: this drops the `truncated` flag. Callers whose numbers would be wrong
   * on a capped walk (i.e. every aggregate) must use
   * `getAllOrdersByDateRange(today, today)` and surface the flag in the UI.
   */
  getAllTodayOrders(): Observable<OrderResponse[]> {
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    return this.getAllOrdersByDateRange(today, now).pipe(map((result) => result.items));
  }

  /**
   * Every order in a date range, walked page by page (bounded).
   *
   * The array-based list API (`getOrdersByDateRange`) only returns the first
   * page; screens that render "the day" as a list must use this instead, or the
   * list is silently truncated. The returned `truncated` flag says whether the
   * `MAX_ORDER_PAGES` cap was hit, so the caller can tell the user instead of
   * hiding rows.
   */
  getAllOrdersByDateRange(
    startDate: Date,
    endDate: Date,
    query: OrderQuery = {},
  ): Observable<OrderCollection> {
    const now = new Date();
    const endOfDay = new Date(endDate);
    endOfDay.setHours(23, 59, 59, 999);
    const effectiveEnd = endOfDay > now ? now : endOfDay;

    return this.collectAllPages({
      ...query,
      startDate: `${this.formatDateLocal(startDate)}T00:00:00`,
      endDate: this.toLocalISO(effectiveEnd),
      sort: query.sort ?? 'date,desc',
    });
  }

  /**
   * Every order with a given status, walked page by page (bounded).
   *
   * Column-based operational screens (kitchen QUEUE / PREPARING / READY) need
   * the full set for their status: the array API (`getOrdersByStatus`) returns
   * only the first page, which silently hides the tail of a long column.
   * `truncated` reports a capped walk so the caller can label the list.
   */
  getAllOrdersByStatus(status: string, query: OrderQuery = {}): Observable<OrderCollection> {
    return this.collectAllPages({ ...query, status });
  }

  /**
   * Walks pages until the result set is exhausted or `MAX_ORDER_PAGES` is hit.
   *
   * Termination is driven by the **expand index**, not by the page number the
   * server echoes back: a backend that ignores `page` (always replying `page: 0`
   * with a large `total`) would otherwise keep the walk alive forever. The walk
   * also stops as soon as the server returns an empty page or a short page.
   */
  private collectAllPages(query: OrderQuery): Observable<OrderCollection> {
    const size = query.size ?? DEFAULT_ORDERS_PAGE_SIZE;
    return this.getOrdersPage({ ...query, page: 0, size }).pipe(
      expand((page: Page<OrderResponse>, index: number) => {
        const nextPage = index + 1;

        // Bound on the number of requests issued, not on the echoed page index.
        if (nextPage >= MAX_ORDER_PAGES) return EMPTY;
        // Nothing left to fetch.
        if (page.items.length === 0) return EMPTY;
        // Short page ⇒ this was the last one.
        if (page.items.length < size) return EMPTY;
        // Server told us how many pages exist.
        if (page.totalPages > 0 && nextPage >= page.totalPages) return EMPTY;
        // Server told us how many rows exist.
        if (page.total > 0 && nextPage * size >= page.total) return EMPTY;

        return this.getOrdersPage({ ...query, page: nextPage, size });
      }),
      reduce(
        (acc: OrderCollection, page: Page<OrderResponse>) => ({
          items: [...acc.items, ...page.items],
          total: Math.max(acc.total, page.total, acc.items.length + page.items.length),
          truncated: false,
        }),
        { items: [], total: 0, truncated: false },
      ),
      map((acc) => ({ ...acc, truncated: acc.items.length < acc.total })),
    );
  }

  /** Total number of today's orders, without downloading them. */
  countTodayOrders(): Observable<number> {
    return this.getTodayOrdersPage({ page: 0, size: 1 }).pipe(map((page) => page.total));
  }

  // ── List API (kept for existing callers) ─────────────────────────────────
  //
  // These return the FIRST page only. They exist for callers that render a
  // small, filter-driven list (kitchen queue, waiter lookups) and do not need
  // pagination controls. Anything that needs the full result set must use
  // `getAllTodayOrders()` or the `*Page` variants above.

  /** First page of orders. */
  getOrders(page = 0, size = DEFAULT_ORDERS_PAGE_SIZE): Observable<OrderResponse[]> {
    return this.getOrdersPage({ page, size }).pipe(map((p) => p.items));
  }

  /** First page of orders with a given status. */
  getOrdersByStatus(
    status: string,
    page = 0,
    size = DEFAULT_ORDERS_PAGE_SIZE,
  ): Observable<OrderResponse[]> {
    return this.getOrdersPage({ status, page, size }).pipe(map((p) => p.items));
  }

  getOrdersByStatusOrAll(status?: string): Observable<OrderResponse[]> {
    return status ? this.getOrdersByStatus(status) : this.getOrders();
  }

  /**
   * Today's orders, first page only.
   *
   * @deprecated Truncates the day at one page. Use `getAllTodayOrders()` for
   * aggregates or `getTodayOrdersPage()` when you own the paging controls.
   */
  getTodayOrders(page = 0, size = DEFAULT_ORDERS_PAGE_SIZE): Observable<OrderResponse[]> {
    return this.getTodayOrdersPage({ page, size }).pipe(map((p) => p.items));
  }

  // NOTE: the old `getOrdersByDateRange(start, end, ...)` array method was
  // removed in favour of the two safe options above/below, because callers
  // treated its first page as the whole day (silent row loss):
  //   * `getOrdersByDateRangePage(start, end, query)` → one page + `total`;
  //   * `getAllOrdersByDateRange(start, end, query)`  → bounded page walk.

  createOrder(request: CreateOrderRequest): Observable<OrderResponse> {
    this.log.debug('Order: createOrder', request);
    return this.http.post<OrderResponse>('v1/orders', request);
  }

  prepareNext(): Observable<OrderResponse> {
    return this.http.put<OrderResponse>('v1/orders/prepare', {});
  }

  /**
   * Starts one specific QUEUE order (`PUT /v1/orders/{id}/prepare`).
   *
   * Unlike {@link prepareNext}, this does not claim the global oldest ticket,
   * so a station can start the order it is actually working on.
   */
  prepareOrder(id: number): Observable<OrderResponse> {
    return this.http.put<OrderResponse>(`v1/orders/${String(id)}/prepare`, {});
  }

  startDetail(orderId: number, detailId: number): Observable<OrderResponse> {
    return this.http.put<OrderResponse>(
      `v1/orders/${String(orderId)}/details/${String(detailId)}/start`,
      {},
    );
  }

  startArea(orderId: number, areaId: number): Observable<OrderResponse> {
    return this.http.put<OrderResponse>(
      `v1/orders/${String(orderId)}/areas/${String(areaId)}/start`,
      {},
    );
  }

  markAreaReady(orderId: number, areaId: number): Observable<OrderResponse> {
    return this.http.put<OrderResponse>(
      `v1/orders/${String(orderId)}/areas/${String(areaId)}/ready`,
      {},
    );
  }

  deliverDetail(orderId: number, detailId: number): Observable<OrderResponse> {
    return this.http.put<OrderResponse>(
      `v1/orders/${String(orderId)}/details/${String(detailId)}/deliver`,
      {},
    );
  }

  markAsReady(id: number): Observable<OrderResponse> {
    return this.http.put<OrderResponse>(`v1/orders/${String(id)}/ready`, {});
  }

  /**
   * Marks one order line ready at its station
   * (`PUT /v1/orders/{id}/details/{detailId}/ready`).
   *
   * The response is the whole order; when the last pending line becomes ready
   * the backend moves it to READY.
   */
  markDetailReady(orderId: number, detailId: number): Observable<OrderResponse> {
    return this.http.put<OrderResponse>(
      `v1/orders/${String(orderId)}/details/${String(detailId)}/ready`,
      {},
    );
  }

  deliverOrder(id: number): Observable<OrderResponse> {
    return this.http.put<OrderResponse>(`v1/orders/${String(id)}/deliver`, {});
  }

  cancelOrder(id: number): Observable<OrderResponse> {
    return this.http.put<OrderResponse>(`v1/orders/${String(id)}/cancel`, {});
  }

  /**
   * Replaces an order's table and details (`PUT /v1/orders/{id}`).
   *
   * The backend accepts the same body as `createOrder` (`{ tableId, details }`)
   * and returns the updated order; it is not a status-transition endpoint.
   */
  updateOrder(id: number, request: UpdateOrderRequest): Observable<OrderResponse> {
    return this.http.put<OrderResponse>(`v1/orders/${String(id)}`, request);
  }
}

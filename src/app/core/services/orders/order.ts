import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { Logging } from '@app/core/services/logging/logging';
import { OrderResponse } from '@app/shared/models/dto/orders/order-response';
import { UpdateOrderRequest } from '@app/shared/models/dto/orders/update-order-status';
import { CreateOrderRequest } from '@app/shared/models/dto/orders/create-order-request';

export type OrderStatus = 'QUEUE' | 'PREPARING' | 'READY' | 'DELIVERED' | 'CANCELLED';

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

  /**
   * Internal helper — calls the paginated /v1/orders endpoint and extracts items.
   */
  private queryOrders(params: Record<string, string | number>): Observable<OrderResponse[]> {
    let httpParams = new HttpParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== '') {
        httpParams = httpParams.set(key, String(value));
      }
    }
    return this.http.get<{ items: OrderResponse[] }>('v1/orders', { params: httpParams }).pipe(
      map(page => page.items)
    );
  }

  getOrders(): Observable<OrderResponse[]> {
    return this.queryOrders({ size: 50, sort: 'date,desc' });
  }

  getOrdersByStatus(status: string): Observable<OrderResponse[]> {
    return this.queryOrders({ status, size: 50, sort: 'date,desc' });
  }

  getOrdersByStatusOrAll(status?: string): Observable<OrderResponse[]> {
    return status ? this.getOrdersByStatus(status) : this.getOrders();
  }

  /** Today's orders from 00:00:00 until right now. */
  getTodayOrders(): Observable<OrderResponse[]> {
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    return this.queryOrders({
      startDate: this.toLocalISO(today),
      endDate: this.toLocalISO(now),
      size: 500,
      sort: 'date,desc',
    });
  }

  /**
   * Orders within a date range.  If the computed end‑of‑day is in the future
   * (e.g. the user picked today) the endDate is capped to the current time
   * so the backend doesn't reject it.
   */
  getOrdersByDateRange(startDate: Date, endDate: Date, status?: string): Observable<OrderResponse[]> {
    const now = new Date();
    const endOfDay = new Date(endDate);
    endOfDay.setHours(23, 59, 59, 999);
    const effectiveEnd = endOfDay > now ? now : endOfDay;

    const params: Record<string, string | number> = {
      startDate: `${this.formatDateLocal(startDate)}T00:00:00`,
      endDate: this.toLocalISO(effectiveEnd),
      size: 500,
      sort: 'date,desc',
    };
    if (status) params['status'] = status;
    return this.queryOrders(params);
  }

  createOrder(request: CreateOrderRequest): Observable<OrderResponse> {
    this.log.debug('Order: createOrder', request);
    return this.http.post<OrderResponse>('v1/orders', request);
  }

  prepareNext(): Observable<OrderResponse> {
    return this.http.put<OrderResponse>('v1/orders/prepare', {});
  }

  markAsReady(id: number): Observable<OrderResponse> {
    return this.http.put<OrderResponse>(`v1/orders/${String(id)}/ready`, {});
  }

  deliverOrder(id: number): Observable<OrderResponse> {
    return this.http.put<OrderResponse>(`v1/orders/${String(id)}/deliver`, {});
  }

  cancelOrder(id: number): Observable<OrderResponse> {
    return this.http.put<OrderResponse>(`v1/orders/${String(id)}/cancel`, {});
  }

  updateOrder(request: UpdateOrderRequest): Observable<void> {
    return this.http.put(`v1/orders/${String(request.id)}`, request).pipe(map(() => undefined));
  }
}
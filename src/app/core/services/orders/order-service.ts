import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { LoggingService } from '@app/core/services/logging/logging-service';
import { OrderResponse } from '@app/shared/models/dto/orders/order-response.model';
import { UpdateOrderRequest } from '@app/shared/models/dto/orders/update-order-status.model';
import { CreateOrderRequest } from '@app/shared/models/dto/orders/create-order-request.model';

export type OrderStatus = 'QUEUE' | 'PREPARING' | 'READY' | 'DELIVERED' | 'CANCELLED';

@Injectable({ providedIn: 'root' })
export class OrderService {
  private http = inject(HttpClient);
  private log = inject(LoggingService);

  // ── Consultas ──────────────────────────────────────────────

  getOrders(): Observable<OrderResponse[]> {
    return this.http.get<OrderResponse[]>('v1/orders');
  }

  getOrdersByStatus(status: string): Observable<OrderResponse[]> {
    return this.http.get<OrderResponse[]>(`v1/orders?status=${status}`);
  }

  getOrdersByStatusOrAll(status?: string): Observable<OrderResponse[]> {
    return status ? this.getOrdersByStatus(status) : this.getOrders();
  }

  getTodayOrders(): Observable<OrderResponse[]> {
    const today = new Date();
    const formatLocal = (d: Date): string => {
      const pad = (n: number) => n.toString().padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    };
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
    return this.http.get<OrderResponse[]>(`v1/orders?startDate=${formatLocal(start)}&endDate=${formatLocal(end)}`);
  }

  getOrdersByDateRange(startDate: Date, endDate: Date, status?: string): Observable<OrderResponse[]> {
    const formatLocal = (d: Date): string => {
      const pad = (n: number) => n.toString().padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    };
    const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59);
    let url = `v1/orders?startDate=${formatLocal(start)}&endDate=${formatLocal(end)}`;
    if (status) {
      url += `&status=${status}`;
    }
    return this.http.get<OrderResponse[]>(url);
  }

  // ── Crear ──────────────────────────────────────────────────

  createOrder(request: CreateOrderRequest): Observable<OrderResponse> {
    this.log.debug('OrderService: createOrder', request);
    return this.http.post<OrderResponse>('v1/orders', request);
  }

  // ── Ciclo de vida ──────────────────────────────────────────

  /** QUEUE → PREPARING: toma la orden más antigua de la cola */
  prepareNext(): Observable<OrderResponse> {
    return this.http.put<OrderResponse>('v1/orders/prepare', {});
  }

  /** PREPARING → READY */
  markAsReady(id: number): Observable<OrderResponse> {
    return this.http.put<OrderResponse>(`v1/orders/${id}/ready`, {});
  }

  /** READY → DELIVERED (libera la mesa) */
  deliverOrder(id: number): Observable<OrderResponse> {
    return this.http.put<OrderResponse>(`v1/orders/${id}/deliver`, {});
  }

  /** QUEUE → CANCELLED */
  cancelOrder(id: number): Observable<OrderResponse> {
    return this.http.put<OrderResponse>(`v1/orders/${id}/cancel`, {});
  }

  /** Actualizar orden (solo en QUEUE) */
  updateOrder(request: UpdateOrderRequest): Observable<void> {
    return this.http.put<void>(`v1/orders/${request.id}`, request);
  }

  // ── Stats ──────────────────────────────────────────────────

  getCompletedOrdersCount(): Observable<number> {
    return this.getOrdersByStatus('DELIVERED').pipe(map(o => o.length));
  }

  getPreparingOrdersCount(): Observable<number> {
    return this.getOrdersByStatus('PREPARING').pipe(map(o => o.length));
  }

  getTotalSales(): Observable<number> {
    return this.getTodayOrders().pipe(
      map(orders =>
        orders.filter(o => o.status === 'DELIVERED')
              .reduce((sum, o) => sum + (o.totalPrice ?? 0), 0)
      )
    );
  }
}

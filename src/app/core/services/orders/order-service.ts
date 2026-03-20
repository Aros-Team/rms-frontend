import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { LoggingService } from '@app/core/services/logging/logging-service';
import { OrderResponse, calculateTotalPrice } from '@app/shared/models/dto/orders/order-response.model';
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
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);
    
    const params = new HttpParams()
      .set('startDate', startOfDay.toISOString().replace('Z', ''))
      .set('endDate', endOfDay.toISOString().replace('Z', ''));
    
    return this.http.get<OrderResponse[]>('v1/orders', { params });
  }

  getOrdersByDateRange(startDate: Date, endDate: Date, status?: string): Observable<OrderResponse[]> {
    let params = new HttpParams();
    
    if (status) {
      params = params.set('status', status);
    }
    
    const startISO = this.toLocalDateTimeString(startDate, 'start');
    const endISO = this.toLocalDateTimeString(endDate, 'end');
    params = params.set('startDate', startISO);
    params = params.set('endDate', endISO);
    
    return this.http.get<OrderResponse[]>('v1/orders', { params });
  }
  
  private toLocalDateTimeString(date: Date, type: 'start' | 'end'): string {
    const d = new Date(date);
    if (type === 'start') {
      d.setHours(0, 0, 0, 0);
    } else {
      d.setHours(23, 59, 59, 999);
    }
    return d.toISOString().replace('Z', '');
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
              .reduce((sum, o) => sum + calculateTotalPrice(o), 0)
      )
    );
  }
}

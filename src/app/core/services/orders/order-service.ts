import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
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

  private toLocalDateString(date: Date): string {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private filterOrdersByDateRange(
    orders: OrderResponse[],
    startDate: Date,
    endDate: Date
  ): OrderResponse[] {
    const startStr = this.toLocalDateString(startDate);
    const endStr = this.toLocalDateString(endDate);

    return orders.filter(o => {
      const orderDateStr = this.toLocalDateString(new Date(o.date));
      return orderDateStr >= startStr && orderDateStr <= endStr;
    });
  }

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
    return this.getOrders().pipe(
      map(orders => this.filterOrdersByDateRange(orders, today, today))
    );
  }

  getOrdersByDateRange(startDate: Date, endDate: Date, status?: string): Observable<OrderResponse[]> {
    return this.getOrders().pipe(
      map(orders => {
        let filtered = this.filterOrdersByDateRange(orders, startDate, endDate);
        if (status) {
          filtered = filtered.filter(o => o.status === status);
        }
        return filtered;
      })
    );
  }

  createOrder(request: CreateOrderRequest): Observable<OrderResponse> {
    this.log.debug('OrderService: createOrder', request);
    return this.http.post<OrderResponse>('v1/orders', request);
  }

  prepareNext(): Observable<OrderResponse> {
    return this.http.put<OrderResponse>('v1/orders/prepare', {});
  }

  markAsReady(id: number): Observable<OrderResponse> {
    return this.http.put<OrderResponse>(`v1/orders/${id}/ready`, {});
  }

  deliverOrder(id: number): Observable<OrderResponse> {
    return this.http.put<OrderResponse>(`v1/orders/${id}/deliver`, {});
  }

  cancelOrder(id: number): Observable<OrderResponse> {
    return this.http.put<OrderResponse>(`v1/orders/${id}/cancel`, {});
  }

  updateOrder(request: UpdateOrderRequest): Observable<void> {
    return this.http.put<void>(`v1/orders/${request.id}`, request);
  }

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

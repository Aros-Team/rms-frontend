import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { Logging } from '@app/core/services/logging/logging';
import { OrderResponse, calculateTotalPrice } from '@app/shared/models/dto/orders/order-response.model';
import { UpdateOrderRequest } from '@app/shared/models/dto/orders/update-order-status.model';
import { CreateOrderRequest } from '@app/shared/models/dto/orders/create-order-request.model';

export type OrderStatus = 'QUEUE' | 'PREPARING' | 'READY' | 'DELIVERED' | 'CANCELLED';

@Injectable({ providedIn: 'root' })
export class Order {
  private http = inject(HttpClient);
  private log = inject(Logging);

  private toLocalDateString(dateStr: string): string {
    return dateStr.split('T')[0];
  }

  private filterOrdersByDateRange(
    orders: OrderResponse[],
    startDate: Date,
    endDate: Date
  ): OrderResponse[] {
    const startStr = this.toLocalDateString(startDate.toISOString());
    const endStr = this.toLocalDateString(endDate.toISOString());

    return orders.filter(o => {
      const orderDateStr = this.toLocalDateString(o.date);
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
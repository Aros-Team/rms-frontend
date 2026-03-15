import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { LoggingService } from '@app/core/services/logging/logging-service';
import { OrderResponse, OrderDetailResponse } from '@app/shared/models/dto/orders/order-response.model';
import { CreateOrderRequest } from '@app/shared/models/dto/orders/create-order-request.model';

export type OrderStatus = 'QUEUE' | 'PREPARING' | 'READY' | 'DELIVERED' | 'CANCELLED';

export interface OrderFilters {
  status?: OrderStatus;
  tableId?: number;
  startDate?: string;
  endDate?: string;
}

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  private http = inject(HttpClient);
  private loggingService: LoggingService = inject(LoggingService);

  getOrders(filters?: OrderFilters): Observable<OrderResponse[]> {
    this.loggingService.debug('OrderService: getOrders called with filters:', filters);
    
    let params = new HttpParams();
    if (filters) {
      if (filters.status) {
        params = params.set('status', filters.status);
      }
      if (filters.tableId) {
        params = params.set('tableId', filters.tableId.toString());
      }
      if (filters.startDate) {
        params = params.set('startDate', filters.startDate);
      }
      if (filters.endDate) {
        params = params.set('endDate', filters.endDate);
      }
    }

    return this.http.get<OrderResponse[]>('v1/orders', { params }).pipe(
      map(orders => {
        this.loggingService.debug('OrderService: Orders received:', orders.length);
        return orders;
      })
    );
  }

  getAllOrders(): Observable<OrderResponse[]> {
    return this.getOrders();
  }

  getTodayOrders(): Observable<OrderResponse[]> {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59).toISOString();
    return this.getOrders({ startDate: startOfDay, endDate: endOfDay });
  }

  getOrdersByStatus(status: OrderStatus): Observable<OrderResponse[]> {
    return this.getOrders({ status });
  }

  getOrdersByTable(tableId: number): Observable<OrderResponse[]> {
    return this.getOrders({ tableId });
  }

  getOrdersWithFilters(filters: OrderFilters): Observable<OrderResponse[]> {
    return this.getOrders(filters);
  }

  public createOrder(request: CreateOrderRequest): Observable<OrderResponse> {
    return this.http.post<OrderResponse>('v1/orders', request);
  }

  public updateOrder(id: number, request: CreateOrderRequest): Observable<OrderResponse> {
    return this.http.put<OrderResponse>(`v1/orders/${id}`, request);
  }

  public cancelOrder(id: number): Observable<OrderResponse> {
    return this.http.put<OrderResponse>(`v1/orders/${id}/cancel`, {});
  }

  public markOrderAsPreparing(): Observable<OrderResponse> {
    return this.http.put<OrderResponse>('v1/orders/prepare', {});
  }

  public markOrderAsReady(id: number): Observable<OrderResponse> {
    return this.http.put<OrderResponse>(`v1/orders/${id}/ready`, {});
  }

  public deliverOrder(id: number): Observable<OrderResponse> {
    return this.http.put<OrderResponse>(`v1/orders/${id}/deliver`, {});
  }

  getOrderById(id: number): Observable<OrderResponse | undefined> {
    return this.getOrders().pipe(
      map(orders => orders.find(o => o.id === id))
    );
  }

  getQueueOrdersCount(): Observable<number> {
    return this.getOrdersByStatus('QUEUE').pipe(
      map(orders => orders.length)
    );
  }

  getCompletedOrdersCount(): Observable<number> {
    return this.getOrdersByStatus('DELIVERED').pipe(
      map(orders => orders.length)
    );
  }

  getPreparingOrdersCount(): Observable<number> {
    return this.getOrdersByStatus('PREPARING').pipe(
      map(orders => orders.length)
    );
  }

  getOrdersByStatusOrAll(status?: string): Observable<OrderResponse[]> {
    if (!status || status === 'ALL') {
      return this.getOrders();
    }
    return this.getOrdersByStatus(status as OrderStatus);
  }

  getReadyOrdersCount(): Observable<number> {
    return this.getOrdersByStatus('READY').pipe(
      map(orders => orders.length)
    );
  }

  getDeliveredOrdersCount(): Observable<number> {
    return this.getOrdersByStatus('DELIVERED').pipe(
      map(orders => orders.length)
    );
  }

  getTotalSales(): Observable<number> {
    return this.getTodayOrders().pipe(
      map(orders =>
        orders
          .filter(order => order.status === 'DELIVERED')
          .reduce((sum, order) => {
            const total = order.details?.reduce((acc, detail) => {
              return acc + (detail.unitPrice || 0);
            }, 0) || 0;
            return sum + total;
          }, 0)
      )
    );
  }

  calculateTotalPrice(details?: OrderDetailResponse[]): number {
    if (!details) return 0;
    return details.reduce((sum, detail) => sum + (detail.unitPrice || 0), 0);
  }
}

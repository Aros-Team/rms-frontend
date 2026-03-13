import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { LoggingService } from '@app/core/services/logging/logging-service';
import { OrderResponse } from '@app/shared/models/dto/orders/order-response.model';
import { OrderDetailsResponse } from '@app/shared/models/dto/orders/order-details-response.model';
import { UpdateOrderRequest } from '@app/shared/models/dto/orders/update-order-status.model';
import { CreateOrderRequest } from '@app/shared/models/dto/orders/create-order-request.model';


@Injectable({
  providedIn: 'root'
})
export class OrderService {
  private http = inject(HttpClient);

  private loggingService: LoggingService = inject(LoggingService);

  getOrders(): Observable<OrderResponse[]> {
    this.loggingService.debug('OrderService: getOrders called');
    return this.http.get<OrderResponse[]>('v1/orders').pipe(
      map(orders => {
        this.loggingService.debug('OrderService: Raw orders from API:', orders);
        const todayOrders = this.filterTodayOrders(orders);
        this.loggingService.debug('OrderService: Filtered today orders:', todayOrders);
        return todayOrders;
      })
    );
  }

  public markOrderAsCompleted(id: number): Observable<void> {
    return this.http.patch<void>(`v1/orders/${id}/deliver`, {});
  }

  public updateOrder(request: UpdateOrderRequest): Observable<void> {
    return this.http.put<void>(`v1/orders/${request.id}`, request);
  }

  public createOrder(request: CreateOrderRequest): Observable<void> {
    return this.http.post<void>('v1/orders', request);
  }

  public getOrdersByStatus(status: string): Observable<OrderResponse[]> {
    return this.http.get<OrderResponse[]>(`v1/orders?status=${status}`);
  }

  public getOrdersByStatusOrAll(status?: string): Observable<OrderResponse[]> {
    if (!status) {
      return this.getOrders();
    }
    return this.getOrdersByStatus(status);
  }

  getOrderById(id: number): Observable<OrderResponse | undefined> {
    return this.getOrders().pipe(
      map(orders => {
        return orders.find(o => o.id === id);
      })
    );
  }

  getOrderDetail(orderId: number): Observable<OrderDetailsResponse[]> {
    return this.http.get<OrderDetailsResponse[]>(`v1/orders/${orderId}/details`);
  }

  getOrderDetails(): Observable<OrderDetailsResponse[]> {
    return this.http.get<OrderDetailsResponse[]>('v1/orders/details');
  }

  getTodayOrders(): Observable<OrderResponse[]> {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59).toISOString();
    
    return this.http.get<OrderResponse[]>(`v1/orders?startDate=${startOfDay}&endDate=${endOfDay}`).pipe(
      map(orders => this.filterTodayOrders(orders))
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

  getTotalSales(): Observable<number> {
    return this.getTodayOrders().pipe(
      map(orders =>
        orders
          .filter(order => order.status === 'DELIVERED')
          .reduce((sum, order) => sum + order.totalPrice, 0)
      )
    );
  }

  private filterTodayOrders(orders: OrderResponse[]): OrderResponse[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];
    
    return orders.filter(order => {
      const orderDate = new Date(order.date).toISOString().split('T')[0];
      return orderDate === todayStr;
    });
  }
}

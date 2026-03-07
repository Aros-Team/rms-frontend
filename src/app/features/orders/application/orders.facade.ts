import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { CreateOrderRequest } from '../../../shared/models/dto/orders/create-order-request.model';
import { OrderResponse } from '../../../shared/models/dto/orders/order-response.model';
import { OrdersHttpRepository } from '../../../infrastructure/http/orders/orders-http.repository';
import { TablesHttpRepository } from '../../../infrastructure/http/table/tables-http.repository';
import { TableResponse } from '../../../shared/models/dto/table/table-response.model';

@Injectable({ providedIn: 'root' })
export class OrdersFacade {
  private readonly ordersRepository = inject(OrdersHttpRepository);
  private readonly tablesRepository = inject(TablesHttpRepository);

  createOrder(payload: CreateOrderRequest): Observable<OrderResponse> {
    return this.ordersRepository.createOrder(payload);
  }

  getOrders(filters?: {
    status?: string;
    startDate?: string;
    endDate?: string;
  }): Observable<OrderResponse[]> {
    return this.ordersRepository.getOrders(filters);
  }

  getOrderById(id: number): Observable<OrderResponse> {
    return this.ordersRepository.getOrderById(id);
  }

  cancelOrder(id: number): Observable<OrderResponse> {
    return this.ordersRepository.cancelOrder(id);
  }

  markOrderReady(id: number): Observable<OrderResponse> {
    return this.ordersRepository.markOrderReady(id);
  }

  deliverOrder(id: number): Observable<OrderResponse> {
    return this.ordersRepository.deliverOrder(id);
  }

  prepareNextOrder(): Observable<OrderResponse> {
    return this.ordersRepository.prepareNextOrder();
  }

  getTables(): Observable<TableResponse[]> {
    return this.tablesRepository.getTables();
  }
}

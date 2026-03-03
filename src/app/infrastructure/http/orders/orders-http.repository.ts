import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { OrdersRepositoryPort } from '../../../core/orders/application/ports/output/orders.repository.port';
import { Order } from '../../../core/orders/domain/models/order.model';

@Injectable()
export class OrdersHttpRepository implements OrdersRepositoryPort {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = environment.apiBaseUrl;

  addProductToOrder(payload: {
    orderId: number;
    productId: number;
    quantity: number;
    note?: string;
  }): Observable<Order> {
    const { orderId, ...body } = payload;

    return this.http.post<Order>(`${this.apiBaseUrl}/orders/${orderId}/items`, body);
  }
}

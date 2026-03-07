import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { CreateOrderRequest } from '../../../shared/models/dto/orders/create-order-request.model';
import { OrderResponse } from '../../../shared/models/dto/orders/order-response.model';

@Injectable({ providedIn: 'root' })
export class OrdersHttpRepository {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = environment.apiBaseUrl;

  createOrder(payload: CreateOrderRequest): Observable<OrderResponse> {
    return this.http.post<OrderResponse>(`${this.apiBaseUrl}/orders`, payload);
  }

  getOrders(filters?: {
    status?: string;
    startDate?: string;
    endDate?: string;
  }): Observable<OrderResponse[]> {
    let params = new HttpParams();
    if (filters?.status) {
      params = params.set('status', filters.status);
    }
    if (filters?.startDate) {
      params = params.set('startDate', filters.startDate);
    }
    if (filters?.endDate) {
      params = params.set('endDate', filters.endDate);
    }
    return this.http.get<OrderResponse[]>(`${this.apiBaseUrl}/orders`, { params });
  }

  getOrderById(id: number): Observable<OrderResponse> {
    return this.http.get<OrderResponse>(`${this.apiBaseUrl}/orders/${id}`);
  }

  cancelOrder(id: number): Observable<OrderResponse> {
    return this.http.put<OrderResponse>(`${this.apiBaseUrl}/orders/${id}/cancel`, {});
  }

  markOrderReady(id: number): Observable<OrderResponse> {
    return this.http.put<OrderResponse>(`${this.apiBaseUrl}/orders/${id}/ready`, {});
  }

  deliverOrder(id: number): Observable<OrderResponse> {
    return this.http.put<OrderResponse>(`${this.apiBaseUrl}/orders/${id}/deliver`, {});
  }

  prepareNextOrder(): Observable<OrderResponse> {
    return this.http.put<OrderResponse>(`${this.apiBaseUrl}/orders/prepare`, {});
  }
}

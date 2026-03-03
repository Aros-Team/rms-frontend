import { Observable } from 'rxjs';
import { Order } from '../../../domain/models/order.model';

export interface OrdersRepositoryPort {
  addProductToOrder(payload: {
    orderId: number;
    productId: number;
    quantity: number;
    note?: string;
  }): Observable<Order>;
}

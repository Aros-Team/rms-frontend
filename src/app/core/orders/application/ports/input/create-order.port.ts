import { Observable } from 'rxjs';
import { OrderResponse } from '../../../../../shared/models/dto/orders/order-response.model';

export interface CreateOrderCommand {
  tableId: number;
  details: Array<{
    productId: number;
    instructions?: string;
    selectedOptionIds?: number[];
  }>;
}

export interface CreateOrderPort {
  execute(command: CreateOrderCommand): Observable<OrderResponse>;
}
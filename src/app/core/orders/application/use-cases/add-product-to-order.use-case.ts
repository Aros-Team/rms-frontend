import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { AddProductToOrderPort } from '../ports/input/add-product-to-order.port';
import { AddProductToOrderCommand } from '../dto/add-product-to-order.command';
import { Order } from '../../domain/models/order.model';
import { ORDERS_REPOSITORY } from '../tokens/orders.tokens';
import { OrdersRepositoryPort } from '../ports/output/orders.repository.port';

@Injectable({ providedIn: 'root' })
export class AddProductToOrderUseCase implements AddProductToOrderPort {
  private readonly ordersRepository = inject<OrdersRepositoryPort>(ORDERS_REPOSITORY);

  execute(command: AddProductToOrderCommand): Observable<Order> {
    return this.ordersRepository.addProductToOrder(command);
  }
}

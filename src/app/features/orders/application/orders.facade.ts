import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { AddProductToOrderUseCase } from '../../../core/orders/application/use-cases/add-product-to-order.use-case';
import { Order } from '../../../core/orders/domain/models/order.model';

@Injectable({ providedIn: 'root' })
export class OrdersFacade {
  private readonly addProductToOrderUseCase = inject(AddProductToOrderUseCase);

  addProduct(payload: {
    orderId: number;
    productId: number;
    quantity: number;
    note?: string;
  }): Observable<Order> {
    return this.addProductToOrderUseCase.execute(payload);
  }
}

import { Observable } from 'rxjs';
import { Order } from '../../../domain/models/order.model';
import { AddProductToOrderCommand } from '../../dto/add-product-to-order.command';

export interface AddProductToOrderPort {
  execute(command: AddProductToOrderCommand): Observable<Order>;
}

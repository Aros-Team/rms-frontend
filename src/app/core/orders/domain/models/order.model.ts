import { OrderItem } from './order-item.model';
import { OrderStatus } from './order-status.model';

export interface Order {
  id: number;
  tableId: number;
  status: OrderStatus;
  items: OrderItem[];
  date?: string;
}

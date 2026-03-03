import { OrderItem } from './order-item.model';

export interface Order {
  id: number;
  tableId: number;
  status: string;
  items: OrderItem[];
}

export interface OrderSelectedOption {
  id: number;
  name: string;
  categoryName: string;
}

export interface OrderDetailItem {
  id: number;
  productId: number;
  productName: string;
  unitPrice: number;
  instructions: string;
  selectedOptions?: OrderSelectedOption[];
}

export interface OrderResponse {
  id: number;
  date: string;
  status: string;   // QUEUE | PREPARING | READY | DELIVERED | CANCELLED
  tableId: number;
  details: OrderDetailItem[];
  // legacy — solo para compatibilidad con admin
  table?: string;
  totalPrice?: number;
}

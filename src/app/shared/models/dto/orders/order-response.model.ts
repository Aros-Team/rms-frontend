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
  status: string;
  tableId: number;
  details: OrderDetailItem[];
  table?: string;
}

export function calculateTotalPrice(order: OrderResponse): number {
  if (!order.details || order.details.length === 0) {
    return 0;
  }
  return order.details.reduce((sum, detail) => sum + detail.unitPrice, 0);
}

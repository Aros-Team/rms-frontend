export interface CreateOrderRequest {
  tableId: number;
  details: OrderDetailRequest[];
}

export interface OrderDetailRequest {
  productId: number;
  instructions?: string;
  selectedOptionIds?: number[];
}

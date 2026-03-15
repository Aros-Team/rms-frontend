export interface CreateOrderDetail {
  productId: number;
  instructions: string;
  selectedOptionIds: number[];
}

export interface CreateOrderRequest {
  tableId: number;
  details: CreateOrderDetail[];
}

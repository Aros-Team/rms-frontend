export interface CreateOrderRequest {
  tableId: number;
  details: Array<{
    productId: number;
    instructions?: string;
    selectedOptionIds?: number[];
  }>;
}

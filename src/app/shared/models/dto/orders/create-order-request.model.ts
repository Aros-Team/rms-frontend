export interface CreateOrderDetail {
  productId: number;
  instructions: string;
  selectedOptionIds: number[];
  additionIds?: number[];
  clarifications?: ClarificationRef[];
}

export interface ClarificationRef {
  questionId: number;
  answer: string;
}

export interface CreateOrderRequest {
  tableId: number;
  details: CreateOrderDetail[];
}

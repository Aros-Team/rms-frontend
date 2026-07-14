export interface OrderSelectedOption {
  id: number;
  name: string;
  categoryName: string;
}

export interface OrderAdditionResolved {
  id: number;
  name: string;
  extraPrice: number;
  optionName: string;
}

export interface OrderClarificationResolved {
  questionId: number;
  question: string;
  answer: string;
}

export interface OrderGroupSelectionResolved {
  groupName: string;
  selectedOptions: string[];
}

export interface OrderDetailItem {
  id: number;
  productId: number;
  productName: string;
  unitPrice: number;
  instructions: string;
  selectedOptions?: OrderSelectedOption[];
  selectionType?: 'STANDARD' | 'SPECIAL_SELECTION';
  groupSelections?: OrderGroupSelectionResolved[];
  additionsResolved?: OrderAdditionResolved[];
  clarificationsResolved?: OrderClarificationResolved[];
}

export interface OrderResponse {
  id: number;
  date: string;
  status: string;
  tableId: number;
  details: OrderDetailItem[];
  table?: string;
  total?: number;
}

export function calculateTotalPrice(order: OrderResponse): number {
  if (order.details.length === 0) {
    return 0;
  }
  return order.details.reduce((sum, detail) => sum + detail.unitPrice, 0);
}

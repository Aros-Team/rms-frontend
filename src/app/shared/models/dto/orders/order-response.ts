import type { SelectionType } from '@app/shared/models/dto/special-selections/selection-type';

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
  categoryId?: number | null;
  categoryName?: string | null;
  unitPrice: number;
  /**
   * Surcharge for the selected options/additions of this line. Sent by the
   * backend as a bare number and already included in `unitPrice` for priced
   * options, but kept separate here because some responses only report the
   * base price in `unitPrice`.
   */
  extraCharge?: number;
  instructions: string;
  selectedOptions?: OrderSelectedOption[];
  selectedProductIds?: number[];
  selectionType?: SelectionType;
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

/**
 * Single source of truth for an order's monetary total.
 *
 * Sums `unitPrice + extraCharge` per line. Anywhere an order total is needed
 * (order table, dashboard KPIs, sales composition) must call this function
 * instead of re-implementing the reduction.
 */
export function calculateTotalPrice(order: OrderResponse): number {
  if (!order.details.length) {
    return 0;
  }
  return order.details.reduce(
    (sum, detail) => sum + detail.unitPrice + (detail.extraCharge ?? 0),
    0,
  );
}

import type { SelectionType } from '@app/shared/models/dto/special-selections/selection-type';
import { toAmount, type Money } from '@app/shared/models/dto/common/money';

export interface OrderSelectedOption {
  id: number;
  name: string;
  categoryName: string;
}

export interface OrderAdditionResolved {
  id: number;
  name: string;
  /**
   * `MoneyDto { amount: string, currency: string }` on the wire; `number` is
   * kept as a transitional tolerance for older fixtures. Use `toAmount()`
   * before any arithmetic.
   */
  extraPrice: Money | number;
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
  /**
   * `MoneyDto { amount: "15000.00", currency: "COP" }` on the wire (was a bare
   * number before the backend money migration). Never add/subtract it
   * directly — pass it through `toAmount()`.
   */
  unitPrice: Money | number;
  /**
   * Surcharge for the selected options/additions of this line, also a
   * `MoneyDto` now; already included in `unitPrice` for priced options, but
   * kept separate here because some responses only report the base price in
   * `unitPrice`.
   */
  extraCharge?: Money | number;
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
  /**
   * `MoneyDto` on the wire. Treat as money, not as a number: render it with the
   * `money` pipe and normalize with `toAmount()` before math.
   */
  total?: Money | number;
}

/**
 * Single source of truth for an order's monetary total.
 *
 * Sums `unitPrice + extraCharge` per line, normalizing every `MoneyDto` through
 * `toAmount()` (adding the objects directly yields `NaN`). Anywhere an order
 * total is needed (order table, dashboard KPIs, sales composition) must call
 * this function instead of re-implementing the reduction.
 */
export function calculateTotalPrice(order: OrderResponse): number {
  if (!order.details.length) {
    return 0;
  }
  return order.details.reduce(
    (sum, detail) => sum + toAmount(detail.unitPrice) + toAmount(detail.extraCharge),
    0,
  );
}

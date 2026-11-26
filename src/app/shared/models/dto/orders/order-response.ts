import type { SelectionType } from '@app/shared/models/dto/special-selections/selection-type';
import { toAmount, tryToAmount, type Money } from '@app/shared/models/dto/common/money';

export interface OrderSelectedOption {
  id: number;
  name: string;
  categoryName: string;
}

/** Combo product resolved by the backend (`selectedProducts` on the wire). */
export interface OrderSelectedProduct {
  id: number;
  name: string | null;
  basePrice: Money | number | null;
}

/** Special-selection addition resolved by the backend (`selectedAdditions`). */
export interface OrderSelectedAddition {
  id: number;
  name: string | null;
  extraPrice: Money | number | null;
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
  /** The wire sends `null` when the product was deleted after the sale. */
  productName: string | null;
  categoryId?: number | null;
  categoryName?: string | null;
  /**
   * Preparation area (station) resolved by the backend from the product.
   * Omitted when the product has no area; callers may fall back to the product
   * catalogue. `areaName` is independent and may be missing.
   */
  areaId?: number | null;
  areaName?: string | null;
  /**
   * `MoneyDto { amount: "15000.00", currency: "COP" }` on the wire (was a bare
   * number before the backend money migration). Never add/subtract it
   * directly — pass it through `toAmount()`.
   */
  unitPrice: Money | number;
  /**
   * Surcharge for the selected options/additions of this line, also a
   * `MoneyDto`. Informational only: the backend already includes it in
   * `unitPrice`, so never add it again (use `calculateLineTotal`).
   */
  extraCharge?: Money | number;
  /** The wire sends `null` for a line without a cook note. */
  instructions: string | null;
  selectedOptions?: OrderSelectedOption[];
  selectedProductIds?: number[];
  /** Combo products resolved by the backend (`selectedProducts`). */
  selectedProducts?: OrderSelectedProduct[];
  /** Special-selection addition IDs (`additionIds`). */
  additionIds?: number[];
  /** Special-selection additions resolved by the backend (`selectedAdditions`). */
  selectedAdditions?: OrderSelectedAddition[];
  /** Clarification answers with the question text resolved by the backend. */
  clarifications?: OrderClarificationResolved[];
  /**
   * Item-level readiness persisted by the backend (`order_details.ready`).
   * Optional so older payloads and fixtures stay valid; treat a missing value
   * as `false`.
   */
  ready?: boolean;
  /** When the line was marked ready; absent while it is not ready. */
  readyAt?: string | null;
  /** When the line's station started it. */
  preparationStartedAt?: string | null;
  /** Whether this line was delivered to the customer. */
  delivered?: boolean;
  /** When the line was delivered. */
  deliveredAt?: string | null;
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
  preparedAt?: string | null;
  deliveredAt?: string | null;
}

/**
 * Single source of truth for a line's monetary contribution.
 *
 * The backend already includes the line's option surcharge in `unitPrice`
 * (`TakeOrderService` builds `unitPrice = basePrice + extraCharge`), so
 * `extraCharge` must NOT be added again: doing so double-counts every
 * surcharge. Normalize the `MoneyDto` through `toAmount()` instead of summing
 * the objects (which yields `NaN` or a concatenated string).
 */
export function calculateLineTotal(detail: OrderDetailItem): number {
  return toAmount(detail.unitPrice);
}

/**
 * Single source of truth for an order's monetary total.
 *
 * Prefers the server-computed `total` (`MoneyDto`), which is authoritative and
 * already folds every line surcharge. Only when the payload carries no usable
 * total does it fall back to summing each line's `unitPrice` through
 * `calculateLineTotal()` — never `unitPrice + extraCharge`, because the backend
 * contract already includes the surcharge in `unitPrice`.
 *
 * Anywhere an order total is needed (order table, dashboard KPIs, sales
 * composition) must call this function instead of re-implementing the
 * reduction.
 */
export function calculateTotalPrice(order: OrderResponse): number {
  const serverTotal = tryToAmount(order.total);
  if (serverTotal !== null) {
    return serverTotal;
  }
  if (!order.details.length) {
    return 0;
  }
  return order.details.reduce((sum, detail) => sum + calculateLineTotal(detail), 0);
}

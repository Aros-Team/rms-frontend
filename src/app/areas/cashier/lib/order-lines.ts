import {
  calculateLineTotal,
  type OrderDetailItem,
} from '@app/shared/models/dto/orders/order-response';

/**
 * Display model for the cashier order review.
 *
 * The orders API has no `quantity` column (spike finding F-006): the waiter UI
 * flattens quantity into repeated detail lines. Grouping identical lines here
 * restores a readable "2 × Hamburguesa" without inventing data, while the line
 * price and the order total still come from the server.
 */
export interface OrderLineView {
  key: string;
  productId: number;
  name: string;
  quantity: number;
  unitPrice: number;
  /** `unitPrice × quantity` (server price, client multiplication only). */
  total: number;
  options: string[];
  combos: string[];
  additions: string[];
  clarifications: string[];
  instructions: string;
}

function namesOf(values: readonly { name?: string | null }[] | undefined): string[] {
  return (values ?? []).map((value) => value.name?.trim() ?? '').filter((name) => name.length > 0);
}

/** Wire fields the backend can send as null even though the TS type says string. */
interface NullableWireFields {
  instructions?: string | null;
  productName?: string | null;
}

function instructionText(detail: OrderDetailItem): string {
  const wire = detail as unknown as NullableWireFields;
  return wire.instructions?.trim() ?? '';
}

function productName(detail: OrderDetailItem): string {
  const wire = detail as unknown as NullableWireFields;
  const name = wire.productName?.trim() ?? '';
  return name.length > 0 ? name : 'Producto';
}

interface NullableClarification {
  question?: string | null;
  answer?: string | null;
}

function comboLabels(detail: OrderDetailItem): string[] {
  return namesOf(detail.selectedProducts);
}

function additionLabels(detail: OrderDetailItem): string[] {
  if (detail.additionsResolved !== undefined && detail.additionsResolved.length > 0) {
    return detail.additionsResolved.map((addition) =>
      addition.optionName.length > 0 ? `${addition.optionName}: ${addition.name}` : addition.name,
    );
  }
  return namesOf(detail.selectedAdditions);
}

function clarificationLabels(detail: OrderDetailItem): string[] {
  const values = detail.clarificationsResolved ?? detail.clarifications ?? [];
  return values
    .map((value) => value as unknown as NullableClarification)
    .map((value) => ({
      question: value.question?.trim() ?? '',
      answer: value.answer?.trim() ?? '',
    }))
    .filter((value) => value.answer.length > 0)
    .map((value) =>
      value.question.length > 0 ? `${value.question}: ${value.answer}` : value.answer,
    );
}

/** Stable grouping key: same product, price, options and instructions. */
function lineKey(detail: OrderDetailItem): string {
  return JSON.stringify([
    detail.productId,
    calculateLineTotal(detail),
    instructionText(detail),
    (detail.selectedOptions ?? []).map((option) => option.name),
    comboLabels(detail),
    additionLabels(detail),
    clarificationLabels(detail),
  ]);
}

/** Groups repeated detail lines and computes each line's displayed total. */
export function groupOrderLines(details: readonly OrderDetailItem[]): OrderLineView[] {
  const lines = new Map<string, OrderLineView>();

  for (const detail of details) {
    const key = lineKey(detail);
    const unitPrice = calculateLineTotal(detail);
    const current = lines.get(key);

    if (current !== undefined) {
      current.quantity += 1;
      current.total = unitPrice * current.quantity;
      continue;
    }

    lines.set(key, {
      key,
      productId: detail.productId,
      name: productName(detail),
      quantity: 1,
      unitPrice,
      total: unitPrice,
      options: (detail.selectedOptions ?? []).map((option) => option.name),
      combos: comboLabels(detail),
      additions: additionLabels(detail),
      clarifications: clarificationLabels(detail),
      instructions: instructionText(detail),
    });
  }

  return [...lines.values()];
}

/** Total number of physical items (sum of grouped quantities). */
export function countOrderItems(lines: readonly OrderLineView[]): number {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}

import type { OrderDetailItem } from '@app/shared/models/dto/orders/order-response';
import {
  stationForDetail,
  type KitchenStation,
  type KitchenStationMap,
} from './kitchen-stations';

/**
 * Readable kitchen line model.
 *
 * The API flattens quantity into repeated detail rows, so the board groups
 * identical rows into one line with a `quantity`. Two lines stay separate when
 * their options, combo contents, additions, clarifications or note differ —
 * otherwise "sin cebolla" would be averaged into a plain burger.
 *
 * Nothing here is persisted: it is a view model built on every render from the
 * order payload. Item-level readiness needs a backend field and is deliberately
 * not invented on the client.
 */
export interface KitchenClarification {
  question: string;
  answer: string;
}

export interface KitchenLine {
  key: string;
  productId: number;
  name: string;
  quantity: number;
  station: KitchenStation;
  /** `Categoría: opción` labels, de-duplicated. */
  options: string[];
  /** Combo components resolved by the backend. */
  combos: string[];
  /** Special-selection additions. */
  additions: string[];
  clarifications: KitchenClarification[];
  note: string;
}

function optionLabel(option: { name: string; categoryName: string }): string {
  const name = option.name.trim();
  const category = option.categoryName.trim();
  if (name.length === 0) return category;
  if (category.length === 0 || category === name) return name;
  return `${category}: ${name}`;
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))].sort(
    (left, right) => left.localeCompare(right, 'es'),
  );
}

/**
 * The wire sends `instructions: null` for a plain line even though the DTO
 * declares `string` (live check, 2026-11-21). Read through `unknown` so a null
 * note can never crash the board.
 */
function instructionsOf(detail: OrderDetailItem): string {
  const value: unknown = detail.instructions;
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Stable grouping key for a detail row.
 *
 * Uses IDs (not labels) for the identity of the selections, so a product rename
 * does not split an order that is already on the pass.
 */
function lineKey(detail: OrderDetailItem): string {
  const optionIds = (detail.selectedOptions ?? []).map((option) => option.id).sort((a, b) => a - b);
  const productIds = [
    ...new Set([
      ...(detail.selectedProductIds ?? []),
      ...(detail.selectedProducts ?? []).map((product) => product.id),
    ]),
  ].sort((a, b) => a - b);
  const additionIds = [
    ...new Set([
      ...(detail.additionIds ?? []),
      ...(detail.selectedAdditions ?? []).map((addition) => addition.id),
    ]),
  ].sort((a, b) => a - b);
  const clarifications = (detail.clarifications ?? [])
    .map((clarification) => `${String(clarification.questionId)}:${clarification.answer}`)
    .sort();

  return [
    String(detail.productId),
    instructionsOf(detail),
    optionIds.join(','),
    productIds.join(','),
    additionIds.join(','),
    clarifications.join('|'),
  ].join('::');
}

function toLine(detail: OrderDetailItem, station: KitchenStation): KitchenLine {
  return {
    key: lineKey(detail),
    productId: detail.productId,
    name: detail.productName.trim() || `Producto #${String(detail.productId)}`,
    quantity: 1,
    station,
    options: uniqueSorted((detail.selectedOptions ?? []).map(optionLabel)),
    combos: uniqueSorted((detail.selectedProducts ?? []).map((product) => product.name ?? '')),
    additions: uniqueSorted((detail.selectedAdditions ?? []).map((addition) => addition.name ?? '')),
    clarifications: (detail.clarifications ?? []).map((clarification) => ({
      question: clarification.question,
      answer: clarification.answer,
    })),
    note: instructionsOf(detail),
  };
}

/**
 * Groups repeated detail rows and resolves each line's station.
 *
 * The result keeps the order in which products were sent, so a cook reads the
 * same sequence the waiter wrote.
 */
export function groupKitchenLines(
  details: readonly OrderDetailItem[],
  stations: KitchenStationMap,
): KitchenLine[] {
  const lines = new Map<string, KitchenLine>();
  for (const detail of details) {
    const station = stationForDetail(detail, stations);
    const key = lineKey(detail);
    const current = lines.get(key);
    if (current) {
      current.quantity += 1;
      continue;
    }
    lines.set(key, toLine(detail, station));
  }
  return [...lines.values()];
}

/** Total physical items, counting repeated rows. */
export function totalKitchenItems(lines: readonly KitchenLine[]): number {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}

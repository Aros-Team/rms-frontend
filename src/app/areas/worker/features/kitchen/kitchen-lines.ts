import type { OrderDetailItem } from '@app/shared/models/dto/orders/order-response';
import { stationForDetail, type KitchenStation, type KitchenStationMap } from './kitchen-stations';

/**
 * Readable kitchen line model.
 *
 * The API flattens quantity into repeated detail rows, so the board groups
 * identical rows into one line with a `quantity`. Two lines stay separate when
 * their options, combo contents, additions, clarifications or note differ —
 * otherwise "sin cebolla" would be averaged into a plain burger.
 *
 * The line carries the persisted readiness of every underlying detail row
 * (`order_details.ready`/`ready_at`), so the board can tick items one by one
 * without inventing client-only state. A grouped line with quantity > 1 keeps
 * one entry per physical row and is fully ready only when all of them are.
 */
export interface KitchenClarification {
  question: string;
  answer: string;
}

/** Persisted readiness of one physical detail row. */
export interface KitchenLineDetail {
  id: number;
  ready: boolean;
  readyAt: string | null;
  preparationStartedAt: string | null;
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
  /** Every detail row collapsed into this line, with its readiness. */
  details: KitchenLineDetail[];
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
 * The wire sends `instructions: null` for a plain line (live check,
 * 2026-11-22). Read through `unknown` so a null note can never crash the board.
 */
function instructionsOf(detail: OrderDetailItem): string {
  const value: unknown = detail.instructions;
  return typeof value === 'string' ? value.trim() : '';
}

/** `productName` is nullable on the wire; never render "null". */
function productNameOf(detail: OrderDetailItem): string {
  const value: unknown = detail.productName;
  return typeof value === 'string' ? value.trim() : '';
}

function readinessOf(detail: OrderDetailItem): KitchenLineDetail {
  return {
    id: detail.id,
    ready: detail.ready === true,
    readyAt: typeof detail.readyAt === 'string' ? detail.readyAt : null,
    preparationStartedAt:
      typeof detail.preparationStartedAt === 'string' ? detail.preparationStartedAt : null,
  };
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
    name: productNameOf(detail) || `Producto #${String(detail.productId)}`,
    quantity: 1,
    station,
    details: [readinessOf(detail)],
    options: uniqueSorted((detail.selectedOptions ?? []).map(optionLabel)),
    combos: uniqueSorted((detail.selectedProducts ?? []).map((product) => product.name ?? '')),
    additions: uniqueSorted(
      (detail.selectedAdditions ?? []).map((addition) => addition.name ?? ''),
    ),
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
      current.details.push(readinessOf(detail));
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

/** Detail row ids still pending on a grouped line. */
export function pendingDetailIds(line: KitchenLine): number[] {
  return line.details.filter((detail) => !detail.ready).map((detail) => detail.id);
}

/** Detail row ids still waiting for their station to start them. */
export function unstartedDetailIds(line: KitchenLine): number[] {
  return line.details
    .filter((detail) => !detail.preparationStartedAt && !detail.ready)
    .map((detail) => detail.id);
}

/** `true` when at least one physical row has started. */
export function isLineStarted(line: KitchenLine): boolean {
  return line.details.some((detail) => detail.preparationStartedAt !== null || detail.ready);
}

/** Earliest start timestamp of the grouped line, or null. */
export function lineStartedAt(line: KitchenLine): string | null {
  const timestamps = line.details
    .map((detail) => detail.preparationStartedAt)
    .filter((value): value is string => value !== null)
    .sort();
  return timestamps.at(0) ?? null;
}

/** `true` when every physical row of the line is ready. */
export function isLineReady(line: KitchenLine): boolean {
  return line.details.length > 0 && line.details.every((detail) => detail.ready);
}

/** Latest `readyAt` of a fully ready line, or `null` while it is pending. */
export function lineReadyAt(line: KitchenLine): string | null {
  if (!isLineReady(line)) return null;
  const timestamps = line.details
    .map((detail) => detail.readyAt)
    .filter((value): value is string => value !== null)
    .sort();
  return timestamps.at(-1) ?? null;
}

/**
 * Decimal money math for the recipe/costing page.
 *
 * The API sends `MoneyDto` as a decimal **string** and recipe quantities as
 * decimals with up to three places. Multiplying two JS floats (`0.1 * 3`) and
 * summing ten rows drifts, so every cost is computed on integer micro-units
 * (`1e-6`) and only converted back to a money string at the render boundary.
 *
 * Scale map:
 *  - money: 6 decimals (`MICRO`) — enough headroom for quantity × unit cost
 *  - quantity: 3 decimals (`MILLI`) — the DB column is `decimal(10,3)`
 *
 * Formula (documented for P4-REC-06 in `docs/reports/recipes-lane.md`):
 *  - line cost = quantity × variant unit cost, summed, rounded to cents
 *  - margin = (sale price − total cost) / sale price
 *  - suggested price = total cost × 1.3, rounded to cents (same 30 % markup the
 *    product wizard already uses)
 */
import { tryToAmount, type MoneyLike } from '@app/shared/models/dto/common/money';

/** Micro-units per currency unit. */
const MICRO = 1_000_000n;
/** Milli-units per quantity unit. */
const MILLI = 1_000n;
/** One tenth of a cost unit (0.1) as a rational, for the ×1.3 markup. */
const MARKUP_NUMERATOR = 13n;
const MARKUP_DENOMINATOR = 10n;

const DECIMAL_PATTERN = /^[+-]?\d+(?:[.,]\d+)?$/;

/** Parses a user-entered decimal (`0,25` or `0.25`); `null` when not numeric. */
export function parseDecimal(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;

  const raw = value.trim();
  if (!DECIMAL_PATTERN.test(raw)) return null;
  const parsed = Number(raw.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Parses a decimal string into fixed-point units, rejecting more precision than
 * `scale` instead of silently rounding the user's input.
 */
export function decimalToScaled(
  value: string | number | null | undefined,
  scale: number,
): bigint | null {
  if (value === null || value === undefined) return null;
  const raw = typeof value === 'number' ? String(value) : value.trim();
  if (!DECIMAL_PATTERN.test(raw)) return null;

  const negative = raw.startsWith('-');
  const unsigned = raw.replace(/^[+-]/, '').replace(',', '.');
  const [integerPart, fractionPart = ''] = unsigned.split('.');
  if (fractionPart.length > scale) return null;

  const digits = `${integerPart === '' ? '0' : integerPart}${fractionPart.padEnd(scale, '0')}`;
  const scaled = BigInt(digits);
  return negative ? -scaled : scaled;
}

/** Quantity in milli-units (3 decimals). */
export function quantityToMilli(value: string | number | null | undefined): bigint | null {
  return decimalToScaled(value, 3);
}

/** Money in micro-units (6 decimals); `null` when the payload has no amount. */
export function moneyToMicro(value: MoneyLike): bigint | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' || typeof value === 'string') {
    return decimalToScaled(value, 6);
  }
  if (typeof value !== 'object') return null;
  return decimalToScaled(value.amount, 6);
}

/** Money in micro-units from the plain numeric amount a form control holds. */
export function amountToMicro(value: number | null | undefined): bigint | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return decimalToScaled(value, 6);
}

/** Line cost (micro-units) for `quantity × unitCost`; `null` when unusable. */
export function lineCostMicro(
  quantity: string | number | null | undefined,
  unitCost: MoneyLike,
): bigint | null {
  const quantityMilli = quantityToMilli(quantity);
  const costMicro = moneyToMicro(unitCost);
  if (quantityMilli === null || costMicro === null) return null;
  if (quantityMilli <= 0n) return null;
  return (quantityMilli * costMicro) / MILLI;
}

/** Adds micro amounts, skipping the `null`s left by missing unit costs. */
export function sumMicro(values: readonly (bigint | null | undefined)[]): bigint {
  let total = 0n;
  for (const value of values) {
    if (value !== null && value !== undefined) total += value;
  }
  return total;
}

/** Integer division rounded half-up, so the sign behaves like the magnitude. */
function divideRounded(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) return 0n;
  if (numerator >= 0n) return (numerator + denominator / 2n) / denominator;
  return -((-numerator + denominator / 2n) / denominator);
}

/** Rounds micro-units to whole cents (2 decimals). */
export function roundMicroToCents(micro: bigint): bigint {
  return divideRounded(micro, 10_000n) * 10_000n;
}

/** Formats micro-units as a two-decimal amount string (`"16112.74"`). */
export function microToAmountString(micro: bigint): string {
  const cents = roundMicroToCents(micro);
  const negative = cents < 0n;
  const absolute = negative ? -cents : cents;
  const units = absolute / MICRO;
  const fraction = (absolute % MICRO) / 10_000n;
  return `${negative ? '-' : ''}${units.toString()}.${fraction.toString().padStart(2, '0')}`;
}

/** Renders a micro amount as the exact `MoneyDto` shape the API sends. */
export function microToMoney(micro: bigint, currency: string): { amount: string; currency: string } {
  return { amount: microToAmountString(micro), currency };
}

/** Converts micro-units to a plain number, for percentages only. */
export function microToNumber(micro: bigint): number {
  return Number(micro) / Number(MICRO);
}

export interface MarginResult {
  /** Sale price minus total cost, in micro-units. */
  amountMicro: bigint;
  /** Gross margin as a percentage; `null` when there is no usable sale price. */
  percent: number | null;
  /** Cost as a percentage of the sale price (the "costo primo"); `null` when price is 0. */
  foodCostPercent: number | null;
}

/** Gross margin and food-cost percentage for a price/cost pair. */
export function marginOf(priceMicro: bigint, costMicro: bigint): MarginResult {
  const amountMicro = priceMicro - costMicro;
  if (priceMicro <= 0n) {
    return { amountMicro, percent: null, foodCostPercent: null };
  }
  return {
    amountMicro,
    percent: (Number(amountMicro) / Number(priceMicro)) * 100,
    foodCostPercent: (Number(costMicro) / Number(priceMicro)) * 100,
  };
}

/** Suggested sale price: total cost × 1.3, rounded to cents. */
export function suggestedPriceMicro(
  totalMicro: bigint,
  numerator: bigint = MARKUP_NUMERATOR,
  denominator: bigint = MARKUP_DENOMINATOR,
): bigint {
  if (totalMicro <= 0n) return 0n;
  return roundMicroToCents(divideRounded(totalMicro * numerator, denominator));
}

/**
 * Prorates the API labor cost when the preparation time differs from the one
 * the server used. The API does not expose the hourly rate, so the rate is
 * derived from the server's own labor cost; it is an estimate, not a new cost.
 */
export function laborForPrepMinutes(
  laborMicro: bigint | null,
  serverMinutes: number | null,
  draftMinutes: number | null,
): bigint | null {
  if (laborMicro === null || laborMicro < 0n) return null;
  if (serverMinutes === null || serverMinutes <= 0) return laborMicro;
  if (draftMinutes === null || draftMinutes < 0) return null;
  if (draftMinutes === serverMinutes) return laborMicro;
  return divideRounded(laborMicro * BigInt(draftMinutes), BigInt(serverMinutes));
}

/**
 * Prorates the server labor cost when the draft changes the preparation time
 * or the number of people required.
 *
 * The API computes labor as:
 *   (prep minutes / 60) × area hourly rate × required workers.
 *
 * This helper derives the implied person-hour rate from the server response and
 * applies it to the draft values. It is an estimate for unsaved edits, not a new
 * server cost.
 */
export function laborForPreparation(
  laborMicro: bigint | null,
  serverMinutes: number | null,
  serverWorkers: number | null,
  draftMinutes: number | null,
  draftWorkers: number | null,
): bigint | null {
  if (laborMicro === null || laborMicro < 0n) return null;
  const safeServerWorkers =
    serverWorkers !== null && serverWorkers > 0 ? serverWorkers : 1;
  const safeDraftWorkers = draftWorkers !== null && draftWorkers > 0 ? draftWorkers : 1;
  if (serverMinutes === null || serverMinutes <= 0) {
    return divideRounded(laborMicro * BigInt(safeDraftWorkers), BigInt(safeServerWorkers));
  }
  if (draftMinutes === null || draftMinutes < 0) return null;
  return divideRounded(
    laborMicro * BigInt(draftMinutes) * BigInt(safeDraftWorkers),
    BigInt(serverMinutes) * BigInt(safeServerWorkers),
  );
}

/**
 * Derives the per-person hourly rate the API applied:
 * labor cost ÷ (prep minutes / 60) ÷ required workers.
 * Used to explain the labor line, not to replace the API number.
 */
export function hourlyRateMicro(
  laborMicro: bigint | null,
  prepMinutes: number | null,
  workers: number | null = 1,
): bigint | null {
  if (laborMicro === null || laborMicro <= 0n) return null;
  if (prepMinutes === null || prepMinutes <= 0) return null;
  const safeWorkers = workers !== null && workers > 0 ? workers : 1;
  return divideRounded(
    laborMicro * 60n,
    BigInt(prepMinutes) * BigInt(safeWorkers),
  );
}

/** Spanish percentage label (`"42,4 %"`); em dash when the value is unknown. */
export function formatPercent(value: number | null, decimals = 1): string {
  if (value === null || !Number.isFinite(value)) return '—';
  return `${value.toLocaleString('es-CO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })} %`;
}

/** Normalizes a quantity number to the text an input control shows. */
export function formatQuantityInput(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '';
  return String(Number(value.toFixed(3)));
}

/** Normalizes a money payload to the plain text a price input shows. */
export function formatAmountInput(value: MoneyLike): string {
  const amount = tryToAmount(value);
  return amount === null ? '' : String(amount);
}

/** Currency carried by a money payload, falling back to the app default. */
export function currencyOf(value: MoneyLike, fallback = 'COP'): string {
  if (value !== null && typeof value === 'object' && typeof value.currency === 'string') {
    const currency = value.currency.trim();
    if (currency.length > 0) return currency;
  }
  return fallback;
}

import type { Money } from '@app/shared/models/dto/analytics/money';

/**
 * Money helpers for analytics.
 *
 * Every wire amount is a decimal string (`{ amount: "125000000.00" }`). Adding
 * those strings — or parsing and summing them as floats — loses cents and can
 * silently concatenate. These helpers convert to integer minor units with
 * `BigInt`, aggregate exactly, and convert back to the wire shape. Display
 * formatting stays in the `money` pipe.
 */

const AMOUNT = /^(-)?(\d+)(?:\.(\d{1,9}))?$/;

/** Converts a decimal amount string to integer minor units (cents). */
export function toMinorUnits(amount: string): bigint | null {
  const match = AMOUNT.exec(amount.trim());
  if (match === null) return null;
  const [, sign, integer, fraction = ''] = match;
  const cents = BigInt(integer) * 100n + BigInt(fraction.padEnd(2, '0').slice(0, 2));
  return sign === '-' ? -cents : cents;
}

/** Converts integer minor units back to a `Money` with two decimals. */
export function fromMinorUnits(value: bigint, currency: string): Money {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const units = absolute / 100n;
  const cents = absolute % 100n;
  const amount = `${negative ? '-' : ''}${units.toString()}.${cents.toString().padStart(2, '0')}`;
  return { amount, currency };
}

/**
 * Exact sum. Returns `null` when there is no amount to sum; the currency is
 * taken from the first non-null value and used for the result.
 */
export function sumMoney(values: readonly (Money | null | undefined)[]): Money | null {
  let total = 0n;
  let currency = '';
  let seen = false;

  for (const value of values) {
    if (value === null || value === undefined) continue;
    const cents = toMinorUnits(value.amount);
    if (cents === null) continue;
    total += cents;
    if (currency.length === 0) currency = value.currency;
    seen = true;
  }

  return seen ? fromMinorUnits(total, currency) : null;
}

/** Exact `a - b`. Returns `null` when either side is missing. */
export function subtractMoney(
  a: Money | null | undefined,
  b: Money | null | undefined,
): Money | null {
  if (a === null || a === undefined || b === null || b === undefined) return null;
  const left = toMinorUnits(a.amount);
  const right = toMinorUnits(b.amount);
  if (left === null || right === null) return null;
  return fromMinorUnits(left - right, a.currency);
}

/** Exact division by a positive integer (e.g. units sold), half-up to the cent. */
export function divideMoney(value: Money | null | undefined, divisor: number): Money | null {
  if (value === null || value === undefined) return null;
  const cents = toMinorUnits(value.amount);
  const units = BigInt(Math.round(divisor));
  if (cents === null || units <= 0n) return null;
  const half = units / 2n;
  const quotient = cents >= 0n ? (cents + half) / units : (cents - half) / units;
  return fromMinorUnits(quotient, value.currency);
}

/** `part / whole * 100`, or `null` when the denominator is zero/missing. */
export function pctOf(
  part: Money | null | undefined,
  whole: Money | null | undefined,
): number | null {
  const left = part === null || part === undefined ? null : toMinorUnits(part.amount);
  const right = whole === null || whole === undefined ? null : toMinorUnits(whole.amount);
  if (left === null || right === null || right === 0n) return null;
  return (Number(left) / Number(right)) * 100;
}

/** Numeric amount for chart datasets (display always uses the money pipe). */
export function moneyAmount(value: Money | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const amount = Number(value.amount);
  return Number.isFinite(amount) ? amount : null;
}

/** Percentage change from `previous` to `current`, or `null` without a base. */
export function percentChange(
  current: number | null | undefined,
  previous: number | null | undefined,
): number | null {
  if (
    current === null ||
    current === undefined ||
    previous === null ||
    previous === undefined ||
    previous === 0
  ) {
    return null;
  }
  return ((current - previous) / previous) * 100;
}

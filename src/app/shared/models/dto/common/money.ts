/**
 * Monetary value as consumed by the frontend.
 *
 * The backend serializes Java's `Money` class as an object:
 *
 * ```json
 * { "amount": "15000.00", "currency": "COP" }
 * ```
 *
 * `MoneyDto` is that exact wire shape (amount is a decimal **string**). The
 * older `Money` interface is kept as the transitional type: it allows both the
 * wire string and a bare number, because a few payloads (and most test
 * fixtures) still carry numbers. Never do arithmetic directly on `amount` —
 * `"15000.00" + "2500.00"` is a string concatenation and `amount > 0` on the
 * wire shape silently compares a string. Use `toAmount()` instead.
 */

/** Wire shape of every monetary field returned by the backend. */
export interface MoneyDto {
  /** Decimal string, e.g. `"15000.00"`. */
  amount: string;
  /** ISO currency code, e.g. `"COP"`. */
  currency: string;
}

/**
 * Transitional money type: the wire sends `MoneyDto` (string amount), but old
 * payloads/specs still carry bare numbers. Both are accepted; normalize with
 * `toAmount()` before any math.
 */
export interface Money {
  amount: number | string;
  currency: string;
}

/**
 * Minimum structural shape a money object must expose. `currency` is optional
 * so that partial payloads and test fixtures remain assignable.
 */
export interface MoneyLikeObject {
  amount: number | string;
  currency?: string | null;
}

/** Anything that can carry a monetary amount. */
export type MoneyLike = MoneyLikeObject | number | string | null | undefined;

/**
 * Normalizes any accepted money representation to a finite number.
 *
 * Single source of truth for "what is this monetary value worth" — every
 * aggregation (`reduce`, `+`, `*`, `>`) over a money field must go through it,
 * otherwise the sum of two `MoneyDto` objects is `NaN` (or a concatenated
 * string).
 *
 * Returns `null` when the value carries no usable amount (null, undefined, NaN,
 * blank string, malformed object, `{}`), so callers can distinguish "missing"
 * from a real `0`.
 */
export function tryToAmount(value: MoneyLike): number | null {
  if (value === null || value === undefined) return null;

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length === 0) return null;
    const parsed = Number.parseFloat(trimmed);
    return Number.isNaN(parsed) ? null : parsed;
  }

  // Object shape: `{ amount, currency }`. A missing/typeless amount lands here
  // too (e.g. `{}`), which `typeof undefined !== 'number'` turns into NaN.
  const raw: unknown = value.amount;
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? raw : null;
  }
  if (typeof raw === 'string') {
    const parsed = Number.parseFloat(raw.trim());
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

/**
 * Same as `tryToAmount`, but coerces unusable values to `0` so aggregations
 * always stay finite (`reduce((sum, x) => sum + toAmount(x.amount), 0)`).
 */
export function toAmount(value: MoneyLike): number {
  return tryToAmount(value) ?? 0;
}

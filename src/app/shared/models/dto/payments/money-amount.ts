/**
 * Cashier money-input helpers.
 *
 * `MoneyDto.amount` is a decimal string with two fraction digits. Cashiers
 * type amounts by hand, sometimes with the es-CO notation the rest of the app
 * renders ("50.000,50"), so parsing and serialization live in one place:
 *
 *  - `parseMoneyInput()` accepts `"50000"`, `"50000.50"` and `"50.000,50"`;
 *    anything else (letters, empty, mixed separators) is `null`.
 *  - `formatMoneyAmount()` is the wire value sent to the API (`"50000.00"`).
 *  - `formatMoneyInput()` is the editable value shown back to the cashier:
 *    no trailing `.00`, two decimals only when they are meaningful.
 */

/** Parses a hand-typed amount into a finite number, or `null` when unusable. */
export function parseMoneyInput(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;

  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;

  let normalized = trimmed.replace(/\s/g, '');
  if (normalized.includes(',')) {
    // es-CO: "." groups thousands and "," is the decimal separator.
    normalized = normalized.replace(/\./g, '').replace(',', '.');
  }

  if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) return null;

  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

/** Serializes a number as the two-decimal wire string the API expects. */
export function formatMoneyAmount(amount: number): string {
  return Number.isFinite(amount) ? amount.toFixed(2) : '0.00';
}

/** Formats a number for an editable field without noise decimals. */
export function formatMoneyInput(amount: number): string {
  if (!Number.isFinite(amount)) return '';
  const rounded = Math.round(amount * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

import { Pipe, PipeTransform } from '@angular/core';

/**
 * Single source of truth for the currency the backend bills in.
 *
 * The backend serializes money as a bare JSON number with no currency
 * information, so the frontend must supply the currency itself. Every money
 * render in the app goes through this pipe, which means this constant is the
 * only place a currency code is declared.
 */
export const DEFAULT_CURRENCY = 'COP';

/**
 * Locale used for money formatting. Matches the operating market
 * (Colombia): thousands separator `.`, decimal separator `,`.
 */
export const DEFAULT_LOCALE = 'es-CO';

/**
 * Minimum structural shape of a money value.
 *
 * Two `Money` interfaces live in the codebase today
 * (`dto/common/money.ts` → `amount: number`, `dto/analytics/money.ts` →
 * `amount: string`). Both are structurally assignable to this shape, and the
 * wire contract itself is a bare number, so the pipe accepts all of them.
 */
export interface MoneyLike {
  amount: number | string;
  currency?: string | null;
}

/** Anything the pipe knows how to render. */
export type MoneyInput = MoneyLike | number | string | null | undefined;

/** Placeholder shown when there is no usable amount. */
const EMPTY_VALUE = '—';

interface ParsedMoney {
  amount: number;
  currency: string;
}

/**
 * Normalizes any accepted money representation into `{ amount, currency }`.
 * Returns `null` when there is nothing sensible to format.
 */
function parseMoney(value: MoneyInput): ParsedMoney | null {
  if (value === null || value === undefined) return null;

  if (typeof value === 'number') {
    return Number.isFinite(value) ? { amount: value, currency: DEFAULT_CURRENCY } : null;
  }

  if (typeof value === 'string') {
    const amount = Number.parseFloat(value.trim());
    return Number.isNaN(amount) ? null : { amount, currency: DEFAULT_CURRENCY };
  }

  const amount =
    typeof value.amount === 'number' ? value.amount : Number.parseFloat(value.amount);
  if (!Number.isFinite(amount)) return null;

  const currency = value.currency?.trim() ?? '';
  return { amount, currency: currency.length > 0 ? currency : DEFAULT_CURRENCY };
}

/**
 * Formats money for display.
 *
 * Accepted inputs:
 *  - `{ amount, currency }` money objects (both local `Money` interfaces)
 *  - bare numbers, which is what the backend actually sends
 *  - numeric strings
 *  - null / undefined / NaN → em dash
 *
 * COP renders without decimals (the currency has no minor unit), every other
 * currency renders with two.
 *
 * ```html
 * {{ order.total | money }}          <!-- "$ 1.234" -->
 * {{ detail.unitPrice | money }}     <!-- "$ 12.500" -->
 * -{{ discount | money }}            <!-- minus sign stays outside the pipe -->
 * ```
 */
@Pipe({ name: 'money', standalone: true })
export class Money implements PipeTransform {
  transform(value: MoneyInput, locale: string = DEFAULT_LOCALE): string {
    const parsed = parseMoney(value);
    if (parsed === null) return EMPTY_VALUE;

    const { amount, currency } = parsed;
    const decimals = currency === DEFAULT_CURRENCY ? 0 : 2;

    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(amount);
    } catch {
      // Unknown currency code for this runtime — degrade to a readable string
      // instead of breaking the view.
      return `${currency} ${amount.toLocaleString(locale, { maximumFractionDigits: decimals })}`;
    }
  }
}

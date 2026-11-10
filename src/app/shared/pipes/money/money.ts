import { Pipe, PipeTransform } from '@angular/core';

import { tryToAmount, type MoneyLike } from '@app/shared/models/dto/common/money';

export type { MoneyLike };

/**
 * Single source of truth for the currency the backend bills in.
 *
 * Every money render in the app goes through this pipe, which means this
 * constant is the only place a currency code is declared. Monetary values
 * arrive as `MoneyDto` (`{ amount: "15000.00", currency: "COP" }`); when a
 * payload carries no currency object, this is the fallback.
 */
export const DEFAULT_CURRENCY = 'COP';

/**
 * Locale used for money formatting. Matches the operating market
 * (Colombia): thousands separator `.`, decimal separator `,`.
 */
export const DEFAULT_LOCALE = 'es-CO';

/**
 * Anything the pipe knows how to render.
 *
 * `MoneyLike` is defined in `dto/common/money.ts` (single source of truth) and
 * covers every money shape in the codebase: the wire `MoneyDto`
 * (`{ amount: "15000.00", currency: "COP" }`), the legacy common `Money`
 * (`amount: number`), the analytics `Money` (`amount: string`), bare numbers
 * and numeric strings.
 */
export type MoneyInput = MoneyLike;

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
  const amount = tryToAmount(value);
  if (amount === null) return null;

  const currency =
    typeof value === 'object' && value !== null ? (value.currency?.trim() ?? '') : '';

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

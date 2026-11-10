/**
 * Tests for the money DTO normalization helpers.
 *
 * Feature: `toAmount()` / `tryToAmount()` turn every money representation the
 * app can receive into a usable `number`, and `MoneyLike` is the single type
 * describing those representations.
 * Contract:
 *  - `MoneyDto` object (`{ amount: "15000.00", currency: "COP" }`) → 15000
 *  - numeric string ("2500.50") → 2500.5
 *  - bare number (15000) → 15000
 *  - null / undefined / NaN / NaN-string / empty object → `toAmount` returns 0
 *    (so aggregations stay finite) and `tryToAmount` returns null (so callers
 *    can tell "missing" from a real 0)
 *  - adding two normalized amounts yields the exact arithmetic total, never
 *    `NaN` or a string concatenation
 *
 * Approach: call the pure helpers directly with controlled inputs and assert
 * the exact numeric result (including `Number.isNaN` checks on the old,
 * broken behavior).
 */
import { describe, expect, it } from 'vitest';

import {
  toAmount,
  tryToAmount,
  type Money,
  type MoneyDto,
  type MoneyLike,
} from './money';

describe('toAmount', () => {
  it('extracts the numeric amount from a MoneyDto object', () => {
    const value: MoneyLike = { amount: '15000.00', currency: 'COP' };

    expect(toAmount(value)).toBe(15000);
  });

  it('extracts the numeric amount from a legacy Money object', () => {
    const value: MoneyLike = { amount: 15000, currency: 'COP' };

    expect(toAmount(value)).toBe(15000);
  });

  it('parses a numeric string', () => {
    expect(toAmount('2500.50')).toBe(2500.5);
  });

  it('passes a bare number through', () => {
    expect(toAmount(15000)).toBe(15000);
  });

  it('returns 0 for null', () => {
    expect(toAmount(null)).toBe(0);
  });

  it('returns 0 for undefined', () => {
    expect(toAmount(undefined)).toBe(0);
  });

  it('returns 0 for NaN', () => {
    expect(toAmount(Number.NaN)).toBe(0);
  });

  it('returns 0 for a non-numeric amount string', () => {
    expect(toAmount({ amount: 'notanumber', currency: 'COP' })).toBe(0);
  });

  it('returns 0 for an empty object', () => {
    expect(toAmount({} as MoneyLike)).toBe(0);
  });

  it('returns 0 for a blank string', () => {
    expect(toAmount('   ')).toBe(0);
  });

  it('keeps negative amounts and zero intact', () => {
    expect(toAmount({ amount: '-1500.00', currency: 'COP' })).toBe(-1500);
    expect(toAmount({ amount: '0.00', currency: 'COP' })).toBe(0);
  });
});

describe('tryToAmount', () => {
  it('returns the exact amount for a MoneyDto', () => {
    const dto: MoneyDto = { amount: '17500.00', currency: 'COP' };

    expect(tryToAmount(dto)).toBe(17500);
  });

  it('returns null when the value carries no usable amount', () => {
    expect(tryToAmount(null)).toBeNull();
    expect(tryToAmount(undefined)).toBeNull();
    expect(tryToAmount('notanumber')).toBeNull();
  });

  it('distinguishes a real zero from a missing value', () => {
    expect(tryToAmount({ amount: '0.00', currency: 'COP' })).toBe(0);
    expect(tryToAmount({} as Money)).toBeNull();
  });
});

describe('money aggregation safety', () => {
  it('sums two MoneyDto amounts exactly instead of producing NaN', () => {
    const first: MoneyLike = { amount: '15000.00', currency: 'COP' };
    const second: MoneyLike = { amount: '2500.00', currency: 'COP' };

    // The naive sum is what broke production: `+"15000.00" + "2500.00"` on the
    // raw `amount` fields, or object + object, is a string concatenation, so
    // the aggregate is never a usable number. Normalization keeps it numeric.
    const total = [first, second].reduce<number>((sum, value) => sum + toAmount(value), 0);
    expect(Number.isNaN(total)).toBe(false);
    expect(total).toBe(17500);
  });

  it('keeps a mixed MoneyDto/number list finite when an entry is missing', () => {
    const values: MoneyLike[] = [{ amount: '15000.00', currency: 'COP' }, null, 2500];

    const total = values.reduce<number>((sum, value) => sum + toAmount(value), 0);
    expect(total).toBe(17500);
  });
});

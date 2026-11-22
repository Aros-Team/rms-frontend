/**
 * Tests for the recipe costing decimal math.
 *
 * Feature: exact material/labor/margin math for the recipe page.
 * Contract:
 *  - money arrives as decimal strings and is never added as floats
 *  - a line cost is quantity (max 3 decimals) × unit cost
 *  - cost totals round to cents; suggested price is cost × 1.3
 *  - margin and food-cost percentages are null without a sale price
 *  - invalid/empty input returns null instead of 0 so "missing" stays visible
 *
 * Approach: pure functions, exact assertions on micro-units and formatted
 * strings, plus the boundary cases the UI relies on (comma decimals, more
 * precision than allowed, zero/negative quantities).
 */
import { describe, expect, it } from 'vitest';

import {
  currencyOf,
  decimalToScaled,
  formatAmountInput,
  formatPercent,
  formatQuantityInput,
  hourlyRateMicro,
  laborForPrepMinutes,
  lineCostMicro,
  marginOf,
  microToAmountString,
  microToMoney,
  microToNumber,
  moneyToMicro,
  parseDecimal,
  quantityToMilli,
  roundMicroToCents,
  suggestedPriceMicro,
  sumMicro,
} from './recipe-costing';

function money(amount: string, currency = 'COP') {
  return { amount, currency };
}

describe('parseDecimal', () => {
  it('accepts a comma decimal separator', () => {
    expect(parseDecimal('0,25')).toBe(0.25);
  });

  it('accepts a dot decimal separator', () => {
    expect(parseDecimal('2.5')).toBe(2.5);
  });

  it('rejects thousands separators and prose', () => {
    expect(parseDecimal('1.500,25')).toBeNull();
    expect(parseDecimal('dos')).toBeNull();
    expect(parseDecimal('')).toBeNull();
  });

  it('returns null for null and undefined', () => {
    expect(parseDecimal(null)).toBeNull();
    expect(parseDecimal(undefined)).toBeNull();
  });
});

describe('decimalToScaled', () => {
  it('scales a string exactly to micro-units', () => {
    expect(decimalToScaled('1500.50', 6)).toBe(1_500_500_000n);
  });

  it('rejects more decimals than the scale allows', () => {
    expect(decimalToScaled('0.1234', 3)).toBeNull();
  });

  it('keeps the sign', () => {
    expect(decimalToScaled('-2.5', 6)).toBe(-2_500_000n);
  });
});

describe('lineCostMicro', () => {
  it('multiplies quantity by unit cost exactly', () => {
    // 0.5 × 2000 = 1000
    expect(lineCostMicro('0.5', money('2000.00'))).toBe(1_000_000_000n);
  });

  it('supports three-decimal quantities without float drift', () => {
    // 0.001 × 1500.50 = 1.5005
    expect(lineCostMicro('0,001', money('1500.50'))).toBe(1_500_500n);
  });

  it('returns null for zero or negative quantities', () => {
    expect(lineCostMicro('0', money('2000.00'))).toBeNull();
    expect(lineCostMicro('-1', money('2000.00'))).toBeNull();
  });

  it('returns null when the variant has no unit cost', () => {
    expect(lineCostMicro('1', { amount: '', currency: 'COP' })).toBeNull();
    expect(lineCostMicro('1', null)).toBeNull();
  });

  it('returns zero for a real zero unit cost', () => {
    expect(lineCostMicro('2', money('0.00'))).toBe(0n);
  });
});

describe('sumMicro and rounding', () => {
  it('skips missing amounts instead of treating them as zero silently', () => {
    expect(sumMicro([1_000_000n, null, 2_500_000n])).toBe(3_500_000n);
  });

  it('rounds half a cent up', () => {
    expect(roundMicroToCents(1_005_000n)).toBe(1_010_000n);
  });

  it('rounds negative half cents away from zero', () => {
    expect(roundMicroToCents(-1_005_000n)).toBe(-1_010_000n);
  });

  it('formats micro-units with two decimals', () => {
    expect(microToAmountString(16_112_740_000n)).toBe('16112.74');
  });
});

describe('money conversion', () => {
  it('reads a MoneyDto string exactly', () => {
    expect(moneyToMicro(money('16112.74'))).toBe(16_112_740_000n);
  });

  it('preserves the payload currency', () => {
    expect(microToMoney(1_000_000n, 'USD')).toEqual({ amount: '1.00', currency: 'USD' });
  });

  it('falls back to COP when the payload has no currency', () => {
    expect(currencyOf({ amount: 10 })).toBe('COP');
    expect(currencyOf(money('10.00', 'EUR'))).toBe('EUR');
  });

  it('converts micro-units back to a number for percentages', () => {
    expect(microToNumber(2_500_000n)).toBe(2.5);
  });
});

describe('marginOf', () => {
  it('computes a positive margin and the food-cost percentage', () => {
    // price 28000, cost 11200 → margin 60 %, food cost 40 %
    const margin = marginOf(28_000_000_000n, 11_200_000_000n);
    expect(margin.amountMicro).toBe(16_800_000_000n);
    expect(margin.percent).toBeCloseTo(60, 6);
    expect(margin.foodCostPercent).toBeCloseTo(40, 6);
  });

  it('reports a negative margin when the price is below cost', () => {
    const margin = marginOf(10_000_000n, 15_000_000n);
    expect(margin.amountMicro).toBe(-5_000_000n);
    expect(margin.percent).toBeCloseTo(-50, 6);
  });

  it('returns null percentages without a sale price', () => {
    const margin = marginOf(0n, 15_000_000n);
    expect(margin.percent).toBeNull();
    expect(margin.foodCostPercent).toBeNull();
  });

  it('formats percentages with a Spanish comma', () => {
    expect(formatPercent(42.44)).toBe('42,4 %');
    expect(formatPercent(null)).toBe('—');
  });
});

describe('suggestedPriceMicro', () => {
  it('applies the documented ×1.3 markup and rounds to cents', () => {
    // 25.75 × 1.3 = 33.475 → 33.48
    expect(suggestedPriceMicro(25_750_000n)).toBe(33_480_000n);
  });

  it('returns zero when there is no cost', () => {
    expect(suggestedPriceMicro(0n)).toBe(0n);
  });
});

describe('labor proration', () => {
  it('keeps the server labor cost when the minutes did not change', () => {
    expect(laborForPrepMinutes(2_782_740n, 10, 10)).toBe(2_782_740n);
  });

  it('prorates the server labor cost for a different preparation time', () => {
    // 2782.74 at 10 min → 1391.37 at 5 min
    expect(laborForPrepMinutes(2_782_740n, 10, 5)).toBe(1_391_370n);
  });

  it('returns null when the server labor cost is unknown', () => {
    expect(laborForPrepMinutes(null, 10, 5)).toBeNull();
  });

  it('derives the hourly rate the API applied', () => {
    // 2782.74 in 10 min → 16696.44 / h
    expect(hourlyRateMicro(2_782_740n, 10)).toBe(16_696_440n);
  });

  it('returns null without prep minutes', () => {
    expect(hourlyRateMicro(2_782_740n, 0)).toBeNull();
  });
});

describe('input formatting', () => {
  it('formats quantities with at most three decimals', () => {
    expect(formatQuantityInput(0.25)).toBe('0.25');
    expect(formatQuantityInput(1)).toBe('1');
    expect(formatQuantityInput(null)).toBe('');
  });

  it('formats a MoneyDto for a price input without trailing zeros', () => {
    expect(formatAmountInput(money('28000.00'))).toBe('28000');
  });

  it('keeps exact quantity precision', () => {
    expect(quantityToMilli('0,001')).toBe(1n);
  });
});

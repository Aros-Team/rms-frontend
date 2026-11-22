/**
 * Tests for the analytics money helpers.
 *
 * Feature: exact aggregation of `MoneyDto` decimal strings.
 * Contract: no float drift, invalid amounts ignored, null when nothing to sum.
 * Approach: pure functions with hand-checked values.
 */
import { describe, expect, it } from 'vitest';

import {
  divideMoney,
  fromMinorUnits,
  moneyAmount,
  pctOf,
  percentChange,
  subtractMoney,
  sumMoney,
  toMinorUnits,
} from './analytics-money';

const cop = (amount: string): { amount: string; currency: string } => ({ amount, currency: 'COP' });

describe('toMinorUnits / fromMinorUnits', () => {
  it('parses signed decimal strings exactly', () => {
    expect(toMinorUnits('125000000.00')).toBe(12500000000n);
    expect(toMinorUnits('-8000000.50')).toBe(-800000050n);
    expect(toMinorUnits('0.1')).toBe(10n);
    expect(toMinorUnits(' 3012700 ')).toBe(301270000n);
  });

  it('rejects malformed amounts', () => {
    expect(toMinorUnits('')).toBeNull();
    expect(toMinorUnits('abc')).toBeNull();
    expect(toMinorUnits('1,50')).toBeNull();
  });

  it('round-trips to a two-decimal money value', () => {
    expect(fromMinorUnits(10799748444n, 'COP')).toEqual(cop('107997484.44'));
  });
});

describe('sumMoney', () => {
  it('sums without floating-point drift', () => {
    const total = sumMoney([cop('0.10'), cop('0.20')]);
    expect(total).toEqual(cop('0.30'));
  });

  it('ignores nulls and returns null when there is nothing to sum', () => {
    expect(sumMoney([null, cop('10.00'), undefined])).toEqual(cop('10.00'));
    expect(sumMoney([null, undefined])).toBeNull();
  });

  it('keeps the currency of the first amount', () => {
    expect(sumMoney([{ amount: '1.00', currency: 'USD' }, cop('2.00')])?.currency).toBe('USD');
  });
});

describe('subtract / divide / pct', () => {
  it('subtracts exactly', () => {
    expect(subtractMoney(cop('107997484.44'), cop('33500000.00'))).toEqual(cop('74497484.44'));
    expect(subtractMoney(null, cop('1.00'))).toBeNull();
  });

  it('divides by units with half-up rounding', () => {
    expect(divideMoney(cop('100.00'), 3)).toEqual(cop('33.33'));
    expect(divideMoney(cop('10.00'), 0)).toBeNull();
  });

  it('computes a percentage and refuses a zero denominator', () => {
    expect(pctOf(cop('25.00'), cop('100.00'))).toBe(25);
    expect(pctOf(cop('25.00'), cop('0.00'))).toBeNull();
    expect(pctOf(null, cop('100.00'))).toBeNull();
  });

  it('formats an amount for chart datasets', () => {
    expect(moneyAmount(cop('125000000.00'))).toBe(125000000);
    expect(moneyAmount(null)).toBeNull();
  });
});

describe('percentChange', () => {
  it('returns the change against a real base', () => {
    expect(percentChange(120, 100)).toBe(20);
    expect(percentChange(80, 100)).toBe(-20);
  });

  it('returns null without a base', () => {
    expect(percentChange(10, 0)).toBeNull();
    expect(percentChange(null, 10)).toBeNull();
  });
});

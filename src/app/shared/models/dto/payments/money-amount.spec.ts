/**
 * Tests for the cashier money-input helpers.
 *
 * Feature: parse hand-typed amounts and serialize them for the payments API.
 * Contract:
 *  - plain (`50000`), dot-decimal (`50000.50`) and es-CO (`50.000,50`) inputs
 *    parse to the same numeric amount;
 *  - negatives are parsed (validation happens later), garbage is `null`;
 *  - the wire form always has two decimals, the editable form drops `.00`.
 *
 * Approach: call the pure helpers directly and assert exact values.
 */
import { describe, expect, it } from 'vitest';

import { formatMoneyAmount, formatMoneyInput, parseMoneyInput } from './money-amount';

describe('parseMoneyInput', () => {
  it('parses a plain integer amount', () => {
    expect(parseMoneyInput('50000')).toBe(50000);
  });

  it('parses a dot-decimal amount', () => {
    expect(parseMoneyInput('50000.50')).toBe(50000.5);
  });

  it('parses the es-CO format with thousands dots and a decimal comma', () => {
    expect(parseMoneyInput('50.000,50')).toBe(50000.5);
  });

  it('trims surrounding whitespace', () => {
    expect(parseMoneyInput('  58000  ')).toBe(58000);
  });

  it('keeps a negative amount for later validation', () => {
    expect(parseMoneyInput('-4000')).toBe(-4000);
  });

  it('returns null for empty, blank and non-numeric input', () => {
    expect(parseMoneyInput('')).toBeNull();
    expect(parseMoneyInput('   ')).toBeNull();
    expect(parseMoneyInput('abc')).toBeNull();
    expect(parseMoneyInput('1,2,3')).toBeNull();
    expect(parseMoneyInput('50.000.00')).toBeNull();
  });

  it('returns null for null and undefined', () => {
    expect(parseMoneyInput(null)).toBeNull();
    expect(parseMoneyInput(undefined)).toBeNull();
  });
});

describe('formatMoneyAmount', () => {
  it('serializes with two decimals for the wire', () => {
    expect(formatMoneyAmount(58000)).toBe('58000.00');
    expect(formatMoneyAmount(58000.5)).toBe('58000.50');
  });

  it('never emits NaN to the API', () => {
    expect(formatMoneyAmount(Number.NaN)).toBe('0.00');
  });
});

describe('formatMoneyInput', () => {
  it('drops the noise decimals of a whole amount', () => {
    expect(formatMoneyInput(58000)).toBe('58000');
  });

  it('keeps meaningful cents', () => {
    expect(formatMoneyInput(58000.5)).toBe('58000.50');
  });

  it('rounds and normalizes floating-point noise', () => {
    expect(formatMoneyInput(58000.999)).toBe('58001');
  });
});

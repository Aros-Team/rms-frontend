/**
 * Tests for analytics utility functions.
 *
 * Feature: Pure helper functions for period comparison, default periods, and formatting.
 * Contract: comparePeriodKeys orders correctly; defaultPeriod returns current month; etc.
 * Approach: Import functions directly, pass controlled inputs, assert exact outputs.
 */
import { describe, expect, it } from 'vitest';

import {
  comparePeriodKeys,
  defaultPeriod,
  isValidPeriodKey,
  isValidRange,
  titleForKey,
} from './analytics-utils';

describe('isValidPeriodKey', () => {
  it('accepts a well-formed monthly key', () => {
    expect(isValidPeriodKey('2026-07')).toBe(true);
  });

  it('rejects a monthly key missing the leading zero on the month', () => {
    expect(isValidPeriodKey('2026-7')).toBe(false);
  });

  it('does not enforce the 1..12 range for monthly keys client-side', () => {
    expect(isValidPeriodKey('2026-99')).toBe(true);
  });

  it('rejects daily, weekly and yearly formats (monthly only)', () => {
    expect(isValidPeriodKey('2026-07-17')).toBe(false);
    expect(isValidPeriodKey('2026-W29')).toBe(false);
    expect(isValidPeriodKey('2026')).toBe(false);
  });
});

describe('comparePeriodKeys', () => {
  it('returns negative when the first key is earlier than the second', () => {
    expect(comparePeriodKeys('2026-01', '2026-07')).toBeLessThan(0);
  });

  it('returns zero when keys are equal', () => {
    expect(comparePeriodKeys('2026-07', '2026-07')).toBe(0);
  });
});

describe('isValidRange', () => {
  it('returns true for an ordered monthly range', () => {
    expect(isValidRange('2026-01', '2026-07')).toBe(true);
  });

  it('returns false when to is earlier than from', () => {
    expect(isValidRange('2026-07', '2026-01')).toBe(false);
  });

  it('returns false when either endpoint is not a valid monthly key', () => {
    expect(isValidRange('2026-7', '2026-07')).toBe(false);
    expect(isValidRange('2026-07', 'not-a-key')).toBe(false);
  });
});

describe('defaultPeriod', () => {
  it('returns a range covering 5 months ago through the current month', () => {
    const fixedNow = new Date(Date.UTC(2026, 6, 17));
    const result = defaultPeriod(fixedNow);

    expect(result).toEqual({ from: '2026-02', to: '2026-07' });
  });
});

describe('titleForKey', () => {
  it('returns a Spanish title containing the month name and year for monthly keys', () => {
    const title = titleForKey('2026-07');
    const expected = new Intl.DateTimeFormat('es-CO', { year: 'numeric', month: 'long' }).format(
      new Date(Date.UTC(2026, 6, 1)),
    );
    expect(title).toBe(expected);
    expect(title).toContain('2026');
  });
});

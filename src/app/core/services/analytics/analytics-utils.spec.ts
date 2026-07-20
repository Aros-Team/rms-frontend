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
    expect(isValidPeriodKey('2026-07', 'monthly')).toBe(true);
  });

  it('rejects a monthly key missing the leading zero on the month', () => {
    expect(isValidPeriodKey('2026-7', 'monthly')).toBe(false);
  });

  it('accepts a well-formed weekly key', () => {
    expect(isValidPeriodKey('2026-W29', 'weekly')).toBe(true);
  });

  it('does not enforce the 1..12 range for monthly keys client-side', () => {
    expect(isValidPeriodKey('2026-99', 'monthly')).toBe(true);
  });

  it('accepts a well-formed daily key', () => {
    expect(isValidPeriodKey('2026-07-17', 'daily')).toBe(true);
  });

  it('accepts a well-formed yearly key', () => {
    expect(isValidPeriodKey('2026', 'yearly')).toBe(true);
  });
});

describe('comparePeriodKeys', () => {
  it('returns negative when the first key is earlier than the second (monthly)', () => {
    expect(comparePeriodKeys('2026-01', '2026-07', 'monthly')).toBeLessThan(0);
  });

  it('returns zero when keys are equal', () => {
    expect(comparePeriodKeys('2026-07', '2026-07', 'monthly')).toBe(0);
  });

  it('orders weekly keys chronologically', () => {
    expect(comparePeriodKeys('2026-W10', '2026-W29', 'weekly')).toBeLessThan(0);
    expect(comparePeriodKeys('2026-W29', '2025-W52', 'weekly')).toBeGreaterThan(0);
  });
});

describe('isValidRange', () => {
  it('returns true for an ordered monthly range', () => {
    expect(isValidRange('2026-01', '2026-07', 'monthly')).toBe(true);
  });

  it('returns false when to is earlier than from', () => {
    expect(isValidRange('2026-07', '2026-01', 'monthly')).toBe(false);
  });

  it('returns false when either endpoint is not a valid key for the bucket', () => {
    expect(isValidRange('2026-7', '2026-07', 'monthly')).toBe(false);
    expect(isValidRange('2026-07', 'not-a-key', 'monthly')).toBe(false);
  });
});

describe('defaultPeriod', () => {
  it('returns bucket=monthly covering 5 months ago through the current month', () => {
    const fixedNow = new Date(Date.UTC(2026, 6, 17));
    const result = defaultPeriod(fixedNow);

    expect(result).toEqual({ bucket: 'monthly', from: '2026-02', to: '2026-07' });
  });
});

describe('titleForKey', () => {
  it('returns a Spanish title containing the month name and year for monthly keys', () => {
    const title = titleForKey('2026-07', 'monthly');
    const expected = new Intl.DateTimeFormat('es-CO', { year: 'numeric', month: 'long' }).format(
      new Date(Date.UTC(2026, 6, 1)),
    );
    expect(title).toBe(expected);
    expect(title).toContain('2026');
  });

  it('returns the raw key for yearly buckets', () => {
    expect(titleForKey('2026', 'yearly')).toBe('2026');
  });
});
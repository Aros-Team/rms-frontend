/**
 * Tests for the shared analytics period helpers.
 *
 * Feature: bucket keys, inclusive ranges, presets, previous period and labels.
 * Contract: every key uses the API format for its bucket, ranges are ordered,
 * the label is derived from the same keys that go on the wire, and the previous
 * range has the same bucket count.
 * Approach: pure functions with a frozen UTC date.
 */
import { describe, expect, it } from 'vitest';

import {
  bucketCount,
  comparePeriodKeys,
  currentKey,
  defaultPresetFor,
  isValidBucketKey,
  isValidRange,
  keyForDate,
  previousRange,
  rangeForLast,
  rangeLabel,
  rangeToDates,
  shiftKey,
  titleForKey,
} from './analytics-utils';

const NOW = new Date(Date.UTC(2026, 10, 21)); // 2026-11-21

describe('bucket keys', () => {
  it('formats each bucket from the same date', () => {
    expect(keyForDate('daily', NOW)).toBe('2026-11-21');
    expect(keyForDate('weekly', NOW)).toMatch(/^2026-W\d{2}$/);
    expect(keyForDate('monthly', NOW)).toBe('2026-11');
    expect(keyForDate('yearly', NOW)).toBe('2026');
  });

  it('accepts only the format of the requested bucket', () => {
    expect(isValidBucketKey('daily', '2026-11-21')).toBe(true);
    expect(isValidBucketKey('daily', '2026-11')).toBe(false);
    expect(isValidBucketKey('weekly', '2026-W47')).toBe(true);
    expect(isValidBucketKey('weekly', '2026-W99')).toBe(false);
    expect(isValidBucketKey('monthly', '2026-11')).toBe(true);
    expect(isValidBucketKey('monthly', '2026-13')).toBe(false);
    expect(isValidBucketKey('yearly', '2026')).toBe(true);
    expect(isValidBucketKey('yearly', '26')).toBe(false);
  });

  it('orders keys lexicographically, including zero-padded ISO weeks', () => {
    expect(comparePeriodKeys('2026-W09', '2026-W10')).toBeLessThan(0);
    expect(comparePeriodKeys('2026-07', '2026-07')).toBe(0);
  });
});

describe('ranges', () => {
  it('builds the last N buckets ending at now', () => {
    expect(rangeForLast('monthly', 6, NOW)).toEqual({ from: '2026-06', to: '2026-11' });
    expect(rangeForLast('daily', 7, NOW)).toEqual({ from: '2026-11-15', to: '2026-11-21' });
    expect(rangeForLast('yearly', 3, NOW)).toEqual({ from: '2024', to: '2026' });
  });

  it('rejects inverted ranges and daily ranges over 366 days', () => {
    expect(isValidRange('monthly', '2026-11', '2026-06')).toBe(false);
    expect(isValidRange('monthly', '2025-11', '2026-11')).toBe(true);
    expect(isValidRange('daily', '2025-01-01', '2026-11-21')).toBe(false);
  });

  it('returns the immediately previous range with the same bucket count', () => {
    expect(previousRange('monthly', '2026-06', '2026-11')).toEqual({
      from: '2025-12',
      to: '2026-05',
    });
    expect(bucketCount('monthly', '2026-06', '2026-11')).toBe(6);
    expect(previousRange('daily', '2026-11-15', '2026-11-21')).toEqual({
      from: '2026-11-08',
      to: '2026-11-14',
    });
  });

  it('shifts a key by whole buckets', () => {
    expect(shiftKey('monthly', '2026-01', -1)).toBe('2025-12');
    expect(shiftKey('yearly', '2026', 1)).toBe('2027');
    expect(shiftKey('daily', '2026-11-01', -1)).toBe('2026-10-31');
  });

  it('converts an inclusive bucket range to concrete ISO dates', () => {
    expect(rangeToDates('monthly', '2026-06', '2026-07')).toEqual({
      from: '2026-06-01',
      to: '2026-07-31',
    });
    expect(rangeToDates('daily', '2026-06-01', '2026-06-30')).toEqual({
      from: '2026-06-01',
      to: '2026-06-30',
    });
  });
});

describe('labels and presets', () => {
  it('labels monthly, daily, weekly and yearly keys', () => {
    expect(titleForKey('monthly', '2026-07')).toContain('julio');
    expect(titleForKey('monthly', '2026-07')).toContain('2026');
    expect(titleForKey('daily', '2026-07-17')).toContain('2026');
    expect(titleForKey('weekly', '2026-W29')).toBe('Semana 29 · 2026');
    expect(titleForKey('yearly', '2026')).toBe('2026');
  });

  it('derives the range label from the applied keys (no offset)', () => {
    const from = '2026-06';
    const to = '2026-11';
    expect(rangeLabel('monthly', from, to)).toBe(
      `${titleForKey('monthly', from)} – ${titleForKey('monthly', to)}`,
    );
    expect(rangeLabel('monthly', to, to)).toBe(titleForKey('monthly', to));
  });

  it('uses the current bucket for the default key and a valid default preset', () => {
    expect(currentKey('monthly', NOW)).toBe('2026-11');
    expect(defaultPresetFor('monthly').id).toBe('last-6');
    expect(defaultPresetFor('daily').count).toBe(30);
  });
});

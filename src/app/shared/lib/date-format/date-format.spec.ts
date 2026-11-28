/**
 * Tests for the shared wire-date helpers.
 *
 * Feature: two distinct backend date shapes — `LocalDate` (`YYYY-MM-DD`) and
 * `Instant` (ISO date-time with/without `Z`/offset) — rendered as Spanish text.
 * Contract:
 *  - `toIsoDate()` writes local calendar parts, so a date never shifts a day;
 *  - `formatIsoDate()` renders `dd/mm/aaaa` and keeps working if it is handed a
 *    date-time by mistake (only the date part is rendered);
 *  - `parseIsoDate()` returns a local `Date` or `null` for malformed dates and
 *    for days that do not exist (`2026-02-31`);
 *  - `formatInstant()` renders `dd/mm/aaaa HH:mm` (24h), accepts `Z` and
 *    numeric offsets, and never renders `Invalid Date`/`NaN`;
 *  - every helper renders an em dash for `null`/`undefined`/blank/garbage.
 *
 * Approach: call the pure helpers directly (no TestBed) with fixed inputs and
 * assert the exact output strings. The `Instant` cases use either a local
 * date-time literal (zone independent) or two spellings of the same instant, so
 * the assertions hold in any machine time zone.
 */
import { describe, expect, it } from 'vitest';

import { formatInstant, formatIsoDate, parseIsoDate, toIsoDate } from './date-format';

describe('toIsoDate', () => {
  it('writes the local calendar day, zero padded', () => {
    expect(toIsoDate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('does not shift the day for a late-evening local date', () => {
    expect(toIsoDate(new Date(2026, 5, 15, 23, 30))).toBe('2026-06-15');
  });
});

describe('formatIsoDate (LocalDate)', () => {
  it('renders dd/mm/aaaa from a wire date', () => {
    expect(formatIsoDate('2026-06-15')).toBe('15/06/2026');
  });

  it('renders only the date of a date-time', () => {
    expect(formatIsoDate('2026-06-15T18:00:00Z')).toBe('15/06/2026');
  });

  it('renders an em dash for a missing date', () => {
    expect(formatIsoDate(null)).toBe('—');
    expect(formatIsoDate(undefined)).toBe('—');
    expect(formatIsoDate('  ')).toBe('—');
  });

  it('renders an em dash instead of garbage', () => {
    expect(formatIsoDate('15/06/2026')).toBe('—');
    expect(formatIsoDate('2026')).toBe('—');
  });
});

describe('parseIsoDate (LocalDate)', () => {
  it('parses into a local date at midnight', () => {
    expect(parseIsoDate('2026-06-30')).toEqual(new Date(2026, 5, 30));
  });

  it('rejects a day that does not exist instead of rolling over', () => {
    expect(parseIsoDate('2026-02-31')).toBeNull();
  });

  it('rejects malformed input', () => {
    expect(parseIsoDate('2026-06')).toBeNull();
    expect(parseIsoDate('')).toBeNull();
    expect(parseIsoDate(null)).toBeNull();
  });
});

describe('formatInstant', () => {
  it('renders a local date-time as dd/mm/aaaa HH:mm', () => {
    expect(formatInstant('2026-06-15T18:00:00')).toBe('15/06/2026, 18:00');
  });

  it('renders a UTC instant with a 24-hour clock and no date-time separator T', () => {
    const rendered = formatInstant('2026-06-15T18:00:00Z');

    expect(rendered).toMatch(/^\d{2}\/\d{2}\/\d{4}, \d{2}:\d{2}$/);
    expect(rendered).not.toContain('T');
    expect(rendered).not.toMatch(/NaN|Invalid/);
  });

  it('treats Z and a numeric offset as the same instant', () => {
    expect(formatInstant('2026-06-15T13:00:00-05:00')).toBe(formatInstant('2026-06-15T18:00:00Z'));
  });

  it('renders an em dash for missing values', () => {
    expect(formatInstant(null)).toBe('—');
    expect(formatInstant(undefined)).toBe('—');
    expect(formatInstant('')).toBe('—');
  });

  it('renders an em dash instead of Invalid Date for garbage', () => {
    expect(formatInstant('ayer')).toBe('—');
    expect(formatInstant('2026-13-45T99:99:99')).toBe('—');
  });
});

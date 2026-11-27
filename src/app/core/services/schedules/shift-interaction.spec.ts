/**
 * Tests for the pure geometry of the weekly graphical shift editor.
 *
 * Feature: converts a pointer delta into snapped shift times.
 * Contract:
 *  - pixel deltas map through the measured track width and visible window;
 *  - every result snaps to 15 minutes;
 *  - moving preserves duration; resizing keeps the opposite edge fixed;
 *  - ranges that cannot fit return null instead of an invalid time;
 *  - percentages match the calendar geometry.
 *
 * Approach: call the pure functions with controlled integers and assert exact
 * minute ranges, plus the null boundary cases.
 */
import { describe, expect, it } from 'vitest';

import {
  MIN_SHIFT_MINUTES,
  deltaPxToMinutes,
  isRangeWithin,
  minutesToTime,
  moveShift,
  rangeToPercent,
  resizeEnd,
  resizeStart,
  snapMinutes,
} from './shift-interaction';

const BOUNDS = { min: 8 * 60, max: 22 * 60 };

describe('coordinate mapping', () => {
  it('maps pixels to minutes using the track width and window', () => {
    // 60 minutes across 120 px → 2 minutes per pixel.
    expect(deltaPxToMinutes(30, 120, 60)).toBe(15);
    expect(deltaPxToMinutes(-10, 120, 60)).toBe(-5);
  });

  it('returns zero for a missing measurement instead of dividing by zero', () => {
    expect(deltaPxToMinutes(30, 0, 60)).toBe(0);
    expect(deltaPxToMinutes(Number.NaN, 120, 60)).toBe(0);
  });

  it('snaps to the nearest 15 minutes', () => {
    expect(snapMinutes(7)).toBe(0);
    expect(snapMinutes(8)).toBe(15);
    expect(snapMinutes(22)).toBe(15);
    expect(snapMinutes(-8)).toBe(-15);
  });
});

describe('moving a shift', () => {
  it('preserves duration and snaps the new start', () => {
    const moved = moveShift({ start: 11 * 60, end: 17 * 60 }, 120, BOUNDS);

    expect(moved).toEqual({ start: 13 * 60, end: 19 * 60 });
  });

  it('clamps against the window while preserving duration', () => {
    const moved = moveShift({ start: 11 * 60, end: 17 * 60 }, 600, BOUNDS);

    expect(moved).toEqual({ start: 16 * 60, end: 22 * 60 });
  });

  it('returns null when the shift is longer than the window', () => {
    expect(moveShift({ start: 8 * 60, end: 23 * 60 }, 0, BOUNDS)).toBeNull();
  });
});

describe('resizing a shift', () => {
  it('moves only the start edge', () => {
    expect(resizeStart({ start: 11 * 60, end: 17 * 60 }, 30, BOUNDS)).toEqual({
      start: 11 * 60 + 30,
      end: 17 * 60,
    });
  });

  it('moves only the end edge', () => {
    expect(resizeEnd({ start: 11 * 60, end: 17 * 60 }, -30, BOUNDS)).toEqual({
      start: 11 * 60,
      end: 16 * 60 + 30,
    });
  });

  it('enforces the minimum duration', () => {
    expect(resizeStart({ start: 11 * 60, end: 12 * 60 }, 120, BOUNDS)).toEqual({
      start: 12 * 60 - MIN_SHIFT_MINUTES,
      end: 12 * 60,
    });
    expect(resizeEnd({ start: 11 * 60, end: 12 * 60 }, -120, BOUNDS)).toEqual({
      start: 11 * 60,
      end: 11 * 60 + MIN_SHIFT_MINUTES,
    });
  });

  it('returns null when the edge cannot move inside the window', () => {
    expect(resizeStart({ start: 8 * 60, end: 8 * 60 + 10 }, 0, BOUNDS)).toBeNull();
  });
});

describe('range helpers', () => {
  it('validates bounds and minimum duration', () => {
    expect(isRangeWithin({ start: 8 * 60, end: 9 * 60 }, BOUNDS)).toBe(true);
    expect(isRangeWithin({ start: 7 * 60, end: 9 * 60 }, BOUNDS)).toBe(false);
    expect(isRangeWithin({ start: 8 * 60, end: 8 * 60 + 14 }, BOUNDS)).toBe(false);
  });

  it('formats minutes as HH:mm', () => {
    expect(minutesToTime(0)).toBe('00:00');
    expect(minutesToTime(795)).toBe('13:15');
    expect(minutesToTime(24 * 60)).toBe('23:59');
  });

  it('converts a range to calendar percentages', () => {
    expect(rangeToPercent({ start: 10 * 60, end: 12 * 60 }, 8 * 60, 8 * 60)).toEqual({
      left: 25,
      width: 25,
    });
  });
});

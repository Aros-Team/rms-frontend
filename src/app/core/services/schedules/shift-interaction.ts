/**
 * Pure geometry for the graphical shift editor of the weekly calendar.
 *
 * Feature: turns horizontal pointer movement into new shift times.
 *
 * Contract:
 *  - the caller measures the track width once at gesture start, so the mapping
 *    does not depend on zoom, scroll or later layout changes;
 *  - every result snaps to 15 minutes;
 *  - moving preserves the duration; resizing keeps the opposite edge fixed;
 *  - a range that cannot fit inside the allowed window returns `null` instead
 *    of silently producing an invalid time.
 */

/** Step used by every graphical modification. */
export const SNAP_MINUTES = 15;

/** Shortest shift the UI allows. The domain only requires start < end. */
export const MIN_SHIFT_MINUTES = 15;

/** Minutes in a day. */
export const MINUTES_PER_DAY = 24 * 60;

/** Last valid 15-minute slot of the day (23:45); 24:00 is not a valid time. */
export const LATEST_SHIFT_MINUTE = MINUTES_PER_DAY - SNAP_MINUTES;

export interface MinuteRange {
  readonly start: number;
  readonly end: number;
}

export interface MinutesBounds {
  readonly min: number;
  readonly max: number;
}

/** Horizontal pixels → minutes for a track of `trackWidthPx` and a window. */
export function deltaPxToMinutes(
  deltaPx: number,
  trackWidthPx: number,
  windowMinutes: number,
): number {
  if (
    !Number.isFinite(deltaPx) ||
    !Number.isFinite(trackWidthPx) ||
    !Number.isFinite(windowMinutes) ||
    trackWidthPx <= 0 ||
    windowMinutes <= 0
  ) {
    return 0;
  }
  return (deltaPx / trackWidthPx) * windowMinutes;
}

/** Rounds to the nearest `step` minutes (negative values included). */
export function snapMinutes(value: number, step: number = SNAP_MINUTES): number {
  if (!Number.isFinite(value) || step <= 0) {
    return 0;
  }
  return Math.round(value / step) * step;
}

/** `795` → `13:15`; clamps to the valid clock range. */
export function minutesToTime(minutes: number): string {
  const clamped = Math.min(MINUTES_PER_DAY - 1, Math.max(0, Math.round(minutes)));
  const hours = Math.floor(clamped / 60);
  const rest = clamped % 60;
  return `${String(hours).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

/** Duration of a range in minutes, or 0 when malformed. */
export function rangeDuration(range: MinuteRange): number {
  return Math.max(0, range.end - range.start);
}

/** True when the range respects the minimum duration and stays inside bounds. */
export function isRangeWithin(
  range: MinuteRange,
  bounds: MinutesBounds,
  minDuration: number = MIN_SHIFT_MINUTES,
): boolean {
  return (
    range.start >= bounds.min &&
    range.end <= bounds.max &&
    range.end - range.start >= minDuration &&
    range.end > range.start
  );
}

/**
 * Moves a range by `deltaMinutes`, preserving its duration and snapping the
 * resulting start. Returns `null` when the window cannot hold the shift.
 */
export function moveShift(
  range: MinuteRange,
  deltaMinutes: number,
  bounds: MinutesBounds,
): MinuteRange | null {
  const duration = rangeDuration(range);
  if (duration <= 0) {
    return null;
  }
  const maxStart = bounds.max - duration;
  if (maxStart < bounds.min) {
    return null;
  }
  const proposed = snapMinutes(range.start + deltaMinutes);
  const start = Math.min(Math.max(proposed, bounds.min), maxStart);
  return { start, end: start + duration };
}

/** Moves the start edge, keeping the end fixed. */
export function resizeStart(
  range: MinuteRange,
  deltaMinutes: number,
  bounds: MinutesBounds,
  minDuration: number = MIN_SHIFT_MINUTES,
): MinuteRange | null {
  const maxStart = range.end - minDuration;
  if (maxStart < bounds.min) {
    return null;
  }
  const proposed = snapMinutes(range.start + deltaMinutes);
  const start = Math.min(Math.max(proposed, bounds.min), maxStart);
  const result = { start, end: range.end };
  return isRangeWithin(result, bounds, minDuration) ? result : null;
}

/** Moves the end edge, keeping the start fixed. */
export function resizeEnd(
  range: MinuteRange,
  deltaMinutes: number,
  bounds: MinutesBounds,
  minDuration: number = MIN_SHIFT_MINUTES,
): MinuteRange | null {
  const minEnd = range.start + minDuration;
  if (minEnd > bounds.max) {
    return null;
  }
  const proposed = snapMinutes(range.end + deltaMinutes);
  const end = Math.min(Math.max(proposed, minEnd), bounds.max);
  const result = { start: range.start, end };
  return isRangeWithin(result, bounds, minDuration) ? result : null;
}

/** Percentage geometry of a range inside the visible window. */
export function rangeToPercent(
  range: MinuteRange,
  windowStart: number,
  windowMinutes: number,
): { readonly left: number; readonly width: number } {
  if (windowMinutes <= 0) {
    return { left: 0, width: 0 };
  }
  const left = ((range.start - windowStart) / windowMinutes) * 100;
  const width = ((range.end - range.start) / windowMinutes) * 100;
  return { left, width };
}

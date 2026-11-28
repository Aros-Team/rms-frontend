import { TIME_BUCKETS, type TimeBucket } from '@app/shared/models/dto/analytics/time-bucket';

/**
 * Period helpers shared by the whole analytics workspace.
 *
 * The API accepts four buckets and a key format per bucket:
 * `daily` = `YYYY-MM-DD`, `weekly` = `YYYY-Www` (ISO week), `monthly` =
 * `YYYY-MM`, `yearly` = `YYYY`. Every helper here works in UTC so a key does
 * not move when the browser changes timezone. Keys are lexicographically
 * ordered in every format, which keeps range comparisons trivial.
 */

export interface PeriodRange {
  from: string;
  to: string;
}

export interface BucketPreset {
  id: string;
  label: string;
  /** Number of buckets the preset covers, ending at the current one. */
  count: number;
}

const DAY_MS = 86_400_000;
const DAILY = /^\d{4}-\d{2}-\d{2}$/;
const WEEKLY = /^\d{4}-W\d{2}$/;
const MONTHLY = /^\d{4}-\d{2}$/;
const YEARLY = /^\d{4}$/;

const BUCKET_LABEL: Record<TimeBucket, string> = {
  daily: 'Día',
  weekly: 'Semana',
  monthly: 'Mes',
  yearly: 'Año',
};

const BUCKET_FORMAT: Record<TimeBucket, string> = {
  daily: 'AAAA-MM-DD',
  weekly: 'AAAA-Sww',
  monthly: 'AAAA-MM',
  yearly: 'AAAA',
};

/** True when the value is one of the four bucket names. */
export function isTimeBucket(value: string): value is TimeBucket {
  return (TIME_BUCKETS as readonly string[]).includes(value);
}

/** Human label for a bucket ("Mes", "Semana" …). */
export function bucketLabel(bucket: TimeBucket): string {
  return BUCKET_LABEL[bucket];
}

/** Expected key format, used in validation messages. */
export function bucketFormat(bucket: TimeBucket): string {
  return BUCKET_FORMAT[bucket];
}

/** Validates a single key for the given bucket. */
export function isValidBucketKey(bucket: TimeBucket, key: string): boolean {
  switch (bucket) {
    case 'daily':
      return DAILY.test(key) && keyToDate(bucket, key) !== null;
    case 'weekly': {
      if (!WEEKLY.test(key)) return false;
      const week = Number.parseInt(key.slice(6), 10);
      return week >= 1 && week <= 53;
    }
    case 'monthly': {
      if (!MONTHLY.test(key)) return false;
      const month = Number.parseInt(key.slice(5), 10);
      return month >= 1 && month <= 12;
    }
    case 'yearly':
      return YEARLY.test(key);
  }
}

/**
 * Orders two keys of the same bucket. Lexicographic ordering is correct for
 * every ISO key format (`2026-07` < `2026-08`, `2026-W09` < `2026-W10`).
 */
export function comparePeriodKeys(a: string, b: string): number {
  return a.localeCompare(b);
}

/**
 * Validates a range: both keys match the bucket, `to >= from`, and a daily
 * range never exceeds the API limit of 366 days.
 */
export function isValidRange(bucket: TimeBucket, from: string, to: string): boolean {
  if (!isValidBucketKey(bucket, from) || !isValidBucketKey(bucket, to)) return false;
  if (comparePeriodKeys(from, to) > 0) return false;
  if (bucket === 'daily') {
    const start = keyToDate(bucket, from);
    const end = keyToDate(bucket, to);
    if (start === null || end === null) return false;
    return Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1 <= 366;
  }
  return true;
}

/** Resolves a bucket key to the first UTC day it covers. */
export function keyToDate(bucket: TimeBucket, key: string): Date | null {
  switch (bucket) {
    case 'daily': {
      if (!DAILY.test(key)) return null;
      const [year, month, day] = key.split('-').map(Number);
      const date = new Date(Date.UTC(year, month - 1, day));
      return date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date : null;
    }
    case 'weekly': {
      if (!WEEKLY.test(key)) return null;
      const year = Number.parseInt(key.slice(0, 4), 10);
      const week = Number.parseInt(key.slice(6), 10);
      if (week < 1 || week > 53) return null;
      return isoWeekStart(year, week);
    }
    case 'monthly': {
      if (!MONTHLY.test(key)) return null;
      const year = Number.parseInt(key.slice(0, 4), 10);
      const month = Number.parseInt(key.slice(5), 10);
      if (month < 1 || month > 12) return null;
      return new Date(Date.UTC(year, month - 1, 1));
    }
    case 'yearly': {
      if (!YEARLY.test(key)) return null;
      return new Date(Date.UTC(Number.parseInt(key, 10), 0, 1));
    }
  }
}

/** Bucket key for a concrete date (UTC). */
export function keyForDate(bucket: TimeBucket, date: Date): string {
  const year = date.getUTCFullYear();
  switch (bucket) {
    case 'daily':
      return `${pad(year, 4)}-${pad(date.getUTCMonth() + 1, 2)}-${pad(date.getUTCDate(), 2)}`;
    case 'weekly':
      return isoWeekKey(date);
    case 'monthly':
      return `${pad(year, 4)}-${pad(date.getUTCMonth() + 1, 2)}`;
    case 'yearly':
      return pad(year, 4);
  }
}

/** Key of the bucket that contains "now". */
export function currentKey(bucket: TimeBucket, now: Date = new Date()): string {
  return keyForDate(bucket, now);
}

/** Moves a key by `delta` buckets (negative goes back). */
export function shiftKey(bucket: TimeBucket, key: string, delta: number): string {
  const date = keyToDate(bucket, key);
  if (date === null) return key;
  switch (bucket) {
    case 'daily':
      return keyForDate(bucket, new Date(date.getTime() + delta * DAY_MS));
    case 'weekly':
      return keyForDate(bucket, new Date(date.getTime() + delta * 7 * DAY_MS));
    case 'monthly':
      return keyForDate(
        bucket,
        new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + delta, 1)),
      );
    case 'yearly':
      return keyForDate(bucket, new Date(Date.UTC(date.getUTCFullYear() + delta, 0, 1)));
  }
}

/** Inclusive range of the last `count` buckets, ending at `now`. */
export function rangeForLast(
  bucket: TimeBucket,
  count: number,
  now: Date = new Date(),
): PeriodRange {
  const safeCount = Math.max(1, Math.floor(count));
  const to = currentKey(bucket, now);
  const from = shiftKey(bucket, to, -(safeCount - 1));
  return { from, to };
}

/** The equivalent range immediately before `from..to`, same bucket count. */
export function previousRange(bucket: TimeBucket, from: string, to: string): PeriodRange {
  const count = bucketCount(bucket, from, to);
  const previousTo = shiftKey(bucket, from, -1);
  const previousFrom = shiftKey(bucket, previousTo, -(count - 1));
  return { from: previousFrom, to: previousTo };
}

/** Number of bucket keys covered by an inclusive range. */
export function bucketCount(bucket: TimeBucket, from: string, to: string): number {
  const start = keyToDate(bucket, from);
  const end = keyToDate(bucket, to);
  if (start === null || end === null) return 0;
  switch (bucket) {
    case 'daily':
      return Math.max(0, Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1);
    case 'weekly':
      return Math.max(0, Math.round((end.getTime() - start.getTime()) / (7 * DAY_MS)) + 1);
    case 'monthly':
      return Math.max(
        0,
        (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
          (end.getUTCMonth() - start.getUTCMonth()) +
          1,
      );
    case 'yearly':
      return Math.max(0, end.getUTCFullYear() - start.getUTCFullYear() + 1);
  }
}

/** Presets offered by the selector for a bucket. */
export function presetsFor(bucket: TimeBucket): BucketPreset[] {
  switch (bucket) {
    case 'daily':
      return [
        { id: 'last-7', label: 'Últimos 7 días', count: 7 },
        { id: 'last-30', label: 'Últimos 30 días', count: 30 },
        { id: 'last-90', label: 'Últimos 90 días', count: 90 },
      ];
    case 'weekly':
      return [
        { id: 'last-8', label: 'Últimas 8 semanas', count: 8 },
        { id: 'last-12', label: 'Últimas 12 semanas', count: 12 },
        { id: 'last-26', label: 'Últimas 26 semanas', count: 26 },
      ];
    case 'monthly':
      return [
        { id: 'last-3', label: 'Últimos 3 meses', count: 3 },
        { id: 'last-6', label: 'Últimos 6 meses', count: 6 },
        { id: 'last-12', label: 'Últimos 12 meses', count: 12 },
      ];
    case 'yearly':
      return [
        { id: 'last-1', label: 'Último año', count: 1 },
        { id: 'last-3', label: 'Últimos 3 años', count: 3 },
        { id: 'last-5', label: 'Últimos 5 años', count: 5 },
      ];
  }
}

/** Preset applied when a bucket is chosen. */
export function defaultPresetFor(bucket: TimeBucket): BucketPreset {
  const presetId =
    bucket === 'monthly'
      ? 'last-6'
      : bucket === 'yearly'
        ? 'last-3'
        : bucket === 'weekly'
          ? 'last-12'
          : 'last-30';
  const presets = presetsFor(bucket);
  return presets.find((preset) => preset.id === presetId) ?? presets[0];
}

/** Shared default state: monthly, last six months. */
export function defaultPeriod(now: Date = new Date()): PeriodRange & { bucket: TimeBucket } {
  return { bucket: 'monthly', ...rangeForLast('monthly', 6, now) };
}

/** Formats a single key for display (Spanish, es-CO by default). */
export function titleForKey(bucket: TimeBucket, key: string, locale = 'es-CO'): string {
  const date = keyToDate(bucket, key);
  if (date === null) return key;
  switch (bucket) {
    case 'daily':
      return new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(date);
    case 'weekly': {
      const week = Number.parseInt(key.slice(6), 10);
      return `Semana ${String(week)} · ${String(date.getUTCFullYear())}`;
    }
    case 'monthly':
      return new Intl.DateTimeFormat(locale, {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(date);
    case 'yearly':
      return String(date.getUTCFullYear());
  }
}

/**
 * Label for the applied range. It is derived from the same keys sent to the
 * API, so the label can never disagree with the request (Sprint 0 F-014).
 */
export function rangeLabel(bucket: TimeBucket, from: string, to: string, locale = 'es-CO'): string {
  if (from === to) return titleForKey(bucket, from, locale);
  return `${titleForKey(bucket, from, locale)} – ${titleForKey(bucket, to, locale)}`;
}

/** Concrete ISO dates covered by a range, for endpoints that take dates. */
export function rangeToDates(bucket: TimeBucket, from: string, to: string): PeriodRange {
  const start = keyToDate(bucket, from);
  if (start === null) return { from, to };
  const endExclusive = nextBucketStart(bucket, to);
  const endInclusive = new Date(endExclusive.getTime() - DAY_MS);
  return { from: isoDate(start), to: isoDate(endInclusive) };
}

function nextBucketStart(bucket: TimeBucket, key: string): Date {
  const start = keyToDate(bucket, key);
  if (start === null) return new Date(0);
  switch (bucket) {
    case 'daily':
      return new Date(start.getTime() + DAY_MS);
    case 'weekly':
      return new Date(start.getTime() + 7 * DAY_MS);
    case 'monthly':
      return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
    case 'yearly':
      return new Date(Date.UTC(start.getUTCFullYear() + 1, 0, 1));
  }
}

function isoDate(date: Date): string {
  return `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1, 2)}-${pad(date.getUTCDate(), 2)}`;
}

function pad(value: number, size: number): string {
  return String(value).padStart(size, '0');
}

/** Monday (UTC) of an ISO week; ISO week 1 contains January 4th. */
function isoWeekStart(year: number, week: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const monday = new Date(jan4.getTime() - (jan4Day - 1) * DAY_MS);
  return new Date(monday.getTime() + (week - 1) * 7 * DAY_MS);
}

/** ISO week key (`YYYY-Www`) for a date. */
function isoWeekKey(date: Date): string {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((target.getTime() - yearStart.getTime()) / DAY_MS + 1) / 7);
  return `${pad(target.getUTCFullYear(), 4)}-W${pad(week, 2)}`;
}

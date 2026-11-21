/**
 * Single source of truth for turning backend wire dates into Spanish strings.
 *
 * The backend exposes two different shapes and they are **not** interchangeable:
 *
 *  - `LocalDate` → `YYYY-MM-DD` (e.g. an event date, a payroll period bound);
 *  - `Instant`   → ISO date-time, with or without `Z`/offset
 *                  (e.g. `2026-06-15T18:00:00Z`).
 *
 * Feeding one to the other's formatter is how "15T18:00:00/06/2026" reaches the
 * screen, so each shape gets its own function and every one of them is total:
 * unparsable input renders an em dash, never `Invalid Date`/`NaN`.
 *
 * `formatInstant` reuses the `toLocaleString('es-CO', …)` convention already in
 * `workers.ts` / `time-logs.ts` (same options, `hourCycle: 'h23'` so the hour
 * reads `18:00` instead of `06:00 p. m.`).
 */

/** Placeholder for "there is no renderable value". */
const EMPTY_VALUE = '—';

/** Locale of every rendered date in the admin panel. */
const LOCALE = 'es-CO';

/**
 * `YYYY-MM` prefix of a wire date, tolerating a trailing date-time part.
 * A date-only formatter must never be fed an `Instant` by mistake, but if it is,
 * the date part still renders correctly.
 */
const ISO_DATE_PREFIX = /^(\d{4})-(\d{2})-(\d{2})(?:$|[T ])/;

/** `Date` → `YYYY-MM-DD` using local parts (no UTC shift on the wire). */
export function toIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${String(date.getFullYear())}-${month}-${day}`;
}

/** Splits the `YYYY-MM-DD` prefix of a wire date into numbers, or `null`. */
function splitIsoDate(iso: string | null | undefined): [number, number, number] | null {
  if (iso === null || iso === undefined) return null;
  const match = ISO_DATE_PREFIX.exec(iso.trim());
  if (match === null) return null;
  const [, year, month, day] = match;
  return [Number.parseInt(year, 10), Number.parseInt(month, 10), Number.parseInt(day, 10)];
}

/**
 * Renders a `LocalDate` (`YYYY-MM-DD`) as `dd/mm/aaaa`.
 *
 * Parsed by hand on purpose: `new Date('2026-06-15')` is UTC midnight and would
 * render as the previous day in `es-CO`.
 */
export function formatIsoDate(iso: string | null | undefined): string {
  const parts = splitIsoDate(iso);
  if (parts === null) return EMPTY_VALUE;
  const [year, month, day] = parts;
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${String(year)}`;
}

/**
 * Parses a `LocalDate` (`YYYY-MM-DD`) into a local `Date`, or `null` when the
 * text is malformed or names a day that does not exist (`2026-02-31`).
 */
export function parseIsoDate(iso: string | null | undefined): Date | null {
  const parts = splitIsoDate(iso);
  if (parts === null) return null;
  const [year, month, day] = parts;
  const date = new Date(year, month - 1, day);
  // `new Date` rolls over impossible days (Feb 31 → Mar 3); reject those.
  if (
    !Number.isFinite(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

/**
 * Renders an `Instant` (ISO date-time, with or without `Z`/offset) as
 * `dd/mm/aaaa HH:mm` in the admin's local time.
 *
 * `null`, blank text and unparsable text render an em dash.
 */
export function formatInstant(iso: string | null | undefined): string {
  if (iso === null || iso === undefined) return EMPTY_VALUE;
  const trimmed = iso.trim();
  if (trimmed.length === 0) return EMPTY_VALUE;

  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return EMPTY_VALUE;

  return date.toLocaleString(LOCALE, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
}

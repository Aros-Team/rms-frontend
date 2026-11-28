import type { RmsStatus } from '@app/shared/ui/types/ui-types';

/**
 * Kitchen elapsed-time model.
 *
 * Feature: a line cook must know how long an order has been on the pass before
 * reading its contents. The clock starts at `order.date` (the moment the waiter
 * sent it) and is shown for every column, including READY.
 *
 * Thresholds are surface policy, not backend data:
 *  - fresh   < 8 min   (success)
 *  - warning 8-15 min  (warning, "Atención")
 *  - late    >= 15 min (danger, "Atrasado")
 *
 * They are exported so the spec and the template use the same numbers.
 */
export const KITCHEN_WARNING_MS = 8 * 60 * 1000;
export const KITCHEN_LATE_MS = 15 * 60 * 1000;

export type KitchenUrgency = 'fresh' | 'warning' | 'late';

/**
 * Age of an order in milliseconds, clamped at zero.
 *
 * A malformed date returns `0` instead of `NaN`, so the card renders `00:00`
 * rather than "NaN:NaN". The backend sends a local wall-clock string without a
 * timezone (`2026-11-21T19:59:33`), which `Date.parse` interprets in the
 * browser's timezone, matching how it was written.
 */
export function orderAgeMs(date: string, now: number): number {
  const parsed = Date.parse(date);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, now - parsed);
}

export function urgencyFor(ageMs: number): KitchenUrgency {
  if (ageMs >= KITCHEN_LATE_MS) return 'late';
  if (ageMs >= KITCHEN_WARNING_MS) return 'warning';
  return 'fresh';
}

export function urgencyLabel(urgency: KitchenUrgency): string {
  switch (urgency) {
    case 'late':
      return 'Atrasado';
    case 'warning':
      return 'Atención';
    default:
      return 'En tiempo';
  }
}

export function urgencyTone(urgency: KitchenUrgency): RmsStatus {
  switch (urgency) {
    case 'late':
      return 'danger';
    case 'warning':
      return 'warning';
    default:
      return 'success';
  }
}

/**
 * `MM:SS` under an hour, `H:MM:SS` above it.
 *
 * Always tabular: the template pairs this with `font-variant-numeric`, so the
 * digits keep their width and the card does not reflow every second.
 */
export function formatAge(ageMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(ageMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number): string => String(value).padStart(2, '0');

  return hours > 0
    ? `${String(hours)}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`;
}

/** `HH:mm` for an order date. Empty string when the date is unusable. */
export function formatOrderTime(date: string): string {
  return formatClock(new Date(date));
}

/** `HH:mm` for a `Date` (last-sync label). Empty string for an invalid date. */
export function formatClock(date: Date | null): string {
  if (date === null || Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);
}

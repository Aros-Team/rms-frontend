/**
 * Kind of payroll event registered for a worker on a given day.
 *
 * The backend serializes its `PayrollEventType` enum as the enum name string.
 * `ABSENCE` and `DEDUCTION` reduce the net amount; the rest add to it
 * (`OVERTIME` / `NIGHT_SURCHARGE` arrive with a multiplier > 1).
 */
export type PayrollEventType =
  | 'OVERTIME'
  | 'NIGHT_SURCHARGE'
  | 'ABSENCE'
  | 'BONUS_ATTENDANCE'
  | 'BONUS_PERFORMANCE'
  | 'DEDUCTION';

/** Every valid `PayrollEventType`. */
export const PAYROLL_EVENT_TYPES: readonly PayrollEventType[] = [
  'OVERTIME',
  'NIGHT_SURCHARGE',
  'ABSENCE',
  'BONUS_ATTENDANCE',
  'BONUS_PERFORMANCE',
  'DEDUCTION',
];

/**
 * Event types that subtract from the payroll instead of adding to it.
 *
 * Used by UI summaries to pick a severity/sign without hardcoding a list of
 * string literals in each component.
 */
export const PAYROLL_DEDUCTION_EVENT_TYPES: readonly PayrollEventType[] = ['ABSENCE', 'DEDUCTION'];

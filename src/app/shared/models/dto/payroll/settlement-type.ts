/**
 * Granularity of a payroll settlement (partial payment) run.
 *
 * The backend serializes its `SettlementType` enum as the enum name string.
 * `MONTHLY` is the closing settlement of the period; the others are partial
 * payments accumulated against the same payroll record.
 */
export type SettlementType = 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';

/** Every valid `SettlementType`, ordered from most to least granular. */
export const SETTLEMENT_TYPES: readonly SettlementType[] = [
  'DAILY',
  'WEEKLY',
  'BIWEEKLY',
  'MONTHLY',
];

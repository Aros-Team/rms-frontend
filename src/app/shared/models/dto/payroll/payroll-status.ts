/**
 * Lifecycle state of a monthly payroll record.
 *
 * The backend serializes its `PayrollStatus` enum as the enum name string, so
 * this is a closed union rather than a plain `string`: switches over it stay
 * exhaustiveness-checked.
 */
export type PayrollStatus = 'PENDING' | 'ACCRUED' | 'PAID';

/** Every valid `PayrollStatus`, in lifecycle order. */
export const PAYROLL_STATUSES: readonly PayrollStatus[] = ['PENDING', 'ACCRUED', 'PAID'];

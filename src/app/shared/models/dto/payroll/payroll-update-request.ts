import { PayrollStatus } from './payroll-status';

/**
 * Body for `PATCH /v1/payroll/{id}`.
 *
 * Field-by-field mirror of the backend `PayrollUpdateRequest` record: every
 * field is optional and omitted fields keep their current value. Identity and
 * period fields are intentionally absent — a payroll cannot be moved to another
 * worker or period through this endpoint.
 *
 * Request money fields are plain numbers, like `PayrollRequest`.
 */
export interface PayrollUpdateRequest {
  baseSalary?: number;
  bonuses?: number;
  deductions?: number;
  hoursWorked?: number;
  status?: PayrollStatus;
  notes?: string;
}

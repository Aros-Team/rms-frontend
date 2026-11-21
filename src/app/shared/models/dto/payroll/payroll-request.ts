/**
 * Payload for `POST /v1/payroll`.
 *
 * Field-by-field mirror of the backend `PayrollRequest` record. Required:
 * `userId`, `year`, `month`, `periodStart`, `periodEnd`, `baseSalary`,
 * `hoursWorked`. `bonuses` / `deductions` may be omitted (backend defaults them
 * to zero). The initial status is always `PENDING`; use `PayrollUpdateRequest`
 * on `PATCH` to change it.
 *
 * Request money fields are plain numbers on this API (like
 * `UserRegisterRequest.salary`), not `Money` DTOs. Only responses carry
 * `{ amount, currency }`.
 */
export interface PayrollRequest {
  userId: number;
  year: number;
  month: number;
  /** `YYYY-MM-DD` */
  periodStart: string;
  /** `YYYY-MM-DD` */
  periodEnd: string;
  baseSalary: number;
  bonuses?: number;
  deductions?: number;
  /** Hours actually worked in the period (also the denominator for hourly rate). */
  hoursWorked: number;
  notes?: string;
}

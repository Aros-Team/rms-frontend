import { PayrollEventType } from './payroll-event-type';

/**
 * Payload for `POST /v1/payroll/events/calculate` — asks the backend for the
 * suggested rate/amount of an event before it is registered.
 *
 * Field-by-field mirror of the backend `PayrollCalculateRequest` record: the
 * backend derives the hourly rate from the worker's current salary, so neither
 * rate nor amount (nor a date) is sent.
 *
 * Keep this in sync with `PayrollCalculateResponse`, which is the spec'd shape.
 */
export interface PayrollCalculateRequest {
  userId: number;
  eventType: PayrollEventType;
  quantity: number;
}

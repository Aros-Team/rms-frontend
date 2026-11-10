import { PayrollEventType } from './payroll-event-type';

/**
 * Payload for `POST /v1/payroll/events/calculate` — asks the backend for the
 * suggested rate/amount of an event before it is registered.
 *
 * The live OpenAPI spec publishes the endpoint but not this schema body, so the
 * shape below follows the backend record named in
 * `docs/plans/payroll-plan.md` (`CalculateEventRequest`): the backend derives
 * the hourly rate from the worker's salary, so neither rate nor amount is sent.
 *
 * Keep this in sync with `PayrollCalculateResponse`, which is the spec'd shape.
 */
export interface PayrollCalculateRequest {
  userId: number;
  eventType: PayrollEventType;
  quantity: number;
  /** `YYYY-MM-DD` — needed to resolve the hourly rate valid on that date. */
  eventDate: string;
}

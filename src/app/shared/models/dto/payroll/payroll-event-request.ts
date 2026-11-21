import { PayrollEventType } from './payroll-event-type';

/**
 * Payload for `POST /v1/payroll/events`.
 *
 * Field-by-field mirror of the backend `PayrollEventRequest` record: the event
 * amount is NOT part of the request — the backend derives it from
 * `quantity × unitRate`, so sending it would be ignored.
 *
 * `unitRate` is a plain number on this API, not a `Money` DTO. Only responses
 * carry `{ amount, currency }`.
 */
export interface PayrollEventRequest {
  userId: number;
  /** `YYYY-MM-DD` */
  eventDate: string;
  eventType: PayrollEventType;
  /** Hours / days / units, depending on `eventType`. */
  quantity: number;
  /** Rate per unit, as a raw decimal number. */
  unitRate: number;
  notes?: string;
}

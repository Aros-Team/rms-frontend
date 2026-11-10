import { Money } from '@models/dto/common/money';

import { PayrollEventType } from './payroll-event-type';

/**
 * Payload for `POST /v1/payroll/events`.
 *
 * Field-by-field mirror of the backend `PayrollEventRequest` record: the event
 * amount is NOT part of the request — the backend derives it from
 * `quantity × unitRate`, so sending it would be ignored.
 */
export interface PayrollEventRequest {
  userId: number;
  /** `YYYY-MM-DD` */
  eventDate: string;
  eventType: PayrollEventType;
  /** Hours / days / units, depending on `eventType`. */
  quantity: number;
  /** Rate per unit, as sent by the backend (`Money` DTO, decimal string amount). */
  unitRate: Money;
  notes?: string;
}

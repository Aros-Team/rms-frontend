import { Money } from '@models/dto/common/money';

import { PayrollEventType } from './payroll-event-type';

/**
 * A single payroll event (overtime, night surcharge, absence, bonus, …).
 *
 * Returned by `POST /v1/payroll/events` and
 * `GET /v1/payroll/events/{userId}/{year}/{month}`.
 *
 * `amount` is `quantity × unitRate`, computed by the backend. Both `amount` and
 * `unitRate` are `Money` DTOs (decimal string amounts), not bare numbers.
 */
export interface PayrollEventResponse {
  id: number;
  userId: number;
  userName: string;
  /** `YYYY-MM-DD` */
  eventDate: string;
  eventType: PayrollEventType;
  quantity: number;
  unitRate: Money;
  amount: Money;
  notes: string;
  createdAt: string;
  createdBy: number;
}

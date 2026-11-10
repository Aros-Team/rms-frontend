import { Money } from '@models/dto/common/money';

import { PayrollEventType } from './payroll-event-type';

/**
 * Suggested values for an event, returned by
 * `POST /v1/payroll/events/calculate`.
 *
 * Field-by-field mirror of the backend `PayrollCalculateResponse` record:
 * `suggestedUnitRate = hourlyRate × multiplier` and
 * `suggestedAmount = suggestedUnitRate × quantity`, both computed by the
 * backend so the form can prefill the inputs without doing money arithmetic in
 * TypeScript.
 *
 * `hourlyRate`, `suggestedUnitRate` and `suggestedAmount` are `Money` DTOs
 * (decimal string amounts); `multiplier` is a plain factor (e.g. `1.5`).
 */
export interface PayrollCalculateResponse {
  userId: number;
  eventType: PayrollEventType;
  hourlyRate: Money;
  multiplier: number;
  suggestedUnitRate: Money;
  suggestedAmount: Money;
}

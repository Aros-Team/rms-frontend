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
 * `hourlyRate` is always present. For event types with a manual rate
 * (`BONUS_PERFORMANCE`, `DEDUCTION`) the API has no multiplier, so
 * `multiplier`, `suggestedUnitRate` and `suggestedAmount` arrive as `null`.
 */
export interface PayrollCalculateResponse {
  userId: number;
  eventType: PayrollEventType;
  hourlyRate: Money;
  multiplier: number | null;
  suggestedUnitRate: Money | null;
  suggestedAmount: Money | null;
}

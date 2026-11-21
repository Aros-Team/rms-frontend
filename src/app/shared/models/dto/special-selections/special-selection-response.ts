import type { Money } from '@app/shared/models/dto/common/money';
import type { SelectionType } from './selection-type';
import type { ScheduleEntryResponse } from './schedule-entry';
import type { SpecialSelectionGroupResponse } from './special-selection-group';
import type { SpecialSelectionAdditionResponse } from './special-selection-addition';
import type { SpecialSelectionQuestionResponse } from './special-selection-question';

/**
 * Special selection configuration as returned by the API.
 *
 * The resource is keyed by the product it decorates, so the identifier is
 * `productId` (the API never sends an `id`).
 */
export interface SpecialSelectionResponse {
  productId: number;
  name: string;
  description: string;
  /** `MoneyDto` on the wire (`{ amount: string, currency: string }`). Use `toAmount()` for math, `| money` to render. */
  basePrice: Money;
  active: boolean;
  preparationAreaId: number;
  selectionType: SelectionType;
  baseRecipeEnabled: boolean;
  schedulingRequired: boolean;
  groups: SpecialSelectionGroupResponse[];
  additions: SpecialSelectionAdditionResponse[];
  questions: SpecialSelectionQuestionResponse[];
  schedule: ScheduleEntryResponse[];
}

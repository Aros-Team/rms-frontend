import type { ScheduleEntryRequest } from './schedule-entry';
import type { SpecialSelectionGroupRequest } from './special-selection-group';
import type { SpecialSelectionAdditionRequest } from './special-selection-addition';
import type { SpecialSelectionQuestionRequest } from './special-selection-question';

export interface SpecialSelectionScheduleRequest {
  entries: ScheduleEntryRequest[];
}

export interface SpecialSelectionPriceRequest {
  basePrice: number;
}

export interface SpecialSelectionRequest {
  productId?: number;
  name: string;
  description: string;
  basePrice: number;
  active: boolean;
  baseRecipeEnabled: boolean;
  schedulingRequired: boolean;
  groups: SpecialSelectionGroupRequest[];
  additions: SpecialSelectionAdditionRequest[];
  questions: SpecialSelectionQuestionRequest[];
  schedule: ScheduleEntryRequest[];
}
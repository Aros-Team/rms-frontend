import type { SelectionType } from './selection-type';
import type { ScheduleEntryResponse } from './schedule-entry';
import type { SpecialSelectionGroupResponse } from './special-selection-group';
import type { SpecialSelectionAdditionResponse } from './special-selection-addition';
import type { SpecialSelectionQuestionResponse } from './special-selection-question';

export interface SpecialSelectionResponse {
  id: number;
  name: string;
  description: string;
  basePrice: number;
  active: boolean;
  areaId: number;
  selectionType: SelectionType;
  baseRecipeEnabled: boolean;
  schedulingRequired: boolean;
  groups: SpecialSelectionGroupResponse[];
  additions: SpecialSelectionAdditionResponse[];
  questions: SpecialSelectionQuestionResponse[];
  schedule: ScheduleEntryResponse[];
}
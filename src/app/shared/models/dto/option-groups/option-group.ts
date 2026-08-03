import { ApiSelectionType } from '@app/shared/models/dto/option-groups/option-selection-type';

export interface OptionGroupRequest {
  name: string;
  description?: string;
  productIds: number[];   // required by API (minItems: 1)
  required?: boolean;     // optional — whether selection from the group is mandatory
  selectionType?: ApiSelectionType | null;
}

export interface OptionGroupResponse {
  id: number;
  name: string;
  description?: string;
  selectionType: ApiSelectionType;
  productIds: number[];
}

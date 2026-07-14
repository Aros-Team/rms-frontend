export interface SpecialSelectionOptionResponse {
  id: number;
  name: string;
  extraPrice: number;
  displayOrder: number;
  optionCategoryId: number;
}

export interface SpecialSelectionGroupRequest {
  name: string;
  displayOrder: number;
  required: boolean;
  minSelections: number;
  maxSelections: number;
  optionIds: number[];
}

export interface SpecialSelectionGroupResponse {
  id: number;
  name: string;
  required: boolean;
  minSelections: number;
  maxSelections: number;
  displayOrder: number;
  options: SpecialSelectionOptionResponse[];
}
export interface SpecialSelectionGroupRequest {
  id?: number | null;
  categoryId: number | null;
  displayOrder: number;
  required: boolean;
  minSelections: number;
  maxSelections: number;
  productIds: number[];
}

export interface SpecialSelectionGroupResponse {
  id: number;
  categoryId: number | null;
  categoryName?: string;
  displayOrder: number;
  required: boolean;
  minSelections: number;
  maxSelections: number;
  productIds: number[];
}

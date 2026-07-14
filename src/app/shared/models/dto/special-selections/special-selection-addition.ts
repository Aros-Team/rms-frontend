export interface SpecialSelectionAdditionRequest {
  name: string;
  optionId: number;
  extraPrice: number;
  displayOrder: number;
}

export interface SpecialSelectionAdditionResponse extends SpecialSelectionAdditionRequest {
  id: number;
  optionName: string;
}
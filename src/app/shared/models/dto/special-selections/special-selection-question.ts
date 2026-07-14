export interface SpecialSelectionQuestionRequest {
  question: string;
  required: boolean;
  displayOrder: number;
}

export interface SpecialSelectionQuestionResponse extends SpecialSelectionQuestionRequest {
  id: number;
}
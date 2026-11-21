export type QuestionType = 'TEXT' | 'CHOICE' | 'BOOLEAN';

export const QUESTION_TYPE = {
  TEXT: 'TEXT',
  CHOICE: 'CHOICE',
  BOOLEAN: 'BOOLEAN',
} as const;

export interface SpecialSelectionQuestionRequest {
  question: string;
  required: boolean;
  displayOrder: number;
  /** Defaults to `TEXT` on the API when omitted. */
  questionType?: QuestionType;
}

export interface SpecialSelectionQuestionResponse extends SpecialSelectionQuestionRequest {
  id: number;
  questionType: QuestionType;
}

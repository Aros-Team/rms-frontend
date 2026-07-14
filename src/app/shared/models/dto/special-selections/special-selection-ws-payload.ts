import type { SpecialSelectionResponse } from './special-selection-response';

export type ChangeType =
  | 'CREATE'
  | 'UPDATE'
  | 'SCHEDULE_CHANGE'
  | 'PRICE_CHANGE'
  | 'DELETE'
  | 'REVERT';

export const CHANGE_TYPE = {
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  SCHEDULE_CHANGE: 'SCHEDULE_CHANGE',
  PRICE_CHANGE: 'PRICE_CHANGE',
  DELETE: 'DELETE',
  REVERT: 'REVERT',
} as const;

export interface SpecialSelectionWsPayload {
  changeType: ChangeType;
  productId: number;
  active: boolean;
  selection: SpecialSelectionResponse | null;
}
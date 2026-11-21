import type { SpecialSelectionResponse } from './special-selection-response';

/**
 * Change types emitted by the API on `/topic/special-selections/updated`.
 *
 * A revert records a regular `UPDATE` history row, so there is no `REVERT`
 * change type.
 */
export type ChangeType =
  | 'CREATE'
  | 'UPDATE'
  | 'SCHEDULE_CHANGE'
  | 'PRICE_CHANGE'
  | 'DELETE';

export const CHANGE_TYPE = {
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  SCHEDULE_CHANGE: 'SCHEDULE_CHANGE',
  PRICE_CHANGE: 'PRICE_CHANGE',
  DELETE: 'DELETE',
} as const;

export interface SpecialSelectionWsPayload {
  changeType: ChangeType;
  productId: number;
  active: boolean;
  selection: SpecialSelectionResponse | null;
}

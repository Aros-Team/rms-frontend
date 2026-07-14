import type { ChangeType } from './special-selection-ws-payload';
import type { SpecialSelectionResponse } from './special-selection-response';

export interface SpecialSelectionHistoryEntry {
  version: number;
  changeType: ChangeType;
  author: string;
  timestamp: string;
  isCurrent: boolean;
  snapshot: SpecialSelectionResponse | null;
}

export interface SpecialSelectionHistoryPage {
  content: SpecialSelectionHistoryEntry[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
}

export interface SpecialSelectionHistoryRangeResponse {
  versions: SpecialSelectionHistoryEntry[];
}
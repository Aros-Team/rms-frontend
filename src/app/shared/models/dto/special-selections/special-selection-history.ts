import type { DayOfWeek } from './schedule-entry';
import type { ChangeType } from './special-selection-ws-payload';
import type { SelectionType } from './selection-type';

/**
 * Historical snapshot of a special selection configuration.
 *
 * The API stores each version as a serialized snapshot (not as a full
 * `SpecialSelectionResponse`): monetary values are plain numbers, there is no
 * `productId`/`preparationAreaId`, and the schedule times are serialized as
 * `HH:mm:ss` strings.
 */
export interface SpecialSelectionSnapshot {
  name: string;
  description: string | null;
  basePrice: number | null;
  selectionType: SelectionType;
  baseRecipeEnabled: boolean;
  schedulingRequired: boolean;
  active: boolean;
  groups: SpecialSelectionSnapshotGroup[];
  additions: SpecialSelectionSnapshotAddition[];
  questions: SpecialSelectionSnapshotQuestion[];
  schedule: SpecialSelectionSnapshotScheduleEntry[];
}

export interface SpecialSelectionSnapshotGroup {
  id: number | null;
  categoryId: number | null;
  required: boolean;
  minSelections: number;
  maxSelections: number;
  displayOrder: number;
  productIds: number[];
}

export interface SpecialSelectionSnapshotAddition {
  id: number | null;
  name: string;
  extraPrice: number | null;
  optionId: number | null;
  displayOrder: number;
}

export interface SpecialSelectionSnapshotQuestion {
  id: number | null;
  question: string;
  required: boolean;
  displayOrder: number;
  questionType: string;
}

export interface SpecialSelectionSnapshotScheduleEntry {
  id: number | null;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
}

/** A single change-history row as returned by the API. */
export interface SpecialSelectionHistoryEntry {
  id: number;
  productId: number;
  version: number;
  changeType: ChangeType;
  /** Serialized `SpecialSelectionSnapshot` (JSON string). Parse with `parseHistorySnapshot()`. */
  snapshotJson: string | null;
  changedBy: string;
  /** ISO local date-time, e.g. `2026-11-21T16:22:07`. */
  changedAt: string;
  isCurrent: boolean;
}

/** History page in the Spring HATEOAS `{ content, page }` dialect. */
export interface SpecialSelectionHistoryPage {
  content: SpecialSelectionHistoryEntry[];
  page: {
    size: number;
    number: number;
    totalElements: number;
    totalPages: number;
  };
}

/**
 * Parses the serialized snapshot of a history entry.
 *
 * Returns `null` when the entry has no snapshot or it is not valid JSON, so the
 * UI can keep rendering the timeline instead of breaking.
 */
export function parseHistorySnapshot(
  entry: Pick<SpecialSelectionHistoryEntry, 'snapshotJson'>,
): SpecialSelectionSnapshot | null {
  if (!entry.snapshotJson) {
    return null;
  }
  try {
    return JSON.parse(entry.snapshotJson) as SpecialSelectionSnapshot;
  } catch {
    return null;
  }
}

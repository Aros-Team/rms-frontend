import type { FloorLayout } from '@app/shared/models/dto/floor-layout/floor-layout';

import { EditorHistory } from './editor-history';
import {
  FLOOR_GROW_MARGIN,
  FLOOR_MAX_COLUMNS,
  FLOOR_MAX_ROWS,
  analyzeResize,
  buildCellIndex,
  cellKey,
  checkAreaMove,
  checkMove,
  cropLayout,
  isValidDimensions,
  layoutToDto,
  parseCellKey,
  translateCells,
  type CellKey,
  type EditorLayout,
  type EditorRegion,
} from './geometry';

/** Outcome of a paint stroke. */
export interface PaintOutcome {
  readonly changed: boolean;
  readonly painted: number;
  readonly blocked: number;
  readonly targetRegionKey: string | null;
  readonly reason: 'no-area' | 'owned-by-other' | 'out-of-bounds' | null;
  readonly conflictAreaId: number | null;
}

/** Outcome of an erase stroke. */
export interface EraseOutcome {
  readonly changed: boolean;
  readonly erased: number;
  readonly removedRegionKeys: readonly string[];
}

/** Outcome of moving a region. */
export interface MoveOutcome {
  readonly ok: boolean;
  readonly changed: boolean;
  readonly reason: 'missing' | 'bounds' | 'overlap' | null;
}

/** Outcome of a resize operation. */
export interface ResizeOutcome {
  readonly changed: boolean;
  readonly clippedCells: number;
  readonly removedRegions: number;
}

type KeyFactory = () => string;

let fallbackKey = 0;

function defaultKeyFactory(): string {
  if (typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  fallbackKey += 1;
  return `region-${String(Date.now())}-${String(fallbackKey)}`;
}

/**
 * Framework-agnostic editor engine.
 *
 * The page owns I/O, tools, dialogs and zoom; this class owns legal layout
 * transitions, selection, dirty tracking and undo/redo. It has no Angular or DOM
 * dependency, which keeps the interaction rules testable in isolation.
 */
export class FloorLayoutEditorEngine {
  private current: EditorLayout;
  private saved: EditorLayout;
  private savedSerialized: string;
  private index = new Map<CellKey, string>();
  private pendingBefore: EditorLayout | null = null;
  private strokeTargetKey: string | null = null;
  private strokeBlockedByAreaId: number | null = null;
  private readonly history = new EditorHistory<EditorLayout>();

  constructor(
    initial: EditorLayout,
    initialSaved: EditorLayout = initial,
    private readonly createKey: KeyFactory = defaultKeyFactory,
  ) {
    this.current = initial;
    this.saved = initialSaved;
    this.savedSerialized = JSON.stringify(layoutToDto(initialSaved));
    this.rebuildIndex();
  }

  get layout(): EditorLayout {
    return this.current;
  }

  get canUndo(): boolean {
    return this.history.canUndo;
  }

  get canRedo(): boolean {
    return this.history.canRedo;
  }

  /** True when the current document differs from the last saved document. */
  isDirty(): boolean {
    return JSON.stringify(layoutToDto(this.current)) !== this.savedSerialized;
  }

  /** Finds the region at a cell using the engine's live index. */
  regionAt(cell: CellKey): EditorRegion | undefined {
    const key = this.index.get(cell);
    if (key === undefined) return undefined;
    return this.current.regions.find((region) => region.key === key);
  }

  /** Starts a multi-cell stroke; one history entry is created on commit. */
  beginStroke(): void {
    this.pendingBefore ??= this.current;
    this.strokeTargetKey = null;
    this.strokeBlockedByAreaId = null;
  }

  /** Commits a stroke only when it actually changed the layout. */
  commitStroke(): void {
    const before = this.pendingBefore;
    this.pendingBefore = null;
    this.strokeTargetKey = null;
    this.strokeBlockedByAreaId = null;
    if (before !== null && before !== this.current) {
      this.history.push(before);
    }
  }

  /** Discards the pending stroke boundary without adding history. */
  cancelStroke(): void {
    this.pendingBefore = null;
    this.strokeTargetKey = null;
    this.strokeBlockedByAreaId = null;
  }

  /**
   * Paints cells for an area.
   *
   * The first cell decides the target: an existing region of the same area is
   * extended, an empty cell creates a new region, and a region of another area
   * blocks the whole stroke.
   */
  paintCells(areaId: number | null, cells: readonly CellKey[]): PaintOutcome {
    if (areaId === null) {
      return this.paintFailure('no-area');
    }

    if (this.strokeBlockedByAreaId !== null) {
      return {
        changed: false,
        painted: 0,
        blocked: cells.length,
        targetRegionKey: null,
        reason: 'owned-by-other',
        conflictAreaId: this.strokeBlockedByAreaId,
      };
    }

    const ordered = [...new Set(cells)];
    if (ordered.length === 0) {
      return this.paintFailure(null);
    }

    const first = ordered[0];
    const firstOwnerKey = this.index.get(first);
    let targetKey: string | null = null;

    const strokeTarget = this.current.regions.find(
      (region) => region.key === this.strokeTargetKey && region.areaId === areaId,
    );
    if (strokeTarget !== undefined) {
      targetKey = strokeTarget.key;
    } else if (firstOwnerKey !== undefined) {
      const owner = this.current.regions.find((region) => region.key === firstOwnerKey);
      if (owner === undefined) {
        return this.paintFailure(null);
      }
      if (owner.areaId !== areaId) {
        this.strokeBlockedByAreaId = owner.areaId;
        return {
          changed: false,
          painted: 0,
          blocked: ordered.length,
          targetRegionKey: owner.key,
          reason: 'owned-by-other',
          conflictAreaId: owner.areaId,
        };
      }
      targetKey = owner.key;
    }

    this.growForCells(ordered);

    const additions = new Set<CellKey>();
    let blocked = 0;
    for (const key of ordered) {
      const parsed = parseCellKey(key);
      if (
        parsed === null ||
        parsed.row < 0 ||
        parsed.row >= this.current.rows ||
        parsed.column < 0 ||
        parsed.column >= this.current.columns
      ) {
        blocked += 1;
        continue;
      }
      const ownerKey = this.index.get(key);
      if (ownerKey !== undefined) {
        if (ownerKey !== targetKey) blocked += 1;
        continue;
      }
      additions.add(key);
    }

    if (additions.size === 0) {
      return {
        changed: false,
        painted: 0,
        blocked,
        targetRegionKey: targetKey,
        reason: null,
        conflictAreaId: null,
      };
    }

    if (targetKey === null) {
      targetKey = this.createKey();
      this.setLayout({
        ...this.current,
        regions: [
          ...this.current.regions,
          { key: targetKey, areaId, cells: new Set(additions) },
        ],
      });
    } else {
      const key = targetKey;
      this.setLayout({
        ...this.current,
        regions: this.current.regions.map((region) =>
          region.key === key
            ? { ...region, cells: new Set([...region.cells, ...additions]) }
            : region,
        ),
      });
    }

    this.strokeTargetKey = targetKey;
    return {
      changed: true,
      painted: additions.size,
      blocked,
      targetRegionKey: targetKey,
      reason: null,
      conflictAreaId: null,
    };
  }

  /** Erases cells from whichever regions own them. */
  eraseCells(cells: readonly CellKey[]): EraseOutcome {
    const ordered = new Set(cells);
    if (ordered.size === 0) {
      return { changed: false, erased: 0, removedRegionKeys: [] };
    }

    const affected = new Map<string, Set<CellKey>>();
    let erased = 0;
    for (const key of ordered) {
      const owner = this.index.get(key);
      if (owner === undefined) continue;
      const region = this.current.regions.find((candidate) => candidate.key === owner);
      if (region === undefined) continue;
      const remaining = affected.get(owner) ?? new Set(region.cells);
      if (remaining.delete(key)) erased += 1;
      affected.set(owner, remaining);
    }

    if (erased === 0) {
      return { changed: false, erased: 0, removedRegionKeys: [] };
    }

    const removedRegionKeys: string[] = [];
    const regions: EditorRegion[] = [];
    for (const region of this.current.regions) {
      const remaining = affected.get(region.key);
      if (remaining === undefined) {
        regions.push(region);
      } else if (remaining.size > 0) {
        regions.push({ ...region, cells: remaining });
      } else {
        removedRegionKeys.push(region.key);
      }
    }

    this.setLayout({ ...this.current, regions });
    return { changed: true, erased, removedRegionKeys };
  }

  /** Moves a whole region by a cell delta without allowing overlap. */
  moveRegion(key: string, deltaRow: number, deltaColumn: number): MoveOutcome {
    const region = this.current.regions.find((candidate) => candidate.key === key);
    if (region === undefined) {
      return { ok: false, changed: false, reason: 'missing' };
    }
    if (!Number.isInteger(deltaRow) || !Number.isInteger(deltaColumn)) {
      return { ok: false, changed: false, reason: 'bounds' };
    }
    if (deltaRow === 0 && deltaColumn === 0) {
      return { ok: true, changed: false, reason: null };
    }

    const check = checkMove(this.current, this.index, key, deltaRow, deltaColumn);
    if (!check.ok) {
      return { ok: false, changed: false, reason: check.reason };
    }

    const moved = new Set<CellKey>();
    for (const cell of region.cells) {
      const parsed = parseCellKey(cell);
      if (parsed === null) continue;
      moved.add(cellKey(parsed.row + deltaRow, parsed.column + deltaColumn));
    }

    this.setLayout({
      ...this.current,
      regions: this.current.regions.map((candidate) =>
        candidate.key === key ? { ...candidate, cells: moved } : candidate,
      ),
    });
    return { ok: true, changed: true, reason: null };
  }

  /** Deletes one region as a single history action. */
  deleteRegion(key: string): boolean {
    if (!this.current.regions.some((region) => region.key === key)) return false;
    const before = this.current;
    this.setLayout({
      ...this.current,
      regions: this.current.regions.filter((region) => region.key !== key),
    });
    this.history.push(before);
    return true;
  }

  /**
   * Normalizes camera-negative coordinates by shifting the whole document.
   *
   * This is part of the current stroke/action and deliberately does not push a
   * separate history entry.
   */
  shift(rows: number, columns: number): void {
    if (rows === 0 && columns === 0) return;
    this.setLayout({
      ...this.current,
      rows: this.current.rows + rows,
      columns: this.current.columns + columns,
      regions: this.current.regions.map((region) => ({
        ...region,
        cells: translateCells(region.cells, rows, columns),
      })),
    });
  }

  /** Moves every region of an area as one action. */
  moveArea(areaId: number, deltaRow: number, deltaColumn: number): MoveOutcome {
    if (deltaRow === 0 && deltaColumn === 0) {
      return { ok: true, changed: false, reason: null };
    }
    const check = checkAreaMove(
      this.current,
      this.index,
      areaId,
      deltaRow,
      deltaColumn,
    );
    if (!check.ok) {
      return { ok: false, changed: false, reason: check.reason };
    }

    const previewCells = this.current.regions
      .filter((region) => region.areaId === areaId)
      .flatMap((region) => [...translateCells(region.cells, deltaRow, deltaColumn)]);
    if (previewCells.some((cell) => {
      const parsed = parseCellKey(cell);
      return parsed === null || parsed.row < 0 || parsed.column < 0;
    })) {
      return { ok: false, changed: false, reason: 'bounds' };
    }

    const before = this.current;
    const targetCells = this.current.regions
      .filter((region) => region.areaId === areaId)
      .flatMap((region) => [...translateCells(region.cells, deltaRow, deltaColumn)]);
    this.growForCells(targetCells);
    this.setLayout({
      ...this.current,
      regions: this.current.regions.map((region) =>
        region.areaId === areaId
          ? { ...region, cells: translateCells(region.cells, deltaRow, deltaColumn) }
          : region,
      ),
    });
    this.history.push(before);
    return { ok: true, changed: true, reason: null };
  }

  /** Removes every region of an area as one action. */
  deleteArea(areaId: number): boolean {
    if (!this.current.regions.some((region) => region.areaId === areaId)) return false;
    const before = this.current;
    this.setLayout({
      ...this.current,
      regions: this.current.regions.filter((region) => region.areaId !== areaId),
    });
    this.history.push(before);
    return true;
  }

  /** Counts cells that a resize would clip. */
  resizeImpact(columns: number, rows: number): { clippedCells: number; affectedRegions: number } {
    return analyzeResize(this.current, columns, rows);
  }

  /** Resizes the grid, cropping only after the caller has confirmed. */
  resize(columns: number, rows: number): ResizeOutcome {
    if (!isValidDimensions(columns, rows)) {
      return { changed: false, clippedCells: 0, removedRegions: 0 };
    }
    if (columns === this.current.columns && rows === this.current.rows) {
      return { changed: false, clippedCells: 0, removedRegions: 0 };
    }

    const before = this.current;
    const result = cropLayout(this.current, columns, rows);
    this.setLayout(result.layout);
    this.history.push(before);
    return {
      changed: true,
      clippedCells: result.clippedCells,
      removedRegions: result.removedRegions,
    };
  }

  /** Reverts the last action. Returns true when the layout changed. */
  undo(): boolean {
    const previous = this.history.undo(this.current);
    if (previous === null) return false;
    this.applyRestored(previous);
    return true;
  }

  /** Reapplies the last undone action. */
  redo(): boolean {
    const next = this.history.redo(this.current);
    if (next === null) return false;
    this.applyRestored(next);
    return true;
  }

  /** Marks a server response as the new saved baseline. */
  markSaved(saved: EditorLayout): void {
    this.saved = saved;
    this.current = saved;
    this.savedSerialized = JSON.stringify(layoutToDto(saved));
    this.rebuildIndex();
  }

  /** Restores the last saved document and clears the undo history. */
  resetToSaved(): void {
    this.current = this.saved;
    this.history.clear();
    this.pendingBefore = null;
    this.rebuildIndex();
  }

  /** Replaces the document without touching how dirty it is. */
  replace(layout: EditorLayout): void {
    this.current = layout;
    this.rebuildIndex();
  }

  /**
   * Grows the grid when a stroke reaches the last row or column.
   *
   * The canvas behaves as an infinite sheet: the persisted dimensions are just
   * the current extent, not a user-configured limit.
   */
  private growForCells(cells: readonly CellKey[]): void {
    let maxRow = -1;
    let maxColumn = -1;
    for (const key of cells) {
      const parsed = parseCellKey(key);
      if (parsed === null) continue;
      maxRow = Math.max(maxRow, parsed.row);
      maxColumn = Math.max(maxColumn, parsed.column);
    }
    if (maxRow < 0 || maxColumn < 0) return;

    const nextColumns = Math.min(
      FLOOR_MAX_COLUMNS,
      Math.max(
        this.current.columns,
        maxColumn + 1,
        maxColumn >= this.current.columns - 1
            ? this.current.columns + FLOOR_GROW_MARGIN
            : 0,
      ),
    );
    const nextRows = Math.min(
      FLOOR_MAX_ROWS,
      Math.max(
        this.current.rows,
        maxRow + 1,
        maxRow >= this.current.rows - 1 ? this.current.rows + FLOOR_GROW_MARGIN : 0,
      ),
    );

    if (nextColumns !== this.current.columns || nextRows !== this.current.rows) {
      this.setLayout({ ...this.current, columns: nextColumns, rows: nextRows });
    }
  }

  private paintFailure(reason: PaintOutcome['reason']): PaintOutcome {
    return {
      changed: false,
      painted: 0,
      blocked: 0,
      targetRegionKey: null,
      reason,
      conflictAreaId: null,
    };
  }

  private applyRestored(layout: EditorLayout): void {
    this.current = layout;
    this.rebuildIndex();
  }

  private setLayout(layout: EditorLayout): void {
    this.current = layout;
    this.rebuildIndex();
  }

  private rebuildIndex(): void {
    this.index = buildCellIndex(this.current);
  }
}

/** Convenience helper for JSON-equality tests. */
export function layoutJson(layout: EditorLayout): string {
  return JSON.stringify(layoutToDto(layout));
}

/** Re-export the DTO helper for callers that only need to serialize. */
export { layoutToDto };
export type { FloorLayout };

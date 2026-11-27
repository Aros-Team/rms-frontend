import type {
  FloorLayout,
  FloorLayoutRegion,
  FloorLayoutSegment,
} from '@app/shared/models/dto/floor-layout/floor-layout';

/**
 * SVG presentation for one editor region.
 *
 * Paths use grid-cell units (the SVG viewBox is `0 0 columns rows`), so zoom is
 * purely a CSS concern and never touches geometry.
 */
export interface RegionShape {
  /** Row runs used as the translucent fill. */
  readonly fillPath: string;
  /** Boundary edges only, used for the solid outline. */
  readonly outlinePath: string;
  readonly bounds: {
    readonly minRow: number;
    readonly maxRow: number;
    readonly minColumn: number;
    readonly maxColumn: number;
    readonly width: number;
    readonly height: number;
  };
  readonly labelX: number;
  readonly labelY: number;
  readonly showLabel: boolean;
}

/** Editable grid bounds. Keep in sync with `FloorLayoutLimits.java`. */
export const FLOOR_MIN_COLUMNS = 8;
export const FLOOR_MAX_COLUMNS = 100_000;
export const FLOOR_MIN_ROWS = 6;
export const FLOOR_MAX_ROWS = 100_000;
/** Cells added when a stroke reaches the current edge. */
export const FLOOR_GROW_MARGIN = 4;
export const FLOOR_DEFAULT_COLUMNS = 32;
export const FLOOR_DEFAULT_ROWS = 20;

/** `row:column` key used by the editor's cell sets. */
export type CellKey = string;

/** One editable region: a set of painted cells linked to an area. */
export interface EditorRegion {
  readonly key: string;
  readonly areaId: number;
  readonly cells: ReadonlySet<CellKey>;
}

/** Complete editable layout. */
export interface EditorLayout {
  readonly columns: number;
  readonly rows: number;
  readonly regions: readonly EditorRegion[];
}

/** Resize impact used by the confirmation dialog. */
export interface ResizeImpact {
  readonly clippedCells: number;
  readonly affectedRegions: number;
}

/** Result of a move validation. */
export interface MoveCheck {
  readonly ok: boolean;
  readonly reason: 'missing' | 'bounds' | 'overlap' | null;
}

/** Result of a crop operation. */
export interface CropResult {
  readonly layout: EditorLayout;
  readonly clippedCells: number;
  readonly removedRegions: number;
}

/** Builds the stable key for a cell. */
export function cellKey(row: number, column: number): CellKey {
  return `${String(row)}:${String(column)}`;
}

/** Parses a cell key, returning null for malformed input. */
export function parseCellKey(key: CellKey): { row: number; column: number } | null {
  const match = /^(-?\d+):(-?\d+)$/.exec(key);
  if (match === null) return null;
  return { row: Number(match[1]), column: Number(match[2]) };
}

/** Expands canonical API segments into a set of cells. */
export function segmentsToCells(segments: readonly FloorLayoutSegment[]): Set<CellKey> {
  const cells = new Set<CellKey>();
  for (const segment of segments) {
    for (let column = segment.from; column <= segment.to; column += 1) {
      cells.add(cellKey(segment.row, column));
    }
  }
  return cells;
}

/** Converts a cell set into sorted, merged row segments. */
export function cellsToSegments(cells: ReadonlySet<CellKey>): FloorLayoutSegment[] {
  const rows = new Map<number, number[]>();
  for (const key of cells) {
    const parsed = parseCellKey(key);
    if (parsed === null) continue;
    const columns = rows.get(parsed.row) ?? [];
    columns.push(parsed.column);
    rows.set(parsed.row, columns);
  }

  const segments: FloorLayoutSegment[] = [];
  for (const row of [...rows.keys()].sort((left, right) => left - right)) {
    const columns = [...(rows.get(row) ?? [])].sort((left, right) => left - right);
    if (columns.length === 0) continue;

    let from = columns[0];
    let to = columns[0];
    for (let index = 1; index < columns.length; index += 1) {
      const column = columns[index];
      if (column <= to + 1) {
        to = Math.max(to, column);
      } else {
        segments.push({ row, from, to });
        from = column;
        to = column;
      }
    }
    segments.push({ row, from, to });
  }
  return segments;
}

/** Converts the API document to the editable representation. */
export function layoutFromDto(dto: FloorLayout): EditorLayout {
  return {
    columns: dto.columns,
    rows: dto.rows,
    regions: dto.regions.map((region) => ({
      key: region.key,
      areaId: region.areaId,
      cells: segmentsToCells(region.segments),
    })),
  };
}

/** Serializes the editable layout to the API contract. */
export function layoutToDto(layout: EditorLayout): FloorLayout {
  const regions: FloorLayoutRegion[] = [...layout.regions]
    .sort((left, right) => left.key.localeCompare(right.key))
    .map((region) => ({
      key: region.key,
      areaId: region.areaId,
      segments: cellsToSegments(region.cells),
    }));
  return { columns: layout.columns, rows: layout.rows, regions };
}

/** Builds a cell → region key index for O(1) hit tests. */
export function buildCellIndex(layout: EditorLayout): Map<CellKey, string> {
  const index = new Map<CellKey, string>();
  for (const region of layout.regions) {
    for (const key of region.cells) {
      index.set(key, region.key);
    }
  }
  return index;
}

/** Returns the region occupying a cell, if any. */
export function regionAtCell(
  layout: EditorLayout,
  index: ReadonlyMap<CellKey, string>,
  cell: CellKey,
): EditorRegion | undefined {
  const key = index.get(cell);
  if (key === undefined) return undefined;
  return layout.regions.find((region) => region.key === key);
}

/** Returns a region by key. */
export function regionByKey(layout: EditorLayout, key: string | null): EditorRegion | undefined {
  if (key === null) return undefined;
  return layout.regions.find((region) => region.key === key);
}

/** Returns the cell a pointer maps to inside a grid rectangle. */
export function pointerToCell(
  rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>,
  clientX: number,
  clientY: number,
  columns: number,
  rows: number,
): CellKey | null {
  if (rect.width <= 0 || rect.height <= 0) return null;
  const column = Math.floor(((clientX - rect.left) / rect.width) * columns);
  const row = Math.floor(((clientY - rect.top) / rect.height) * rows);
  if (column < 0 || column >= columns || row < 0 || row >= rows) return null;
  return cellKey(row, column);
}

/**
 * Bresenham line between two cells, used so fast pointer moves do not leave
 * gaps in a stroke.
 */
export function cellsBetween(from: CellKey, to: CellKey): CellKey[] {
  const start = parseCellKey(from);
  const end = parseCellKey(to);
  if (start === null || end === null) return [to];

  const cells: CellKey[] = [];
  let x = start.column;
  let y = start.row;
  const dx = Math.abs(end.column - start.column);
  const dy = Math.abs(end.row - start.row);
  const sx = start.column < end.column ? 1 : -1;
  const sy = start.row < end.row ? 1 : -1;
  let error = dx - dy;

  for (;;) {
    cells.push(cellKey(y, x));
    if (x === end.column && y === end.row) break;
    const doubled = error * 2;
    if (doubled > -dy) {
      error -= dy;
      x += sx;
    }
    if (doubled < dx) {
      error += dx;
      y += sy;
    }
  }
  return cells;
}

/** Validates a whole-region move against bounds and other regions. */
export function checkMove(
  layout: EditorLayout,
  index: ReadonlyMap<CellKey, string>,
  key: string,
  deltaRow: number,
  deltaColumn: number,
): MoveCheck {
  const region = layout.regions.find((candidate) => candidate.key === key);
  if (region === undefined) return { ok: false, reason: 'missing' };
  if (!Number.isInteger(deltaRow) || !Number.isInteger(deltaColumn)) {
    return { ok: false, reason: 'bounds' };
  }

  for (const cell of region.cells) {
    const parsed = parseCellKey(cell);
    if (parsed === null) return { ok: false, reason: 'bounds' };
    const row = parsed.row + deltaRow;
    const column = parsed.column + deltaColumn;
    if (row < 0 || row >= layout.rows || column < 0 || column >= layout.columns) {
      return { ok: false, reason: 'bounds' };
    }
    const target = cellKey(row, column);
    const owner = index.get(target);
    if (owner !== undefined && owner !== key) {
      return { ok: false, reason: 'overlap' };
    }
  }
  return { ok: true, reason: null };
}

/** Offsets a set of cells without mutating the source. */
export function translateCells(
  cells: ReadonlySet<CellKey>,
  deltaRow: number,
  deltaColumn: number,
): Set<CellKey> {
  const moved = new Set<CellKey>();
  for (const key of cells) {
    const parsed = parseCellKey(key);
    if (parsed === null) continue;
    moved.add(cellKey(parsed.row + deltaRow, parsed.column + deltaColumn));
  }
  return moved;
}

/** Returns every cell painted for one area. */
export function areaCells(layout: EditorLayout, areaId: number): Set<CellKey> {
  const cells = new Set<CellKey>();
  for (const region of layout.regions) {
    if (region.areaId !== areaId) continue;
    for (const key of region.cells) cells.add(key);
  }
  return cells;
}

/** Bounding box of every painted cell, or null for an empty map. */
export function contentBounds(layout: EditorLayout): {
  minRow: number;
  maxRow: number;
  minColumn: number;
  maxColumn: number;
} | null {
  let minRow = Number.POSITIVE_INFINITY;
  let maxRow = Number.NEGATIVE_INFINITY;
  let minColumn = Number.POSITIVE_INFINITY;
  let maxColumn = Number.NEGATIVE_INFINITY;
  for (const region of layout.regions) {
    for (const key of region.cells) {
      const parsed = parseCellKey(key);
      if (parsed === null) continue;
      minRow = Math.min(minRow, parsed.row);
      maxRow = Math.max(maxRow, parsed.row);
      minColumn = Math.min(minColumn, parsed.column);
      maxColumn = Math.max(maxColumn, parsed.column);
    }
  }
  return Number.isFinite(minRow) ? { minRow, maxRow, minColumn, maxColumn } : null;
}

/** Validates a whole-area move against bounds and other areas. */
export function checkAreaMove(
  layout: EditorLayout,
  index: ReadonlyMap<CellKey, string>,
  areaId: number,
  deltaRow: number,
  deltaColumn: number,
): MoveCheck {
  const cells = areaCells(layout, areaId);
  if (cells.size === 0) return { ok: false, reason: 'missing' };
  if (!Number.isInteger(deltaRow) || !Number.isInteger(deltaColumn)) {
    return { ok: false, reason: 'bounds' };
  }

  for (const cell of cells) {
    const parsed = parseCellKey(cell);
    if (parsed === null) return { ok: false, reason: 'bounds' };
    const row = parsed.row + deltaRow;
    const column = parsed.column + deltaColumn;
    const ownerKey = index.get(cellKey(row, column));
    if (ownerKey === undefined) continue;
    const owner = layout.regions.find((region) => region.key === ownerKey);
    if (owner !== undefined && owner.areaId !== areaId) {
      return { ok: false, reason: 'overlap' };
    }
  }
  return { ok: true, reason: null };
}

/** Merges every region of the same area into one cell set for rendering. */
export function mergeCellsByArea(layout: EditorLayout): Map<number, Set<CellKey>> {
  const merged = new Map<number, Set<CellKey>>();
  for (const region of layout.regions) {
    const cells = merged.get(region.areaId) ?? new Set<CellKey>();
    for (const key of region.cells) cells.add(key);
    merged.set(region.areaId, cells);
  }
  return merged;
}

/** Presentation paths and label anchor for one region. */
export function regionShape(region: EditorRegion): RegionShape {
  return shapeForCells(region.cells);
}

/** Presentation paths and label anchor for a cell set. */
export function shapeForCells(cells: ReadonlySet<CellKey>): RegionShape {
  const fillParts: string[] = [];
  const outlineParts: string[] = [];
  let minRow = Number.POSITIVE_INFINITY;
  let maxRow = Number.NEGATIVE_INFINITY;
  let minColumn = Number.POSITIVE_INFINITY;
  let maxColumn = Number.NEGATIVE_INFINITY;

  for (const segment of cellsToSegments(cells)) {
    const width = segment.to - segment.from + 1;
    fillParts.push(
      `M${String(segment.from)} ${String(segment.row)}h${String(width)}v1h${String(-width)}z`,
    );
  }

  for (const key of cells) {
    const parsed = parseCellKey(key);
    if (parsed === null) continue;
    const { row, column } = parsed;
    minRow = Math.min(minRow, row);
    maxRow = Math.max(maxRow, row);
    minColumn = Math.min(minColumn, column);
    maxColumn = Math.max(maxColumn, column);

    if (!cells.has(cellKey(row - 1, column))) {
      outlineParts.push(
        `M${String(column)} ${String(row)}L${String(column + 1)} ${String(row)}`,
      );
    }
    if (!cells.has(cellKey(row, column + 1))) {
      outlineParts.push(
        `M${String(column + 1)} ${String(row)}L${String(column + 1)} ${String(row + 1)}`,
      );
    }
    if (!cells.has(cellKey(row + 1, column))) {
      outlineParts.push(
        `M${String(column)} ${String(row + 1)}L${String(column + 1)} ${String(row + 1)}`,
      );
    }
    if (!cells.has(cellKey(row, column - 1))) {
      outlineParts.push(
        `M${String(column)} ${String(row)}L${String(column)} ${String(row + 1)}`,
      );
    }
  }

  const width = Number.isFinite(minColumn) ? maxColumn - minColumn + 1 : 0;
  const height = Number.isFinite(minRow) ? maxRow - minRow + 1 : 0;

  return {
    fillPath: fillParts.join(''),
    outlinePath: outlineParts.join(''),
    bounds: { minRow, maxRow, minColumn, maxColumn, width, height },
    labelX: Number.isFinite(minColumn) ? (minColumn + maxColumn + 1) / 2 : 0,
    labelY: Number.isFinite(minRow) ? (minRow + maxRow + 1) / 2 : 0,
    showLabel: width >= 3 && height >= 2,
  };
}

/** True when the requested dimensions are inside the supported limits. */
export function isValidDimensions(columns: number, rows: number): boolean {
  return (
    Number.isInteger(columns) &&
    Number.isInteger(rows) &&
    columns >= FLOOR_MIN_COLUMNS &&
    columns <= FLOOR_MAX_COLUMNS &&
    rows >= FLOOR_MIN_ROWS &&
    rows <= FLOOR_MAX_ROWS
  );
}

/** Counts cells and regions that a shrink would affect. */
export function analyzeResize(layout: EditorLayout, columns: number, rows: number): ResizeImpact {
  let clippedCells = 0;
  let affectedRegions = 0;

  for (const region of layout.regions) {
    let regionClipped = 0;
    for (const key of region.cells) {
      const parsed = parseCellKey(key);
      if (parsed === null) continue;
      if (parsed.row >= rows || parsed.column >= columns) {
        regionClipped += 1;
      }
    }
    if (regionClipped > 0) {
      clippedCells += regionClipped;
      affectedRegions += 1;
    }
  }
  return { clippedCells, affectedRegions };
}

/** Crops out-of-bounds cells and removes regions that become empty. */
export function cropLayout(layout: EditorLayout, columns: number, rows: number): CropResult {
  let clippedCells = 0;
  const regions: EditorRegion[] = [];

  for (const region of layout.regions) {
    const cells = new Set<CellKey>();
    for (const key of region.cells) {
      const parsed = parseCellKey(key);
      if (parsed === null) continue;
      if (parsed.row >= 0 && parsed.row < rows && parsed.column >= 0 && parsed.column < columns) {
        cells.add(key);
      } else {
        clippedCells += 1;
      }
    }
    if (cells.size > 0) {
      regions.push({ ...region, cells });
    }
  }

  return {
    layout: { columns, rows, regions },
    clippedCells,
    removedRegions: layout.regions.length - regions.length,
  };
}

/**
 * Validates the editable layout before saving.
 *
 * @returns a Spanish message for the first violation, or null when valid
 */
export function validateLayout(layout: EditorLayout): string | null {
  if (!isValidDimensions(layout.columns, layout.rows)) {
    return 'El tamaño del lienzo está fuera de los límites permitidos.';
  }

  const keys = new Set<string>();
  const occupied = new Map<CellKey, string>();

  for (const region of layout.regions) {
    if (region.key.trim().length === 0) {
      return 'Cada región debe tener un identificador.';
    }
    if (keys.has(region.key)) {
      return 'Hay regiones con el mismo identificador.';
    }
    keys.add(region.key);
    if (!Number.isInteger(region.areaId) || region.areaId < 1) {
      return 'Cada región debe estar vinculada a un área.';
    }
    if (region.cells.size === 0) {
      return 'Cada región debe tener al menos una celda.';
    }

    for (const key of region.cells) {
      const parsed = parseCellKey(key);
      if (parsed === null) {
        return 'La geometría contiene una celda inválida.';
      }
      if (parsed.row < 0 || parsed.row >= layout.rows
        || parsed.column < 0 || parsed.column >= layout.columns) {
        return 'Una región queda fuera del lienzo.';
      }
      const owner = occupied.get(key);
      if (owner !== undefined) {
        return 'Las regiones no pueden compartir celdas.';
      }
      occupied.set(key, region.key);
    }
  }
  return null;
}

import { describe, expect, it } from 'vitest';

import {
  analyzeResize,
  cellKey,
  cellsBetween,
  cellsToSegments,
  cropLayout,
  layoutFromDto,
  layoutToDto,
  pointerToCell,
  regionAtCell,
  regionShape,
  segmentsToCells,
  validateLayout,
  type EditorLayout,
} from './geometry';

function layout(): EditorLayout {
  return {
    columns: 10,
    rows: 10,
    regions: [
      { key: 'a', areaId: 1, cells: new Set([cellKey(0, 0), cellKey(0, 1), cellKey(1, 0)]) },
    ],
  };
}

describe('floor layout geometry', () => {
  it('should round-trip segments and cells with canonical merged runs', () => {
    const cells = segmentsToCells([
      { row: 0, from: 0, to: 2 },
      { row: 0, from: 3, to: 4 },
      { row: 2, from: 5, to: 6 },
    ]);

    expect(cells.size).toBe(7);
    expect(cellsToSegments(cells)).toEqual([
      { row: 0, from: 0, to: 4 },
      { row: 2, from: 5, to: 6 },
    ]);
  });

  it('should serialize a layout deterministically', () => {
    const dto = layoutToDto(layout());

    expect(dto).toEqual({
      columns: 10,
      rows: 10,
      regions: [
        {
          key: 'a',
          areaId: 1,
          segments: [
            { row: 0, from: 0, to: 1 },
            { row: 1, from: 0, to: 0 },
          ],
        },
      ],
    });
    expect(layoutFromDto({ ...dto }).regions[0].cells.size).toBe(3);
  });

  it('should map a pointer to a cell and ignore the outside', () => {
    const rect = { left: 10, top: 20, width: 100, height: 50 };

    expect(pointerToCell(rect, 10, 20, 10, 10)).toBe(cellKey(0, 0));
    expect(pointerToCell(rect, 109, 69, 10, 10)).toBe(cellKey(9, 9));
    expect(pointerToCell(rect, 5, 20, 10, 10)).toBeNull();
    expect(pointerToCell(rect, 10, 80, 10, 10)).toBeNull();
  });

  it('should fill gaps between two pointer cells', () => {
    expect(cellsBetween(cellKey(2, 1), cellKey(2, 5))).toEqual([
      cellKey(2, 1),
      cellKey(2, 2),
      cellKey(2, 3),
      cellKey(2, 4),
      cellKey(2, 5),
    ]);
  });

  it('should build a clean fill and boundary outline for an irregular region', () => {
    const shape = regionShape(layout().regions[0]);

    expect(shape.fillPath).toContain('M0 0h2v1h-2z');
    expect(shape.outlinePath).toContain('M0 0L1 0');
    expect(shape.bounds).toMatchObject({ width: 2, height: 2 });
    expect(shape.showLabel).toBe(false);
  });

  it('should detect a resize impact and crop without keeping empty regions', () => {
    const source: EditorLayout = {
      columns: 10,
      rows: 10,
      regions: [
        { key: 'a', areaId: 1, cells: new Set([cellKey(0, 0), cellKey(8, 8)]) },
        { key: 'b', areaId: 2, cells: new Set([cellKey(9, 9)]) },
      ],
    };

    const impact = analyzeResize(source, 8, 8);
    expect(impact).toEqual({ clippedCells: 2, affectedRegions: 2 });

    const result = cropLayout(source, 8, 8);
    expect(result.clippedCells).toBe(2);
    expect(result.removedRegions).toBe(1);
    expect(result.layout.regions).toHaveLength(1);
    expect(result.layout.regions[0].cells.has(cellKey(0, 0))).toBe(true);
  });

  it('should reject overlapping regions and accept multiple regions per area', () => {
    const overlapping: EditorLayout = {
      columns: 10,
      rows: 10,
      regions: [
        { key: 'a', areaId: 1, cells: new Set([cellKey(0, 0)]) },
        { key: 'b', areaId: 2, cells: new Set([cellKey(0, 0)]) },
      ],
    };
    expect(validateLayout(overlapping)).toBe('Las regiones no pueden compartir celdas.');

    const valid: EditorLayout = {
      columns: 10,
      rows: 10,
      regions: [
        { key: 'a', areaId: 1, cells: new Set([cellKey(0, 0)]) },
        { key: 'b', areaId: 1, cells: new Set([cellKey(2, 2)]) },
      ],
    };
    expect(validateLayout(valid)).toBeNull();
  });

  it('should resolve a cell owner through the shared index', () => {
    const source = layout();
    const index = new Map<string, string>([[cellKey(0, 1), 'a']]);

    expect(regionAtCell(source, index, cellKey(0, 1))?.key).toBe('a');
    expect(regionAtCell(source, index, cellKey(5, 5))).toBeUndefined();
  });
});

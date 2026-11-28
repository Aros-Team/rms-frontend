import { describe, expect, it } from 'vitest';

import { FloorLayoutEditorEngine } from './editor-engine';
import { cellKey, layoutToDto, type EditorLayout } from './geometry';

function layout(): EditorLayout {
  return {
    columns: 10,
    rows: 10,
    regions: [
      { key: 'a', areaId: 1, cells: new Set([cellKey(0, 0), cellKey(0, 1)]) },
      { key: 'b', areaId: 2, cells: new Set([cellKey(5, 5)]) },
    ],
  };
}

function engine(): FloorLayoutEditorEngine {
  let key = 0;
  return new FloorLayoutEditorEngine(layout(), layout(), () => {
    key += 1;
    return `new-${String(key)}`;
  });
}

describe('FloorLayoutEditorEngine', () => {
  it('should create a region when painting empty cells', () => {
    const editor = engine();

    const result = editor.paintCells(3, [cellKey(2, 2), cellKey(2, 3)]);

    expect(result.changed).toBe(true);
    expect(result.targetRegionKey).toBe('new-1');
    expect(editor.layout.regions).toHaveLength(3);
    expect(editor.isDirty()).toBe(true);
  });

  it('should extend a region of the same area and reject another area', () => {
    const editor = engine();

    editor.beginStroke();
    const extended = editor.paintCells(1, [cellKey(0, 1), cellKey(0, 2)]);
    editor.commitStroke();
    expect(extended.changed).toBe(true);
    expect(extended.targetRegionKey).toBe('a');

    editor.beginStroke();
    const blocked = editor.paintCells(1, [cellKey(5, 5)]);
    editor.commitStroke();
    expect(blocked.changed).toBe(false);
    expect(blocked.reason).toBe('owned-by-other');
    expect(blocked.conflictAreaId).toBe(2);
  });

  it('should block the whole stroke when it starts on another area', () => {
    const editor = engine();
    editor.beginStroke();

    const first = editor.paintCells(1, [cellKey(5, 5)]);
    const later = editor.paintCells(1, [cellKey(2, 2)]);
    editor.commitStroke();

    expect(first.reason).toBe('owned-by-other');
    expect(later.reason).toBe('owned-by-other');
    expect(editor.layout.regions).toHaveLength(2);

    editor.beginStroke();
    const nextStroke = editor.paintCells(1, [cellKey(2, 2)]);
    editor.commitStroke();
    expect(nextStroke.changed).toBe(true);
  });

  it('should move and delete a whole area as single actions', () => {
    const editor = engine();
    editor.beginStroke();
    editor.paintCells(1, [cellKey(1, 1)]);
    editor.commitStroke();

    const moved = editor.moveArea(1, 2, 2);
    expect(moved).toMatchObject({ ok: true, changed: true });
    const areaOne = editor.layout.regions.filter((region) => region.areaId === 1);
    expect(areaOne.some((region) => region.cells.has(cellKey(2, 2)))).toBe(true);

    expect(editor.deleteArea(1)).toBe(true);
    expect(editor.layout.regions.some((region) => region.areaId === 1)).toBe(false);
    expect(editor.undo()).toBe(true);
    expect(editor.layout.regions.some((region) => region.areaId === 1)).toBe(true);
  });

  it('should erase cells and remove regions that become empty', () => {
    const editor = engine();

    const result = editor.eraseCells([cellKey(5, 5), cellKey(0, 0)]);

    expect(result.changed).toBe(true);
    expect(result.erased).toBe(2);
    expect(result.removedRegionKeys).toEqual(['b']);
    expect(editor.layout.regions.map((region) => region.key)).toEqual(['a']);
  });

  it('should move a region, reject overlap and reject out-of-bounds moves', () => {
    const editor = engine();

    expect(editor.moveRegion('b', -1, -1)).toMatchObject({ ok: true, changed: true });
    expect(editor.moveRegion('b', 6, 6)).toMatchObject({ ok: false, reason: 'bounds' });
    expect(editor.moveRegion('b', 0, 6)).toMatchObject({ ok: false, reason: 'bounds' });

    const overlap = editor.moveRegion('a', 4, 4);
    expect(overlap).toMatchObject({ ok: false, reason: 'overlap' });
  });

  it('should shift the whole document when the camera moves into negative space', () => {
    const editor = engine();
    editor.shift(2, 3);

    expect(editor.layout.rows).toBe(12);
    expect(editor.layout.columns).toBe(13);
    const areaOne = editor.layout.regions.find((region) => region.areaId === 1);
    expect(areaOne?.cells.has(cellKey(2, 3))).toBe(true);
  });

  it('should grow the canvas when a stroke reaches the edge', () => {
    const editor = engine();
    editor.beginStroke();
    editor.paintCells(3, [cellKey(9, 5)]);
    editor.commitStroke();

    expect(editor.layout.rows).toBeGreaterThan(10);
    expect(editor.layout.regions.some((region) => region.cells.has(cellKey(9, 5)))).toBe(true);
  });

  it('should keep one target region across the cell batches of one stroke', () => {
    const editor = engine();
    editor.beginStroke();
    editor.paintCells(3, [cellKey(2, 2)]);
    editor.paintCells(3, [cellKey(2, 3)]);
    editor.paintCells(3, [cellKey(2, 4)]);
    editor.commitStroke();

    expect(editor.layout.regions).toHaveLength(3);
    const created = editor.layout.regions.find((region) => region.areaId === 3);
    expect([...(created?.cells ?? [])].sort()).toEqual(['2:2', '2:3', '2:4']);
  });

  it('should undo and redo one stroke as a single action', () => {
    const editor = engine();
    editor.beginStroke();
    editor.paintCells(3, [cellKey(2, 2)]);
    editor.paintCells(3, [cellKey(2, 3)]);
    editor.commitStroke();

    expect(editor.layout.regions).toHaveLength(3);
    expect(editor.undo()).toBe(true);
    expect(editor.layout.regions).toHaveLength(2);
    expect(editor.redo()).toBe(true);
    expect(editor.layout.regions).toHaveLength(3);
  });

  it('should crop on resize and keep the selection when the region survives', () => {
    const source: EditorLayout = {
      ...layout(),
      regions: [layout().regions[0], { key: 'b', areaId: 2, cells: new Set([cellKey(9, 9)]) }],
    };
    const editor = new FloorLayoutEditorEngine(source, source, () => 'new-1');
    const result = editor.resize(10, 6);

    expect(result.changed).toBe(true);
    expect(result.clippedCells).toBe(1);
    expect(editor.layout.regions.map((region) => region.key)).toEqual(['a']);
  });

  it('should not become dirty when the server baseline is adopted', () => {
    const editor = engine();
    editor.paintCells(3, [cellKey(2, 2)]);
    const saved = editor.layout;

    editor.markSaved(saved);

    expect(editor.isDirty()).toBe(false);
    expect(layoutToDto(editor.layout).regions).toHaveLength(3);
  });
});

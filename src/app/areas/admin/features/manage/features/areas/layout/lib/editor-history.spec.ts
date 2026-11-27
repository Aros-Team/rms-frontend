import { describe, expect, it } from 'vitest';

import { EditorHistory } from './editor-history';

describe('EditorHistory', () => {
  it('should undo and redo snapshots', () => {
    const history = new EditorHistory<number>(3);
    history.push(1);
    history.push(2);

    expect(history.undo(3)).toBe(2);
    expect(history.undo(2)).toBe(1);
    expect(history.redo(1)).toBe(2);
    expect(history.redo(2)).toBe(3);
  });

  it('should drop the oldest entry when full and clear redo on a new action', () => {
    const history = new EditorHistory<number>(2);
    history.push(1);
    history.push(2);
    history.push(3);
    history.undo(4);

    expect(history.canUndo).toBe(true);
    history.push(5);
    expect(history.canRedo).toBe(false);
  });
});

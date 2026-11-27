import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  computed,
  signal,
} from '@angular/core';

import type { EditorTool } from '../../lib/editor-types';

interface ToolOption {
  readonly value: EditorTool;
  readonly label: string;
  readonly icon: string;
  readonly shortcut: string;
}

const TOOLS: readonly ToolOption[] = [
  { value: 'draw', label: 'Dibujar', icon: 'pi pi-pencil', shortcut: 'B' },
  { value: 'erase', label: 'Borrar', icon: 'pi pi-eraser', shortcut: 'E' },
  { value: 'pan', label: 'Mover', icon: '', shortcut: 'M' },
];

/** Tool and viewport controls for the floor editor. */
@Component({
  selector: 'app-layout-toolbar',
  templateUrl: './layout-toolbar.html',
  styleUrl: './layout-toolbar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LayoutToolbar {
  private readonly toolState = signal<EditorTool>('draw');
  private readonly zoomState = signal(1);
  private readonly canUndoState = signal(false);
  private readonly canRedoState = signal(false);

  @Input({ required: true })
  set tool(value: EditorTool) {
    this.toolState.set(value);
  }

  get tool(): EditorTool {
    return this.toolState();
  }

  @Input({ required: true })
  set zoom(value: number) {
    this.zoomState.set(value);
  }

  get zoom(): number {
    return this.zoomState();
  }

  @Input()
  set canUndo(value: boolean) {
    this.canUndoState.set(value);
  }

  get canUndo(): boolean {
    return this.canUndoState();
  }

  @Input()
  set canRedo(value: boolean) {
    this.canRedoState.set(value);
  }

  get canRedo(): boolean {
    return this.canRedoState();
  }

  @Output() readonly toolChange = new EventEmitter<EditorTool>();
  @Output() readonly undo = new EventEmitter<void>();
  @Output() readonly redo = new EventEmitter<void>();
  @Output() readonly zoomIn = new EventEmitter<void>();
  @Output() readonly zoomOut = new EventEmitter<void>();

  readonly tools = TOOLS;
  readonly zoomLabel = computed(() => `${String(Math.round(this.zoomState() * 100))}%`);

  selectTool(tool: EditorTool): void {
    this.toolChange.emit(tool);
  }
}

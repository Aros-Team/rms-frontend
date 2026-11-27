import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  Output,
  ViewChild,
  computed,
  signal,
} from '@angular/core';

import type { AreaResponse } from '@app/shared/models/dto/areas/area';

import { areaColorIndex } from '../../lib/area-colors';
import type { EditorTool } from '../../lib/editor-types';
import {
  buildCellIndex,
  cellKey,
  cellsBetween,
  contentBounds,
  mergeCellsByArea,
  shapeForCells,
  type CellKey,
  type EditorLayout,
} from '../../lib/geometry';

interface PointerStroke {
  readonly mode: 'draw' | 'erase';
  readonly pointerId: number;
  readonly lastCell: CellKey | null;
}

const CELL_SIZE_PX = 24;
const LABEL_MAX_LENGTH = 22;
const EDGE_PAN_THRESHOLD = 36;
const EDGE_PAN_STEP_PX = 18;
const EMPTY_LAYOUT: EditorLayout = { columns: 8, rows: 6, regions: [] };

/**
 * Interactive floor canvas.
 *
 * The visible grid is a camera window over an unbounded sheet. The persisted
 * dimensions are only the painted extent: the grid always fills the container,
 * and panning the camera never hits a canvas edge.
 */
@Component({
  selector: 'app-layout-canvas',
  templateUrl: './layout-canvas.html',
  styleUrl: './layout-canvas.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LayoutCanvas implements AfterViewInit, OnDestroy {
  private static nextId = 0;

  private readonly layoutState = signal<EditorLayout>(EMPTY_LAYOUT);
  private readonly toolState = signal<EditorTool>('draw');
  private readonly zoomState = signal(1);
  private readonly areasState = signal<readonly AreaResponse[]>([]);
  private readonly selectedAreaState = signal<number | null>(null);
  private readonly disabledState = signal(false);
  private readonly fullBleedState = signal(false);
  private readonly viewport = signal({ width: 0, height: 0 });
  private readonly origin = signal({ column: 0, row: 0 });

  @Input({ required: true })
  set layout(value: EditorLayout) {
    const first = !this.layoutReceived;
    this.layoutReceived = true;
    this.layoutState.set(value);
    if (first && value.regions.length === 0) {
      this.autoCentered = true;
    } else if (first) {
      this.maybeAutoCenter();
    }
  }

  get layout(): EditorLayout {
    return this.layoutState();
  }

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
  set areas(value: readonly AreaResponse[]) {
    this.areasState.set(value);
  }

  get areas(): readonly AreaResponse[] {
    return this.areasState();
  }

  @Input()
  set selectedAreaId(value: number | null) {
    this.selectedAreaState.set(value);
  }

  get selectedAreaId(): number | null {
    return this.selectedAreaState();
  }

  @Input()
  set disabled(value: boolean) {
    this.disabledState.set(value);
  }

  get disabled(): boolean {
    return this.disabledState();
  }

  @Input()
  set fullBleed(value: boolean) {
    this.fullBleedState.set(value);
  }

  get fullBleed(): boolean {
    return this.fullBleedState();
  }

  @Output() readonly paintCells = new EventEmitter<readonly CellKey[]>();
  @Output() readonly eraseCells = new EventEmitter<readonly CellKey[]>();
  @Output() readonly strokeStart = new EventEmitter<void>();
  @Output() readonly strokeEnd = new EventEmitter<void>();
  @Output() readonly missingArea = new EventEmitter<void>();

  @ViewChild('canvas', { static: true })
  private svgRef?: ElementRef<SVGSVGElement>;

  private readonly instanceId = LayoutCanvas.nextId++;
  private readonly stroke = signal<PointerStroke | null>(null);
  private resizeObserver?: ResizeObserver;
  private autoCentered = false;
  private layoutReceived = false;
  private panFrame: number | null = null;
  private panDx = 0;
  private panDy = 0;
  private panState: {
    pointerId: number;
    x: number;
    y: number;
    column: number;
    row: number;
  } | null = null;

  readonly gridId = `floor-grid-${String(this.instanceId)}`;
  readonly instructionsId = `floor-instructions-${String(this.instanceId)}`;
  readonly Math = Math;

  readonly cellIndex = computed(() => buildCellIndex(this.layoutState()));

  readonly visibleColumns = computed(() => {
    const width = this.viewport().width;
    return Math.max(1, width / (CELL_SIZE_PX * this.zoomState()));
  });

  readonly visibleRows = computed(() => {
    const height = this.viewport().height;
    return Math.max(1, height / (CELL_SIZE_PX * this.zoomState()));
  });

  readonly frame = computed(() => {
    const origin = this.origin();
    const width = this.visibleColumns();
    const height = this.visibleRows();
    return {
      x: origin.column,
      y: origin.row,
      width,
      height,
      viewBox: `${String(origin.column)} ${String(origin.row)} ${String(width)} ${String(height)}`,
    };
  });

  readonly areaById = computed(() => {
    const map = new Map<number, AreaResponse>();
    for (const area of this.areasState()) {
      map.set(area.id, area);
    }
    return map;
  });

  /** One merged shape per area: only the outer boundary of the area is stroked. */
  readonly areaShapes = computed(() => {
    const layout = this.layoutState();
    const names = this.areaById();
    return [...mergeCellsByArea(layout).entries()]
      .map(([areaId, cells]) => ({
        areaId,
        shape: shapeForCells(cells),
        cellCount: cells.size,
        colorIndex: areaColorIndex(areaId),
        name: names.get(areaId)?.name ?? `Área ${String(areaId)}`,
      }))
      .sort((left, right) => left.areaId - right.areaId);
  });

  readonly selectedShape = computed(() => {
    const areaId = this.selectedAreaState();
    if (areaId === null) return null;
    const cells = mergeCellsByArea(this.layoutState()).get(areaId);
    return cells === undefined || cells.size === 0 ? null : shapeForCells(cells);
  });

  ngAfterViewInit(): void {
    const svg = this.svgRef?.nativeElement;
    if (svg === undefined) return;
    this.refreshViewport();
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        this.refreshViewport();
      });
      this.resizeObserver.observe(svg);
    }
  }

  /** Re-reads the viewport size (also used by tests after mocking the SVG rect). */
  refreshViewport(): void {
    const svg = this.svgRef?.nativeElement;
    if (svg === undefined) return;
    const rect = svg.getBoundingClientRect();
    this.viewport.set({ width: rect.width, height: rect.height });
    this.maybeAutoCenter();
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.stopEdgePan();
  }

  regionLabel(name: string): string {
    return name.length > LABEL_MAX_LENGTH ? `${name.slice(0, LABEL_MAX_LENGTH - 1)}…` : name;
  }

  onPointerDown(event: PointerEvent): void {
    if (this.disabled) return;
    if (event.button === 1 || (event.button === 0 && this.tool === 'pan')) {
      this.beginPan(event);
      return;
    }
    if (event.button !== 0) return;

    const tool = this.tool;
    if (tool === 'draw') {
      if (this.selectedAreaId === null) {
        this.missingArea.emit();
        return;
      }
      event.preventDefault();
      this.svgRef?.nativeElement.setPointerCapture(event.pointerId);
      this.strokeStart.emit();
      const cell = this.cellFromEvent(event);
      if (cell === null) {
        this.strokeEnd.emit();
        return;
      }
      this.stroke.set({ mode: 'draw', pointerId: event.pointerId, lastCell: cell });
      this.paintCells.emit([cell]);
      return;
    }

    const cell = this.cellFromEvent(event);
    if (cell === null) return;

    event.preventDefault();
    this.svgRef?.nativeElement.setPointerCapture(event.pointerId);

    if (tool === 'erase') {
      this.stroke.set({ mode: 'erase', pointerId: event.pointerId, lastCell: cell });
      this.strokeStart.emit();
      this.eraseCells.emit([cell]);
    }
  }

  onPointerMove(event: PointerEvent): void {
    const pan = this.panState;
    if (pan !== null && pan.pointerId === event.pointerId) {
      this.movePan(event, pan);
      return;
    }

    const stroke = this.stroke();
    if (stroke === null || stroke.pointerId !== event.pointerId) {
      return;
    }

    const cell = this.cellFromEvent(event);
    if (cell !== null) this.updateEdgePan(event);
    if (cell === null) return;

    if (stroke.lastCell === null) return;
    if (stroke.lastCell === cell) return;
    const cells = cellsBetween(stroke.lastCell, cell).slice(1);
    this.stroke.set({ ...stroke, lastCell: cell });
    if (stroke.mode === 'draw') {
      this.paintCells.emit(cells);
    } else {
      this.eraseCells.emit(cells);
    }
  }

  onPointerUp(event: PointerEvent): void {
    if (this.panState?.pointerId === event.pointerId) {
      this.panState = null;
      this.svgRef?.nativeElement.releasePointerCapture(event.pointerId);
      return;
    }
    this.stopEdgePan();
    const stroke = this.stroke();
    if (stroke === null || stroke.pointerId !== event.pointerId) return;

    this.strokeEnd.emit();
    this.endStroke(event.pointerId);
  }

  onPointerCancel(event: PointerEvent): void {
    this.stopEdgePan();
    this.panState = null;
    const stroke = this.stroke();
    if (stroke === null || stroke.pointerId !== event.pointerId) return;
    this.strokeEnd.emit();
    this.endStroke(event.pointerId);
  }

  onPointerLeave(): void {
    this.stopEdgePan();
  }

  private maybeAutoCenter(): void {
    if (this.autoCentered) return;
    if (this.viewport().width <= 0 || this.viewport().height <= 0) return;
    if (this.layoutState().regions.length === 0) return;
    this.autoCentered = true;
    this.center();
  }

  /** Centers the camera on the painted content at the current zoom. */
  center(): void {
    if (this.viewport().width <= 0 || this.viewport().height <= 0) return;
    const bounds = contentBounds(this.layoutState());
    if (bounds === null) {
      this.origin.set({ column: 0, row: 0 });
      return;
    }
    const centerColumn = (bounds.minColumn + bounds.maxColumn + 1) / 2;
    const centerRow = (bounds.minRow + bounds.maxRow + 1) / 2;
    this.origin.set({
      column: Math.round(centerColumn - this.visibleColumns() / 2),
      row: Math.round(centerRow - this.visibleRows() / 2),
    });
  }

  onContextMenu(event: MouseEvent): void {
    event.preventDefault();
  }

  private beginPan(event: PointerEvent): void {
    const origin = this.origin();
    event.preventDefault();
    this.svgRef?.nativeElement.setPointerCapture(event.pointerId);
    this.panState = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      column: origin.column,
      row: origin.row,
    };
  }

  private movePan(
    event: PointerEvent,
    pan: { x: number; y: number; column: number; row: number },
  ): void {
    const cellSize = CELL_SIZE_PX * this.zoomState();
    this.origin.set({
      column: Math.round(pan.column - (event.clientX - pan.x) / cellSize),
      row: Math.round(pan.row - (event.clientY - pan.y) / cellSize),
    });
  }

  private updateEdgePan(event: PointerEvent): void {
    const svg = this.svgRef?.nativeElement;
    if (svg === undefined) return;
    const rect = svg.getBoundingClientRect();
    const cellSize = CELL_SIZE_PX * this.zoomState();
    const step = Math.max(1, Math.round(EDGE_PAN_STEP_PX / cellSize));
    let dx = 0;
    let dy = 0;
    if (event.clientX < rect.left + EDGE_PAN_THRESHOLD) dx = -step;
    else if (event.clientX > rect.right - EDGE_PAN_THRESHOLD) dx = step;
    if (event.clientY < rect.top + EDGE_PAN_THRESHOLD) dy = -step;
    else if (event.clientY > rect.bottom - EDGE_PAN_THRESHOLD) dy = step;

    this.panDx = dx;
    this.panDy = dy;
    if ((dx !== 0 || dy !== 0) && this.panFrame === null) {
      this.panFrame = requestAnimationFrame(this.panStep);
    }
  }

  private readonly panStep = (): void => {
    if (this.panDx === 0 && this.panDy === 0) {
      this.stopEdgePan();
      return;
    }
    const origin = this.origin();
    this.origin.set({
      column: origin.column + this.panDx,
      row: origin.row + this.panDy,
    });
    this.panFrame = requestAnimationFrame(this.panStep);
  };

  private stopEdgePan(): void {
    if (this.panFrame !== null) {
      cancelAnimationFrame(this.panFrame);
      this.panFrame = null;
    }
    this.panDx = 0;
    this.panDy = 0;
  }

  private endStroke(pointerId: number): void {
    this.svgRef?.nativeElement.releasePointerCapture(pointerId);
    this.stroke.set(null);
  }

  private cellFromEvent(event: PointerEvent): CellKey | null {
    const element = this.svgRef?.nativeElement;
    if (element === undefined) return null;
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const frame = this.frame();
    const column =
      frame.x + Math.floor(((event.clientX - rect.left) / rect.width) * frame.width);
    const row = frame.y + Math.floor(((event.clientY - rect.top) / rect.height) * frame.height);
    return cellKey(row, column);
  }
}

/** Exposes the base cell size for the host page's fit calculation. */
export const FLOOR_CELL_SIZE_PX = CELL_SIZE_PX;

/** Re-export so the page can build a cell from keyboard navigation. */
export { cellKey };

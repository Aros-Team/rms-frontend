import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';

import type { AreaActivityValue, AreaResponse } from '@app/shared/models/dto/areas/area';
import type {
  FloorLayout,
  FloorTablePlacement,
} from '@app/shared/models/dto/floor-layout/floor-layout';
import type { TableResponse } from '@app/shared/models/dto/tables/table-response';

import {
  buildCellIndex,
  cellKey,
  contentBounds,
  layoutFromDto,
  mergeCellsByArea,
  regionAtCell,
  shapeForCells,
  type CellKey,
  type EditorLayout,
} from '../../../areas/layout/lib/geometry';

interface TableDrag {
  readonly tableId: number;
  readonly row: number;
  readonly column: number;
  readonly valid: boolean;
}

interface MarkerItem {
  readonly table: TableResponse;
  readonly placement: FloorTablePlacement;
  readonly row: number;
  readonly column: number;
  readonly valid: boolean;
  readonly selected: boolean;
  readonly dragging: boolean;
}

export const TABLE_DRAG_TYPE = 'application/x-rms-table';

/** Read-only area map with draggable table markers. */
@Component({
  selector: 'app-table-floor-board',
  templateUrl: './table-floor-board.html',
  styleUrl: './table-floor-board.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[style.--board-ratio]': 'aspectRatio()',
    '[style.--marker-scale]': 'markerScale()',
  },
})
export class TableFloorBoard {
  private static nextId = 0;

  private readonly layoutState = signal<FloorLayout | null>(null);
  private readonly areasState = signal<readonly AreaResponse[]>([]);
  private readonly tablesState = signal<readonly TableResponse[]>([]);
  private readonly placementsState = signal<readonly FloorTablePlacement[]>([]);
  private readonly selectedState = signal<number | null>(null);
  private readonly disabledState = signal(false);
  private readonly hostWidth = signal(0);
  readonly dragActiveState = signal(false);
  readonly readonlyMode = computed(() => this.disabledState());
  private readonly dragPreview = signal<TableDrag | null>(null);

  @Input({ required: true })
  set layout(value: FloorLayout | null) {
    this.layoutState.set(value);
  }

  get layout(): FloorLayout | null {
    return this.layoutState();
  }

  @Input()
  set areas(value: readonly AreaResponse[]) {
    this.areasState.set(value);
  }

  get areas(): readonly AreaResponse[] {
    return this.areasState();
  }

  @Input()
  set tables(value: readonly TableResponse[]) {
    this.tablesState.set(value);
  }

  get tables(): readonly TableResponse[] {
    return this.tablesState();
  }

  @Input()
  set placements(value: readonly FloorTablePlacement[]) {
    this.placementsState.set(value);
  }

  get placements(): readonly FloorTablePlacement[] {
    return this.placementsState();
  }

  @Input()
  set selectedTableId(value: number | null) {
    this.selectedState.set(value);
  }

  get selectedTableId(): number | null {
    return this.selectedState();
  }

  @Input()
  set disabled(value: boolean) {
    this.disabledState.set(value);
  }

  get disabled(): boolean {
    return this.disabledState();
  }

  @Output() readonly tablePlaced = new EventEmitter<FloorTablePlacement>();
  @Output() readonly tableSelected = new EventEmitter<number | null>();
  @Output() readonly placementError = new EventEmitter<string>();

  @ViewChild('canvas')
  private svgRef?: ElementRef<SVGSVGElement>;

  readonly gridId = `table-floor-grid-${String(TableFloorBoard.nextId++)}`;
  readonly Math = Math;
  readonly dragType = TABLE_DRAG_TYPE;
  private readonly hostRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  private resizeObserver: ResizeObserver | null = null;
  private dragPointerId: number | null = null;
  private dragOffsetColumn = 0;
  private dragOffsetRow = 0;

  constructor() {
    afterNextRender(() => {
      this.observeWidth();
    });
    this.destroyRef.onDestroy(() => this.resizeObserver?.disconnect());
  }

  readonly layoutModel = computed<EditorLayout | null>(() => {
    const layout = this.layoutState();
    return layout === null ? null : layoutFromDto(layout);
  });

  readonly areaById = computed(() => {
    const map = new Map<number, AreaResponse>();
    for (const area of this.areasState()) map.set(area.id, area);
    return map;
  });

  readonly tableById = computed(() => {
    const map = new Map<number, TableResponse>();
    for (const table of this.tablesState()) map.set(table.id, table);
    return map;
  });

  readonly cellIndex = computed(() => {
    const layout = this.layoutModel();
    return layout === null ? new Map<CellKey, string>() : buildCellIndex(layout);
  });

  readonly areaShapes = computed(() => {
    const layout = this.layoutModel();
    if (layout === null) return [];
    const areas = this.areaById();
    return [...mergeCellsByArea(layout).entries()]
      .map(([areaId, cells]) => {
        const area = areas.get(areaId);
        return {
          areaId,
          shape: shapeForCells(cells),
          name: area?.name ?? `Área ${String(areaId)}`,
          servable: this.isServeArea(area),
        };
      })
      .sort((left, right) => left.areaId - right.areaId);
  });

  readonly markers = computed<MarkerItem[]>(() => {
    const tables = this.tableById();
    const preview = this.dragPreview();
    return this.placementsState()
      .flatMap((placement) => {
        const table = tables.get(placement.tableId);
        if (table === undefined) return [];
        const row = preview?.tableId === placement.tableId ? preview.row : placement.row;
        const column =
          preview?.tableId === placement.tableId ? preview.column : placement.column;
        return [{
          table,
          placement,
          row,
          column,
          valid: this.isValidCell(placement.tableId, row, column),
          selected: this.selectedState() === placement.tableId,
          dragging: preview?.tableId === placement.tableId,
        }];
      });
  });

  readonly frame = computed(() => {
    const layout = this.layoutModel();
    if (layout === null) {
      return { viewBox: '0 0 1 1', x: 0, y: 0, width: 1, height: 1 };
    }
    const bounds = contentBounds(layout);
    if (bounds === null) {
      return {
        viewBox: `0 0 ${String(layout.columns)} ${String(layout.rows)}`,
        x: 0,
        y: 0,
        width: layout.columns,
        height: layout.rows,
      };
    }
    let minRow = bounds.minRow;
    let maxRow = bounds.maxRow;
    let minColumn = bounds.minColumn;
    let maxColumn = bounds.maxColumn;
    for (const marker of this.markers()) {
      minRow = Math.min(minRow, marker.row);
      maxRow = Math.max(maxRow, marker.row);
      minColumn = Math.min(minColumn, marker.column);
      maxColumn = Math.max(maxColumn, marker.column);
    }
    const padding = 2;
    const x = minColumn - padding;
    const y = minRow - padding;
    const width = maxColumn - minColumn + 1 + padding * 2;
    const height = maxRow - minRow + 1 + padding * 2;
    return {
      viewBox: `${String(x)} ${String(y)} ${String(width)} ${String(height)}`,
      x,
      y,
      width,
      height,
    };
  });

  readonly isEmpty = computed(() => (this.layoutModel()?.regions.length ?? 0) === 0);

  readonly aspectRatio = computed(() => {
    const frame = this.frame();
    return `${String(frame.width)} / ${String(frame.height)}`;
  });

  /**
   * Keeps table markers finger-sized on small screens without zooming the map.
   * The SVG scales with the layout, so the marker is enlarged in model units.
   */
  readonly markerScale = computed(() => {
    if (!this.readonlyMode()) return 1;
    const width = this.hostWidth();
    const frame = this.frame();
    if (width <= 0 || frame.width <= 0) return 1;
    const cellPx = width / frame.width;
    return Math.max(1, 34 / (cellPx * 0.76));
  });

  onDragOver(event: DragEvent): void {
    if (this.disabledState() || this.layoutModel() === null) return;
    event.preventDefault();
    if (event.dataTransfer !== null) event.dataTransfer.dropEffect = 'move';
    this.setDragActive(true);
  }

  onDragLeave(event: DragEvent): void {
    const current = event.currentTarget as HTMLElement | null;
    const next = event.relatedTarget as Node | null;
    if (current !== null && next !== null && current.contains(next)) return;
    this.setDragActive(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.setDragActive(false);
    const custom = event.dataTransfer?.getData(TABLE_DRAG_TYPE) ?? '';
    const plain = event.dataTransfer?.getData('text/plain') ?? '';
    const raw = custom !== '' ? custom : plain;
    const tableId = raw === '' ? null : Number(raw);
    if (tableId === null || !Number.isInteger(tableId)) return;
    const cell = this.cellFromClient(event.clientX, event.clientY);
    if (cell === null) {
      this.placementError.emit('Suelta la mesa dentro de un área de atención al cliente.');
      return;
    }
    if (!this.isValidCell(tableId, cell.row, cell.column)) {
      this.placementError.emit('La mesa solo puede ubicarse en un área habilitada de atención al cliente.');
      return;
    }
    this.tablePlaced.emit({ tableId, row: cell.row, column: cell.column });
  }

  onMarkerPointerDown(event: PointerEvent, item: MarkerItem): void {
    event.preventDefault();
    event.stopPropagation();
    this.tableSelected.emit(item.table.id);
    if (this.disabledState()) return;
    this.svgRef?.nativeElement.setPointerCapture(event.pointerId);
    this.dragPointerId = event.pointerId;
    const local = this.localPoint(event.clientX, event.clientY);
    this.dragOffsetColumn = local === null ? 0 : local.x - (item.column + 0.5);
    this.dragOffsetRow = local === null ? 0 : local.y - (item.row + 0.5);
    this.dragPreview.set({
      tableId: item.table.id,
      row: item.row,
      column: item.column,
      valid: true,
    });
  }

  onMarkerPointerMove(event: PointerEvent): void {
    if (this.dragPointerId !== event.pointerId) return;
    const local = this.localPoint(event.clientX, event.clientY);
    const preview = this.dragPreview();
    if (local === null || preview === null) return;
    const row = Math.floor(local.y - this.dragOffsetRow);
    const column = Math.floor(local.x - this.dragOffsetColumn);
    this.dragPreview.set({
      ...preview,
      row,
      column,
      valid: this.isValidCell(preview.tableId, row, column),
    });
  }

  onMarkerPointerUp(event: PointerEvent): void {
    if (this.dragPointerId !== event.pointerId) return;
    this.svgRef?.nativeElement.releasePointerCapture(event.pointerId);
    this.dragPointerId = null;
    const preview = this.dragPreview();
    this.dragPreview.set(null);
    if (preview === null) return;
    if (!preview.valid) {
      this.placementError.emit('La mesa solo puede ubicarse en un área habilitada de atención al cliente.');
      return;
    }
    this.tablePlaced.emit({
      tableId: preview.tableId,
      row: preview.row,
      column: preview.column,
    });
  }

  onMarkerPointerCancel(event: PointerEvent): void {
    if (this.dragPointerId !== event.pointerId) return;
    this.dragPointerId = null;
    this.dragPreview.set(null);
  }

  markerLabel(item: MarkerItem): string {
    return `Mesa ${String(item.table.tableNumber)}, ${String(item.table.capacity)} personas`;
  }

  markerX(item: MarkerItem): number {
    return item.column + 0.5;
  }

  markerY(item: MarkerItem): number {
    return item.row + 0.5;
  }

  private isValidCell(tableId: number, row: number, column: number): boolean {
    const layout = this.layoutModel();
    if (layout === null) return false;
    const cell = cellKey(row, column);
    const region = regionAtCell(layout, this.cellIndex(), cell);
    if (region === undefined) return false;
    const area = this.areaById().get(region.areaId);
    if (!this.isServeArea(area)) return false;
    const occupied = this.placementsState().some(
      (placement) =>
        placement.tableId !== tableId
        && placement.row === row
        && placement.column === column,
    );
    return !occupied;
  }

  private isServeArea(area: AreaResponse | undefined): boolean {
    if (!area?.enabled) return false;
    const activities: readonly AreaActivityValue[] = area.activities;
    return activities.includes('SERVE');
  }

  private setDragActive(active: boolean): void {
    if (this.dragActiveState() === active) return;
    this.dragActiveState.set(active);
  }

  private observeWidth(): void {
    if (typeof ResizeObserver === 'undefined') return;
    const element = this.hostRef.nativeElement;
    this.resizeObserver = new ResizeObserver((entries) => {
      this.hostWidth.set(entries[0]?.contentRect.width ?? 0);
    });
    this.resizeObserver.observe(element);
    this.hostWidth.set(element.getBoundingClientRect().width);
  }

  private cellFromClient(
    clientX: number,
    clientY: number,
  ): { row: number; column: number } | null {
    const local = this.localPoint(clientX, clientY);
    if (local === null) return null;
    const row = Math.floor(local.y);
    const column = Math.floor(local.x);
    return { row, column };
  }

  private localPoint(clientX: number, clientY: number): { x: number; y: number } | null {
    const svg = this.svgRef?.nativeElement;
    if (svg === undefined) return null;
    const matrix = svg.getScreenCTM();
    if (matrix === null) return null;
    const point = svg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    const local = point.matrixTransform(matrix.inverse());
    return { x: local.x, y: local.y };
  }
}

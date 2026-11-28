import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  OnInit,
  Output,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin } from 'rxjs';

import { Area } from '@app/core/services/areas/area';
import { FloorLayoutApi } from '@app/core/services/floor-layout/floor-layout';
import type { AreaResponse } from '@app/shared/models/dto/areas/area';
import type { FloorLayout as FloorLayoutDto } from '@app/shared/models/dto/floor-layout/floor-layout';
import { extractProblemDetail } from '@app/shared/lib/problem-detail/problem-detail';
import { RmsButton } from '@app/shared/ui/button/button';
import { RmsEmptyState } from '@app/shared/ui/empty-state/empty-state';
import { RmsSkeleton } from '@app/shared/ui/skeleton/skeleton';
import { RmsStatusPill } from '@app/shared/ui/status-pill/status-pill';

import { AreaPalette } from './components/area-palette/area-palette';
import { LayoutCanvas } from './components/layout-canvas/layout-canvas';
import { LayoutToolbar } from './components/layout-toolbar/layout-toolbar';
import { FloorLayoutEditorEngine } from './lib/editor-engine';
import type { EditorTool } from './lib/editor-types';
import {
  FLOOR_DEFAULT_COLUMNS,
  FLOOR_DEFAULT_ROWS,
  layoutFromDto,
  layoutToDto,
  validateLayout,
  type CellKey,
  type EditorLayout,
} from './lib/geometry';

type DiscardAction = 'close' | 'reset' | null;

const EMPTY_LAYOUT: EditorLayout = {
  columns: FLOOR_DEFAULT_COLUMNS,
  rows: FLOOR_DEFAULT_ROWS,
  regions: [],
};

const MIN_ZOOM = 0.4;
const MAX_ZOOM = 2;
const ZOOM_STEP = 0.1;

/**
 * Floor layout editor page.
 *
 * I/O, tools and dialogs live here; legal layout transitions, geometry and
 * history live in the framework-agnostic engine and pure helpers.
 */
@Component({
  selector: 'app-floor-layout',
  templateUrl: './floor-layout.html',
  styleUrl: './floor-layout.css',
  imports: [
    AreaPalette,
    LayoutCanvas,
    LayoutToolbar,
    RmsButton,
    RmsEmptyState,
    RmsSkeleton,
    RmsStatusPill,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FloorLayout implements OnInit {
  private readonly api = inject(FloorLayoutApi);
  private readonly areaService = inject(Area);

  @Output() readonly closed = new EventEmitter<void>();

  private engine: FloorLayoutEditorEngine | null = null;
  private pendingDiscardAction: DiscardAction = null;
  private readonly wide =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(min-width: 1024px)').matches;

  readonly panelOpen = signal(this.wide);

  private readonly editorCanvas = viewChild<LayoutCanvas>('editorCanvas');
  private readonly confirmRef = viewChild<ElementRef<HTMLElement>>('confirmCard');

  readonly areas = signal<readonly AreaResponse[]>([]);
  readonly layout = signal<EditorLayout>(EMPTY_LAYOUT);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly forbidden = signal(false);
  readonly saving = signal(false);
  readonly dirty = signal(false);
  readonly canUndo = signal(false);
  readonly canRedo = signal(false);
  readonly selectedAreaId = signal<number | null>(null);
  readonly tool = signal<EditorTool>('draw');
  readonly zoom = signal(1);
  readonly savedAt = signal<string | null>(null);
  readonly statusMessage = signal('');

  readonly discardVisible = signal(false);

  readonly areaById = computed(() => {
    const map = new Map<number, AreaResponse>();
    for (const area of this.areas()) {
      map.set(area.id, area);
    }
    return map;
  });

  readonly selectedArea = computed(() => {
    const id = this.selectedAreaId();
    return id === null ? null : (this.areaById().get(id) ?? null);
  });

  readonly regionCounts = computed(() => {
    const counts = new Map<number, number>();
    for (const region of this.layout().regions) {
      counts.set(region.areaId, (counts.get(region.areaId) ?? 0) + 1);
    }
    return counts;
  });

  readonly statusLabel = computed(() => {
    if (this.saving()) return 'Guardando…';
    if (this.dirty()) return 'Cambios sin guardar';
    if (this.savedAt() !== null) return this.savedLabel();
    return 'Sin guardar';
  });

  readonly statusTone = computed<'info' | 'warning' | 'success' | 'neutral'>(() => {
    if (this.saving()) return 'info';
    if (this.dirty()) return 'warning';
    return this.savedAt() !== null ? 'success' : 'neutral';
  });

  readonly savedLabel = computed(() => {
    const value = this.savedAt();
    if (value === null) return 'Guardado';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Guardado';
    return `Guardado ${new Intl.DateTimeFormat('es-CO', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)}`;
  });

  readonly canSave = computed(() => this.dirty() && !this.saving());

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.forbidden.set(false);

    forkJoin({
      areas: this.areaService.getAreas(),
      layout: this.api.getLayout(),
    }).subscribe({
      next: ({ areas, layout }) => {
        this.areas.set(areas);
        this.installLayout(layout);
        this.selectedAreaId.set(areas[0]?.id ?? null);
        this.tool.set('draw');
        this.loading.set(false);
        this.zoom.set(1);
      },
      error: (error: unknown) => {
        this.forbidden.set(error instanceof HttpErrorResponse && error.status === 403);
        this.loadError.set(this.problem(error, 'No se pudo cargar la distribución.'));
        this.loading.set(false);
      },
    });
  }

  save(): void {
    if (this.engine === null || this.saving() || !this.dirty()) return;

    const validation = validateLayout(this.layout());
    if (validation !== null) {
      this.announce(validation);
      return;
    }

    this.saving.set(true);
    this.api.updateLayout(layoutToDto(this.layout())).subscribe({
      next: (saved) => {
        this.engine?.markSaved(layoutFromDto(saved));
        this.savedAt.set(saved.updatedAt ?? new Date().toISOString());
        this.syncFromEngine();
        this.saving.set(false);
        this.announce('Distribución guardada.');
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.announce(this.problem(error, 'No se pudo guardar la distribución.'));
      },
    });
  }

  requestDiscard(): void {
    if (!this.dirty() || this.engine === null || this.saving()) return;
    this.pendingDiscardAction = 'reset';
    this.openDiscard();
  }

  /** Closes the modal; asks first when there are unsaved changes. */
  requestClose(): void {
    if (this.saving()) return;
    if (!this.dirty()) {
      this.closed.emit();
      return;
    }
    this.pendingDiscardAction = 'close';
    this.openDiscard();
  }

  acceptDiscard(): void {
    const action = this.pendingDiscardAction;
    this.pendingDiscardAction = null;
    this.discardVisible.set(false);
    if (action === 'reset') {
      this.engine?.resetToSaved();
      this.syncFromEngine();
      this.announce('Cambios descartados.');
    } else if (action === 'close') {
      this.closed.emit();
    }
  }

  cancelDiscard(): void {
    this.pendingDiscardAction = null;
    this.discardVisible.set(false);
  }

  private openDiscard(): void {
    this.discardVisible.set(true);
    setTimeout(() => {
      this.confirmRef()?.nativeElement.focus();
    }, 0);
  }

  selectArea(areaId: number | null): void {
    this.selectedAreaId.set(areaId);
  }

  removeSelectedArea(): void {
    const areaId = this.selectedAreaId();
    if (areaId === null) return;
    if (this.engine?.deleteArea(areaId) === true) {
      this.syncFromEngine();
      this.announce('Área quitada del mapa. Puedes deshacerlo.');
    }
  }

  setTool(tool: EditorTool): void {
    this.tool.set(tool);
  }

  onStrokeStart(): void {
    this.engine?.beginStroke();
  }

  onStrokeEnd(): void {
    this.engine?.commitStroke();
    this.syncFromEngine();
  }

  onPaintCells(cells: readonly CellKey[]): void {
    if (this.engine === null) return;
    const result = this.engine.paintCells(this.selectedAreaId(), cells);
    if (result.reason === 'no-area') {
      this.announce('Selecciona un área antes de dibujar.');
    } else if (result.reason === 'owned-by-other') {
      const owner =
        result.conflictAreaId === null
          ? 'otra área'
          : (this.areaById().get(result.conflictAreaId)?.name ?? 'otra área');
      this.announce(`Esa zona ya pertenece al área ${owner}.`);
    }
    this.syncFromEngine();
  }

  onEraseCells(cells: readonly CellKey[]): void {
    if (this.engine === null) return;
    const result = this.engine.eraseCells(cells);
    if (result.changed) this.syncFromEngine();
  }

  onMissingArea(): void {
    this.announce('Selecciona un área antes de dibujar.');
  }

  onPanelToggle(event: Event): void {
    const details = event.target as HTMLDetailsElement | null;
    if (details !== null) this.panelOpen.set(details.open);
  }

  undo(): void {
    if (this.engine?.undo() === true) {
      this.syncFromEngine();
      requestAnimationFrame(() => {
        this.editorCanvas()?.center();
      });
      this.announce('Acción deshecha.');
    }
  }

  redo(): void {
    if (this.engine?.redo() === true) {
      this.syncFromEngine();
      requestAnimationFrame(() => {
        this.editorCanvas()?.center();
      });
      this.announce('Acción rehecha.');
    }
  }

  zoomIn(): void {
    this.setZoom(this.zoom() + ZOOM_STEP);
  }

  zoomOut(): void {
    this.setZoom(this.zoom() - ZOOM_STEP);
  }

  onWheel(event: WheelEvent): void {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    this.setZoom(this.zoom() + (event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP));
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (!this.dirty()) return;
    event.preventDefault();
  }

  @HostListener('window:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    if (
      target !== null &&
      (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable)
    ) {
      return;
    }
    if (this.discardVisible()) return;

    const modifier = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();

    if (modifier && key === 's') {
      event.preventDefault();
      this.save();
      return;
    }
    if (modifier && key === 'z' && !event.shiftKey) {
      event.preventDefault();
      this.undo();
      return;
    }
    if (modifier && (key === 'y' || (key === 'z' && event.shiftKey))) {
      event.preventDefault();
      this.redo();
      return;
    }
    if (modifier) return;

    if (key === 'b') {
      this.setTool('draw');
      return;
    }
    if (key === 'e') {
      this.setTool('erase');
      return;
    }
    if (key === 'm') {
      this.setTool('pan');
      return;
    }
    if (event.key === 'Escape') {
      this.selectedAreaId.set(null);
      return;
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      const areaId = this.selectedAreaId();
      if (areaId !== null) {
        event.preventDefault();
        this.engine?.deleteArea(areaId);
        this.syncFromEngine();
        this.announce('Área quitada del mapa. Puedes deshacerlo.');
      }
      return;
    }
  }

  private setZoom(value: number): void {
    const rounded = Math.round(value * 100) / 100;
    this.zoom.set(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, rounded)));
  }

  private installLayout(dto: FloorLayoutDto): void {
    const layout = layoutFromDto(dto);
    this.engine = new FloorLayoutEditorEngine(layout, layout);
    this.savedAt.set(dto.updatedAt ?? null);
    this.syncFromEngine();
  }

  private syncFromEngine(): void {
    const engine = this.engine;
    if (engine === null) return;
    this.layout.set(engine.layout);
    this.dirty.set(engine.isDirty());
    this.canUndo.set(engine.canUndo);
    this.canRedo.set(engine.canRedo);
  }

  private announce(message: string): void {
    this.statusMessage.set('');
    this.statusMessage.set(message);
  }

  private problem(error: unknown, fallback: string): string {
    return extractProblemDetail(error) ?? fallback;
  }
}

import { Component, inject, OnInit, signal, computed, ChangeDetectionStrategy, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Table } from '@app/core/services/tables/table';
import { MessageService } from 'primeng/api';
import { TableResponse } from '@app/shared/models/dto/tables/table-response';
import { FloorLayoutApi } from '@app/core/services/floor-layout/floor-layout';
import type { FloorLayout, FloorTablePlacement } from '@app/shared/models/dto/floor-layout/floor-layout';
import { extractProblemDetail } from '@app/shared/lib/problem-detail/problem-detail';
import { buildCellIndex, cellKey, layoutFromDto, regionAtCell } from '../areas/layout/lib/geometry';
import { TableFloorBoard, TABLE_DRAG_TYPE } from './components/table-floor-board/table-floor-board';
import { TablesCache } from './tables-cache';
import { LazyLoad } from '@app/core/directives/lazy-load/lazy-load.directive';
import { WebSocket } from '@app/core/services/websocket/websocket';
import { Auth } from '@app/core/services/auth/auth';
import { environment } from '@environments/environment';
import { forkJoin } from 'rxjs';
import { RmsButton } from '@app/shared/ui/button/button';
import { RmsDialog } from '@app/shared/ui/dialog/dialog';
import { RmsInput } from '@app/shared/ui/input/input';
import { RmsPageHeader } from '@app/shared/ui/page-header/page-header';
import { RmsStatusPill } from '@app/shared/ui/status-pill/status-pill';
import { RmsSkeleton } from '@app/shared/ui/skeleton/skeleton';

const WS_TOPICS = {
  tableStatus: '/topic/tables/status',
} as const;

@Component({
  selector: 'app-tables',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    LazyLoad,
    RmsButton,
    RmsDialog,
    RmsInput,
    RmsPageHeader,
    RmsStatusPill,
    RmsSkeleton,
    TableFloorBoard,
  ],
  templateUrl: './tables.html',
  styleUrl: './tables.css',
})
export class Tables implements OnInit {
  private tableService = inject(Table);
  private readonly floorLayoutApi = inject(FloorLayoutApi);
  private messageService = inject(MessageService);
  private wsService = inject(WebSocket);
  private authService = inject(Auth);
  private destroyRef = inject(DestroyRef);
  readonly cache = inject(TablesCache);

  title = 'Gestión de Mesas';

  tables = computed(() => this.cache.tables.data() ?? []);
  areas = computed(() => this.cache.areas.data() ?? []);
  loading = computed(() => this.cache.tables.isLoading());

  readonly floorLayout = signal<FloorLayout | null>(null);
  readonly placements = signal<readonly FloorTablePlacement[]>([]);
  readonly floorLoading = signal(true);
  readonly floorError = signal<string | null>(null);
  readonly savingPlacements = signal(false);
  readonly selectedFloorTableId = signal<number | null>(null);
  readonly draggingTableId = signal<number | null>(null);
  readonly clearAllVisible = signal(false);
  private dragGhost: HTMLElement | null = null;
  readonly dragType = TABLE_DRAG_TYPE;

  readonly layoutModel = computed(() => {
    const layout = this.floorLayout();
    return layout === null ? null : layoutFromDto(layout);
  });

  readonly placementByTable = computed(() => {
    const map = new Map<number, FloorTablePlacement>();
    for (const placement of this.placements()) map.set(placement.tableId, placement);
    return map;
  });

  readonly placementAreas = computed(() => {
    const layout = this.layoutModel();
    const map = new Map<number, string>();
    if (layout === null) return map;
    const index = buildCellIndex(layout);
    const areas = new Map(this.areas().map((area) => [area.id, area.name]));
    for (const placement of this.placements()) {
      const region = regionAtCell(
        layout,
        index,
        cellKey(placement.row, placement.column),
      );
      if (region !== undefined) {
        const name = areas.get(region.areaId);
        if (name !== undefined) map.set(placement.tableId, name);
      }
    }
    return map;
  });

  modalIsOpen = signal(false);
  modalMode = signal<'edit' | 'create'>('create');

  selectedTableId: number | null = null;

  tableForm = new FormGroup({
    id: new FormControl<number | null>(null),
    tableNumber: new FormControl<number | null>(null, {
      nonNullable: false,
      validators: [(control) => Validators.required(control), Validators.min(1)],
    }),
    capacity: new FormControl<number | null>(null, {
      nonNullable: false,
      validators: [(control) => Validators.required(control), Validators.min(1)],
    }),
  });

  ngOnInit(): void {
    if (this.cache.tables.data() === null) {
      this.cache.tables.refresh();
    }
    this.cache.areas.loadIfStale();
    this.connectWebSocket();
    this.loadFloor();
  }

  onVisible(): void {
    this.cache.tables.loadIfStale();
    this.cache.areas.loadIfStale();
    this.loadFloor();
  }

  loadTables(): void {
    this.cache.tables.refresh();
  }

  showCreationModal(): void {
    this.tableForm.reset();
    // Auto-suggest next table number
    const existingNumbers = this.tables().map(t => t.tableNumber);
    const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
    this.tableForm.patchValue({ tableNumber: nextNumber, capacity: null });
    this.modalMode.set('create');
    this.modalIsOpen.set(true);
  }

  showEditModal(table: TableResponse): void {
    this.tableForm.patchValue({
      id: table.id,
      tableNumber: table.tableNumber,
      capacity: table.capacity,
    });
    this.selectedTableId = table.id;
    this.modalMode.set('edit');
    this.modalIsOpen.set(true);
  }

  closeModal(): void {
    this.selectedTableId = null;
    this.modalIsOpen.set(false);
  }

  /** Keeps the dialog primitive's `visibleChange` mirrored into the page state. */
  onEditDialogVisible(visible: boolean): void {
    if (visible) {
      this.modalIsOpen.set(true);
      return;
    }
    this.closeModal();
  }

  saveTable(): void {
    if (this.tableForm.invalid) return;

    const formData = this.tableForm.value;
    const tableNumber = formData.tableNumber ?? 0;
    const capacity = formData.capacity ?? 0;

    if (this.modalMode() === 'create') {
      this.tableService.createTable({ tableNumber, capacity }).subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: 'Éxito',
            detail: 'Mesa creada exitosamente',
            life: 3000,
          });
          this.loadTables();
          this.closeModal();
        },
        error: () => {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'No se pudo crear la mesa',
            life: 3000,
          });
        },
      });
    } else {
      const id = formData.id ?? 0;
      this.tableService.updateTable(id, { tableNumber, capacity }).subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: 'Éxito',
            detail: 'Mesa actualizada exitosamente',
            life: 3000,
          });
          this.loadTables();
          this.closeModal();
        },
        error: () => {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'No se pudo actualizar la mesa',
            life: 3000,
          });
        },
      });
    }
  }

  changeTableStatus(table: TableResponse, newStatus: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED'): void {
    this.tableService.changeStatus(table.id, newStatus).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Éxito',
          detail: 'Estado de mesa actualizado',
          life: 3000,
        });
        this.loadTables();
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo cambiar el estado',
          life: 3000,
        });
      },
    });
  }

  loadFloor(): void {
    this.floorLoading.set(true);
    this.floorError.set(null);
    forkJoin({
      layout: this.floorLayoutApi.getLayout(),
      placements: this.floorLayoutApi.getTablePlacements(),
    }).subscribe({
      next: ({ layout, placements }) => {
        this.floorLayout.set(layout);
        this.placements.set(placements);
        this.floorLoading.set(false);
      },
      error: (error: unknown) => {
        this.floorError.set(
          extractProblemDetail(error) ?? 'No se pudo cargar la distribución.',
        );
        this.floorLoading.set(false);
      },
    });
  }

  onFloorTablePlaced(placement: FloorTablePlacement): void {
    this.persistPlacements(this.mergePlacement(this.placements(), placement));
  }

  onFloorTableSelected(tableId: number | null): void {
    this.selectedFloorTableId.set(tableId);
  }

  onFloorPlacementError(message: string): void {
    this.messageService.add({
      severity: 'warn',
      summary: 'Ubicación no válida',
      detail: message,
      life: 4000,
    });
  }

  removeTablePlacement(tableId: number): void {
    this.persistPlacements(this.placements().filter((item) => item.tableId !== tableId));
  }

  requestClearAllPlacements(): void {
    if (this.placements().length === 0 || this.savingPlacements()) return;
    this.clearAllVisible.set(true);
  }

  confirmClearAllPlacements(): void {
    this.clearAllVisible.set(false);
    this.selectedFloorTableId.set(null);
    this.persistPlacements([]);
  }

  cancelClearAllPlacements(): void {
    this.clearAllVisible.set(false);
  }

  onClearAllVisible(visible: boolean): void {
    if (!visible) this.cancelClearAllPlacements();
  }

  placedAreaName(tableId: number): string | null {
    return this.placementAreas().get(tableId) ?? null;
  }

  onTableDragStart(event: DragEvent, table: TableResponse): void {
    const target = event.target as HTMLElement | null;
    if (target !== null && target.closest('button, a') !== null) {
      event.preventDefault();
      return;
    }
    if (this.savingPlacements()) {
      event.preventDefault();
      return;
    }
    event.dataTransfer?.setData(TABLE_DRAG_TYPE, String(table.id));
    event.dataTransfer?.setData('text/plain', String(table.id));
    if (event.dataTransfer !== null) {
      event.dataTransfer.effectAllowed = 'move';
      this.setDragGhost(event.dataTransfer, table);
    }
    this.draggingTableId.set(table.id);
    this.selectedFloorTableId.set(table.id);
  }

  onTableDragEnd(): void {
    this.draggingTableId.set(null);
    this.clearDragGhost();
  }

  onTileRemove(event: Event, tableId: number): void {
    event.stopPropagation();
    this.removeTablePlacement(tableId);
  }

  private setDragGhost(dataTransfer: DataTransfer, table: TableResponse): void {
    this.clearDragGhost();
    const ghost = document.createElement('div');
    ghost.textContent = String(table.tableNumber);
    ghost.setAttribute('aria-hidden', 'true');
    Object.assign(ghost.style, {
      position: 'fixed',
      top: '-1000px',
      left: '-1000px',
      width: '1.6rem',
      height: '1.6rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxSizing: 'border-box',
      borderRadius: '0.5rem',
      border: '2px solid var(--rms-border-strong)',
      background: 'var(--rms-bg-surface)',
      color: 'var(--rms-text)',
      fontFamily: 'var(--rms-font-sans)',
      fontSize: '0.8rem',
      fontWeight: '600',
    });
    document.body.appendChild(ghost);
    dataTransfer.setDragImage(ghost, 13, 13);
    this.dragGhost = ghost;
  }

  private clearDragGhost(): void {
    this.dragGhost?.remove();
    this.dragGhost = null;
  }

  private mergePlacement(
    current: readonly FloorTablePlacement[],
    placement: FloorTablePlacement,
  ): FloorTablePlacement[] {
    return [
      ...current.filter((item) => item.tableId !== placement.tableId),
      placement,
    ].sort((left, right) => left.tableId - right.tableId);
  }

  private persistPlacements(next: readonly FloorTablePlacement[]): void {
    if (this.savingPlacements()) return;
    const previous = this.placements();
    this.placements.set(next);
    this.savingPlacements.set(true);
    this.floorLayoutApi.updateTablePlacements(next).subscribe({
      next: (saved) => {
        this.placements.set(saved);
        this.savingPlacements.set(false);
      },
      error: (error: unknown) => {
        this.placements.set(previous);
        this.savingPlacements.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'No se pudo guardar la ubicación',
          detail:
            extractProblemDetail(error)
            ?? 'Revisa que la mesa esté dentro de un área de atención al cliente.',
          life: 6000,
        });
      },
    });
  }

  getStatusSeverity(status: string): 'success' | 'warn' | 'info' | 'secondary' | 'danger' | 'contrast' | undefined {
    switch (status) {
      case 'AVAILABLE':
        return 'success';
      case 'OCCUPIED':
        return 'warn';
      case 'RESERVED':
        return 'info';
      case 'INACTIVE':
        return 'secondary';
      default:
        return 'secondary';
    }
  }

  getStatusTone(status: string): 'success' | 'warning' | 'info' | 'neutral' {
    switch (status) {
      case 'AVAILABLE':
        return 'success';
      case 'OCCUPIED':
        return 'info';
      case 'RESERVED':
        return 'warning';
      default:
        return 'neutral';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'AVAILABLE':
        return 'Disponible';
      case 'OCCUPIED':
        return 'Ocupada';
      case 'RESERVED':
        return 'Reservada';
      default:
        return status;
    }
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  private connectWebSocket(): void {
    const token = this.authService.getToken();
    if (!token) return;

    this.wsService.connect(environment.wsUrl, token);

    // TablesCache already patches the cache; subscribing here is only
    // needed so the component re-renders when the computed() signal changes.
    // The actual data update is handled centrally in TablesCache.
    this.wsService
      .subscribeToTopic<TableResponse>(WS_TOPICS.tableStatus)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((updated) => {
        // Cache is already patched by TablesCache constructor subscription.
        // This subscription ensures the component's computed() re-evaluates
        // and Angular's OnPush CD picks up the change.
        this.cache.applyTableUpdate(updated);
      });
  }
}

import { Component, inject, OnInit, signal, computed, ChangeDetectionStrategy, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { RouterModule } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { TableModule } from 'primeng/table';
import { IftaLabelModule } from 'primeng/iftalabel';
import { DialogModule } from 'primeng/dialog';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { Table } from '@app/core/services/tables/table';
import { MessageService } from 'primeng/api';
import { TableResponse } from '@app/shared/models/dto/tables/table-response.model';
import { TablesCacheService } from './tables-cache.service';
import { LazyLoadDirective } from '@app/core/directives/lazy-load.directive';
import { WebSocket } from '@app/core/services/websocket/websocket';
import { Auth } from '@app/core/services/auth/auth';
import { environment } from '@environments/environment';

const WS_TOPICS = {
  tableStatus: '/topic/tables/status',
} as const;

@Component({
  selector: 'app-tables',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterModule,
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    InputNumberModule,
    TableModule,
    IftaLabelModule,
    DialogModule,
    TagModule,
    SkeletonModule,
    IconFieldModule,
    InputIconModule,
    LazyLoadDirective,
  ],
  templateUrl: './tables.html',
})
export class Tables implements OnInit {
  private tableService = inject(Table);
  private messageService = inject(MessageService);
  private wsService = inject(WebSocket);
  private authService = inject(Auth);
  private destroyRef = inject(DestroyRef);
  readonly cache = inject(TablesCacheService);

  title = 'Gestión de Mesas';
  description = 'Configura las mesas del restaurante';

  tables = computed(() => this.cache.tables.data() ?? []);
  loading = computed(() => this.cache.tables.isLoading());

  modalIsOpen = signal(false);
  modalMode = signal<'edit' | 'create'>('create');

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
    // Force load on first visit if no data
    if (this.cache.tables.data() === null) {
      this.cache.tables.refresh();
    }
    this.connectWebSocket();
  }

  onVisible(): void {
    this.cache.tables.loadIfStale();
  }

  loadTables(): void {
    this.cache.tables.refresh();
  }

  showCreationModal(): void {
    this.tableForm.reset();
    this.modalMode.set('create');
    this.modalIsOpen.set(true);
  }

  showEditModal(table: TableResponse): void {
    this.tableForm.patchValue({
      id: table.id,
      tableNumber: table.tableNumber,
      capacity: table.capacity,
    });
    this.modalMode.set('edit');
    this.modalIsOpen.set(true);
  }

  closeModal(): void {
    this.modalIsOpen.set(false);
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

    // TablesCacheService already patches the cache; subscribing here is only
    // needed so the component re-renders when the computed() signal changes.
    // The actual data update is handled centrally in TablesCacheService.
    this.wsService
      .subscribeToTopic<TableResponse>(WS_TOPICS.tableStatus)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((updated) => {
        // Cache is already patched by TablesCacheService constructor subscription.
        // This subscription ensures the component's computed() re-evaluates
        // and Angular's OnPush CD picks up the change.
        this.cache.applyTableUpdate(updated);
      });
  }
}

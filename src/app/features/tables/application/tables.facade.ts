import { Injectable, signal, computed, inject } from '@angular/core';
import { Table, TableStatus } from '../../../core/tables/domain/models/table.model';
import { ChangeStatusRequest } from '../../../core/tables/domain/models/table-request.model';
import { GetTablesUseCase } from '../../../core/tables/application/use-cases/get-tables.use-case';
import { ChangeTableStatusUseCase } from '../../../core/tables/application/use-cases/change-table-status.use-case';

@Injectable({ providedIn: 'root' })
export class TablesFacade {
  private getTablesUseCase = inject(GetTablesUseCase);
  private changeTableStatusUseCase = inject(ChangeTableStatusUseCase);

  // Signals para estado
  private _tables = signal<Table[]>([]);
  private _isLoading = signal<boolean>(false);
  private _error = signal<string | null>(null);

  // Computed signals
  readonly tables = this._tables.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();

  readonly availableTables = computed(() => 
    this._tables().filter(t => t.status === 'AVAILABLE')
  );

  readonly occupiedTables = computed(() => 
    this._tables().filter(t => t.status === 'OCCUPIED')
  );

  readonly reservedTables = computed(() => 
    this._tables().filter(t => t.status === 'RESERVED')
  );

  loadTables(): void {
    this._isLoading.set(true);
    this._error.set(null);

    this.getTablesUseCase.execute().subscribe({
      next: (tables) => {
        this._tables.set(tables);
        this._isLoading.set(false);
      },
      error: (err) => {
        this._error.set('Error al cargar las mesas');
        this._isLoading.set(false);
      }
    });
  }

  changeStatus(id: number, status: TableStatus): void {
    this._isLoading.set(true);
    const payload: ChangeStatusRequest = { status };

    this.changeTableStatusUseCase.execute(id, payload).subscribe({
      next: (updatedTable) => {
        this._tables.update(tables => 
          tables.map(t => t.id === id ? updatedTable : t)
        );
        this._isLoading.set(false);
      },
      error: (err) => {
        this._error.set('Error al cambiar el estado de la mesa');
        this._isLoading.set(false);
      }
    });
  }
}
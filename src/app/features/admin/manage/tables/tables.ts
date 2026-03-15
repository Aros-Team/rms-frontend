import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { TableModule } from 'primeng/table';
import { IftaLabelModule } from 'primeng/iftalabel';
import { DialogModule } from 'primeng/dialog';
import { TableService } from '@app/core/services/tables/table-service';
import { MessageService } from 'primeng/api';
import { TableResponse } from '@app/shared/models/dto/tables/table.model';

@Component({
  selector: 'app-tables',
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    InputNumberModule,
    TableModule,
    IftaLabelModule,
    DialogModule,
  ],
  templateUrl: './tables.html',
  styles: ``
})
export class Tables implements OnInit {
  private tableService = inject(TableService);
  private messageService = inject(MessageService);

  title = 'Gestión de Mesas';
  description = 'Configura las mesas del restaurante';

  tables: TableResponse[] = [];
  loading = false;

  modalIsOpen = false;
  modalMode: 'edit' | 'create' = 'create';

  tableForm = new FormGroup({
    id: new FormControl<number | null>(null),
    tableNumber: new FormControl<number | null>(null, { nonNullable: false, validators: [Validators.required, Validators.min(1)] }),
    capacity: new FormControl<number | null>(null, { nonNullable: false, validators: [Validators.required, Validators.min(1)] }),
  });

  ngOnInit(): void {
    this.loadTables();
  }

  loadTables(): void {
    this.loading = true;
    this.tableService.getTables().subscribe({
      next: (tables) => {
        this.tables = tables;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading tables:', err);
        this.loading = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudieron cargar las mesas',
          life: 3000,
        });
      }
    });
  }

  showCreationModal(): void {
    this.tableForm.reset();
    this.modalMode = 'create';
    this.modalIsOpen = true;
  }

  showEditModal(table: TableResponse): void {
    this.tableForm.patchValue({
      id: table.id,
      tableNumber: table.tableNumber,
      capacity: table.capacity
    });
    this.modalMode = 'edit';
    this.modalIsOpen = true;
  }

  closeModal(): void {
    this.modalIsOpen = false;
  }

  saveTable(): void {
    if (this.tableForm.valid) {
      const formData = this.tableForm.value;
      const tableNumber = formData.tableNumber ?? 0;
      const capacity = formData.capacity ?? 0;
      
      if (this.modalMode === 'create') {
        this.tableService.createTable({
          tableNumber,
          capacity
        }).subscribe({
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
          error: (err) => {
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: 'No se pudo crear la mesa',
              life: 3000,
            });
          }
        });
      } else {
        const id = formData.id ?? 0;
        this.tableService.updateTable(id, {
          tableNumber,
          capacity
        }).subscribe({
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
          error: (err) => {
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: 'No se pudo actualizar la mesa',
              life: 3000,
            });
          }
        });
      }
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
      error: (err) => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo cambiar el estado',
          life: 3000,
        });
      }
    });
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'AVAILABLE': return 'bg-green-100 text-green-800';
      case 'OCCUPIED': return 'bg-red-100 text-red-800';
      case 'RESERVED': return 'bg-yellow-100 text-yellow-800';
      default: return '';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'AVAILABLE': return 'Disponible';
      case 'OCCUPIED': return 'Ocupada';
      case 'RESERVED': return 'Reservada';
      default: return status;
    }
  }
}

import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TablesFacade } from '../../application/tables.facade';
import { Table, TableStatus } from '../../../../core/tables/domain/models/table.model';
import { RmsPageHeaderComponent } from '../../../../shared/ui/page-header/rms-page-header.component';
import { RmsSelectComponent } from '../../../../shared/ui/select/rms-select.component';
import { RmsButtonComponent } from '../../../../shared/ui/button/rms-button.component';
import { RmsBadgeComponent } from '../../../../shared/ui/badge/rms-badge.component';
import { RmsCardComponent } from '../../../../shared/ui/card/rms-card.component';
import { RmsEmptyStateComponent } from '../../../../shared/ui/empty-state/rms-empty-state.component';

@Component({
  selector: 'app-tables-list-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RmsPageHeaderComponent,
    RmsSelectComponent,
    RmsButtonComponent,
    RmsBadgeComponent,
    RmsCardComponent,
    RmsEmptyStateComponent,
  ],
  templateUrl: './tables-list.page.html',
  styleUrl: './tables-list.page.css',
})
export class TablesListPageComponent implements OnInit {
  private readonly tablesFacade = inject(TablesFacade);

  readonly tables = this.tablesFacade.tables;
  readonly loading = this.tablesFacade.isLoading;
  selectedStatus: TableStatus | null = null;

  readonly statusOptions = [
    { label: 'Todas', value: null as TableStatus | null },
    { label: 'Disponibles', value: 'AVAILABLE' as TableStatus },
    { label: 'Ocupadas', value: 'OCCUPIED' as TableStatus },
    { label: 'Reservadas', value: 'RESERVED' as TableStatus },
  ];

  ngOnInit(): void {
    this.loadTables();
  }

  loadTables(): void {
    this.tablesFacade.loadTables();
  }

  onStatusChange(value: TableStatus | null): void {
    this.selectedStatus = value;
  }

  get filteredTables(): Table[] {
    if (!this.selectedStatus) {
      return this.tables();
    }
    return this.tables().filter(t => t.status === this.selectedStatus);
  }

  getStatusSeverity(status: TableStatus): 'success' | 'warning' | 'danger' {
    const map: Record<TableStatus, 'success' | 'warning' | 'danger'> = {
      AVAILABLE: 'success',
      OCCUPIED: 'warning',
      RESERVED: 'danger',
    };
    return map[status];
  }

  getStatusLabel(status: TableStatus): string {
    const labels: Record<TableStatus, string> = {
      AVAILABLE: 'Disponible',
      OCCUPIED: 'Ocupada',
      RESERVED: 'Reservada',
    };
    return labels[status];
  }

  changeStatus(id: number, status: TableStatus): void {
    this.tablesFacade.changeStatus(id, status);
  }

  markAsAvailable(id: number): void {
    this.changeStatus(id, 'AVAILABLE');
  }

  markAsOccupied(id: number): void {
    this.changeStatus(id, 'OCCUPIED');
  }

  markAsReserved(id: number): void {
    this.changeStatus(id, 'RESERVED');
  }
}
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';

import { TimeLog, TimeLogFilterParams } from '@app/core/services/schedules/time-log';
import { Logging } from '@app/core/services/logging/logging';
import { TimeLogEntry } from '@app/shared/models/dto/schedules/time-log-entry.model';

import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { InputTextModule } from 'primeng/inputtext';
import { DatePickerModule } from 'primeng/datepicker';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { TableSkeleton } from '@shared/skeletons/table-skeleton';

@Component({
  selector: 'app-time-logs',
  imports: [
    FormsModule,
    ButtonModule, TableModule, TagModule, SkeletonModule, InputTextModule, DatePickerModule, ToastModule,
    TableSkeleton,
  ],
  templateUrl: './time-logs.html',
  styleUrl: './time-logs.css',
})
export class TimeLogs implements OnInit {
  private timeLogService = inject(TimeLog);
  private logger = inject(Logging);
  private messageService = inject(MessageService);

  timeLogs = signal<TimeLogEntry[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  // Filters
  filterWorkerId = signal<number | undefined>(undefined);
  filterFrom = signal<Date | undefined>(undefined);
  filterTo = signal<Date | undefined>(undefined);

  ngOnInit(): void {
    this.loadTimeLogs();
  }

  loadTimeLogs(): void {
    this.loading.set(true);
    this.error.set(null);

    const params: TimeLogFilterParams = {};
    if (this.filterWorkerId() !== undefined) {
      params.workerId = this.filterWorkerId();
    }
    const fromDate = this.filterFrom();
    if (fromDate) {
      params.from = fromDate.toISOString();
    }
    const toDate = this.filterTo();
    if (toDate) {
      params.to = toDate.toISOString();
    }

    this.timeLogService.getTimeLogs(params).subscribe({
      next: (data) => {
        this.timeLogs.set(data);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.logger.error('Failed to load time logs', err);
        if (err.status === 403) {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Acción no disponible fuera de turno' });
        } else if (err.status === 404) {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se encontraron registros' });
        } else {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error al cargar los registros de ingreso' });
        }
        this.error.set('Error al cargar los registros de ingreso');
        this.loading.set(false);
      },
    });
  }

  clearFilters(): void {
    this.filterWorkerId.set(undefined);
    this.filterFrom.set(undefined);
    this.filterTo.set(undefined);
    this.loadTimeLogs();
  }

  formatTimestamp(iso: string): string {
    return new Date(iso).toLocaleString('es-CO', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  }
}

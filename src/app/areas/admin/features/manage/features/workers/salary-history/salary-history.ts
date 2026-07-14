import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';

import { Worker } from '@app/core/services/workers/worker';
import { SalaryHistoryEntry } from '@app/shared/models/dto/workers/salary-history-entry.model';
import { Logging } from '@app/core/services/logging/logging';

@Component({
  selector: 'app-salary-history',
  imports: [
    RouterModule,
    TableModule,
    ButtonModule,
    SkeletonModule,

  ],
  templateUrl: './salary-history.html',
})
export class SalaryHistory implements OnInit {
  private route = inject(ActivatedRoute);
  private workerService = inject(Worker);
  private logger = inject(Logging);

  userId = signal<number>(0);
  entries = signal<SalaryHistoryEntry[] | undefined>(undefined);
  isLoading = computed(() => this.entries() === undefined);
  hasEntries = computed(() => {
    const data = this.entries();
    return data !== undefined && data.length > 0;
  });

  currencyFormat = Intl.NumberFormat('es-Co', { style: 'currency', currency: 'COP' });

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) {
      this.logger.error('SalaryHistory: No user ID provided in route');
      return;
    }
    this.userId.set(id);
    this.loadHistory();
  }

  formatSalary(value: number | null): string {
    if (value === null) return '-';
    return this.currencyFormat.format(value);
  }

  formatDateTime(iso: string): string {
    return new Intl.DateTimeFormat('es-CO', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(iso));
  }

  private loadHistory(): void {
    this.workerService.getSalaryHistory(this.userId()).subscribe({
      next: (data: SalaryHistoryEntry[]) => {
        this.entries.set(data);
      },
      error: (err: HttpErrorResponse) => {
        this.logger.error('Error loading salary history:', err);
        this.entries.set([]);
      },
    });
  }
}

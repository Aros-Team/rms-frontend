import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';

import { Worker } from '@app/core/services/workers/worker';
import { SalaryHistoryEntry } from '@app/shared/models/dto/workers/salary-history-entry';
import { Logging } from '@app/core/services/logging/logging';
import { formatInstant } from '@app/shared/lib/date-format/date-format';
import { Money } from '@app/shared/pipes/money/money';

@Component({
  selector: 'app-salary-history',
  imports: [
    RouterModule,
    TableModule,
    ButtonModule,
    SkeletonModule,
    Money,
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

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) {
      this.logger.error('SalaryHistory: No user ID provided in route');
      return;
    }
    this.userId.set(id);
    this.loadHistory();
  }

  /**
   * Renders the change instant as `dd/mm/aaaa HH:mm` (shared helper — never a
   * local `Intl.DateTimeFormat`, which produced `15T18:00:00/06/2026`).
   */
  formatDateTime(iso: string): string {
    return formatInstant(iso);
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

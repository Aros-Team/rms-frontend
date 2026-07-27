import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartModule } from 'primeng/chart';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageModule } from 'primeng/message';

import { AnalyticsCache } from '@app/core/services/analytics/analytics-cache';
import { AnalyticsPeriodState } from '@app/core/services/analytics/analytics-period-state';
import { Money } from '@app/shared/pipes/money/money';
import { DataCompleteness } from '@app/shared/models/dto/analytics/data-completeness';
import { FingerprintStrategy } from '@app/shared/models/dto/analytics/cohort-report';

@Component({
  selector: 'app-analytics-cohort',
  imports: [CommonModule, ChartModule, SkeletonModule, MessageModule, Money],
  templateUrl: './cohort.html',
  styleUrl: './cohort.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Cohort {
  private readonly cache = inject(AnalyticsCache);

  constructor() {
    effect(() => {
      this.period.period();
      this.cache.cohort.load();
    });
  }

  private readonly period = inject(AnalyticsPeriodState);

  readonly isLoading = computed(() => this.cache.cohort.isLoading());
  readonly error = computed(() => this.cache.cohort.error());
  readonly report = computed(() => this.cache.cohort.data());
  readonly notes = computed(() => this.report()?.notes ?? []);
  readonly completeness = computed<DataCompleteness>(
    () => this.report()?.dataCompleteness ?? 'EMPTY',
  );

  readonly stats = computed(() => {
    const r = this.report();
    if (!r) return null;
    return {
      newClients: r.newClients,
      recurringClients: r.recurringClients,
      totalOrders: r.totalOrders,
      recurringRatePct: r.recurringRatePct,
      averageTicketPerOrder: r.averageTicketPerOrder,
      averageTicketPerCover: r.averageTicketPerCover,
      fingerprintStrategy: r.fingerprintStrategy,
    };
  });

  readonly splitChartData = computed(() => {
    const r = this.report();
    if (!r) return { labels: [], datasets: [] };
    return {
      labels: ['Nuevos', 'Recurrentes'],
      datasets: [
        {
          data: [r.newClients, r.recurringClients],
          backgroundColor: ['#3b82f6', '#22c55e'],
          borderWidth: 0,
        },
      ],
    };
  });

  readonly doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom' as const } },
  };

  fingerprintLabel(s: FingerprintStrategy): string {
    return { PHONE: 'Teléfono', PHONE_OR_TABLE: 'Teléfono o mesa', TABLE_ONLY: 'Sólo mesa' }[s];
  }

  reload(): void { this.cache.cohort.refresh(); }
}

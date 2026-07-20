import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartModule } from 'primeng/chart';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageModule } from 'primeng/message';

import { AnalyticsCache } from '@app/core/services/analytics/analytics-cache';
import { MoneyPipe } from '@app/shared/pipes/money';
import { DataCompleteness } from '@app/shared/models/dto/analytics/data-completeness';

@Component({
  selector: 'app-analytics-prime-cost',
  imports: [CommonModule, ChartModule, SkeletonModule, MessageModule, MoneyPipe],
  templateUrl: './prime-cost.html',
  styleUrl: './prime-cost.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrimeCost {
  private readonly cache = inject(AnalyticsCache);

  constructor() {
    this.cache.primeCost.loadIfStale();
  }

  readonly isLoading = computed(() => this.cache.primeCost.isLoading());
  readonly error = computed(() => this.cache.primeCost.error());
  readonly report = computed(() => this.cache.primeCost.data());
  readonly notes = computed(() => this.report()?.notes ?? []);
  readonly completeness = computed<DataCompleteness>(
    () => this.report()?.dataCompleteness ?? 'EMPTY',
  );

  readonly latest = computed(() => {
    const series = this.report()?.series ?? [];
    return series.length > 0 ? series[series.length - 1] : null;
  });

  readonly trendChartData = computed(() => {
    const series = this.report()?.series ?? [];
    return {
      labels: series.map((p) => p.key),
      datasets: [
        {
          label: 'Costo primo (%)',
          data: series.map((p) => p.primeCostPct),
          borderColor: 'var(--p-primary-color)',
          backgroundColor: 'rgba(249, 187, 11, 0.2)',
          fill: true,
          tension: 0.3,
        },
      ],
    };
  });

  readonly trendChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom' as const },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (v: number | string) => `${String(v)}%`,
        },
      },
    },
  };

  readonly cogsChartData = computed(() => {
    const c = this.latest()?.cogs.byCategory ?? [];
    return {
      labels: c.map((r) => r.category),
      datasets: [
        {
          data: c.map((r) => Number.parseFloat(r.amount.amount)),
          backgroundColor: ['#F9BB0B', '#42A5F5', '#66BB6A', '#AB47BC'],
          borderWidth: 0,
        },
      ],
    };
  });

  readonly laborChartData = computed(() => {
    const l = this.latest()?.labor.byArea ?? [];
    return {
      labels: l.map((r) => r.area),
      datasets: [
        {
          data: l.map((r) => Number.parseFloat(r.amount.amount)),
          backgroundColor: ['#FFA726', '#26A69A', '#EC407A'],
          borderWidth: 0,
        },
      ],
    };
  });

  readonly doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom' as const },
    },
  };

  cogsRows = computed(() => this.latest()?.cogs.byCategory ?? []);
  laborRows = computed(() => this.latest()?.labor.byArea ?? []);

  fmtPercent(value: number | null | undefined): string {
    if (value === null || value === undefined) return '—';
    return `${value.toFixed(2)}%`;
  }

  reload(): void {
    this.cache.primeCost.refresh();
  }
}
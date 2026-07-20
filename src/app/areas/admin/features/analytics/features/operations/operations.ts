import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartModule } from 'primeng/chart';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageModule } from 'primeng/message';

import { AnalyticsCache } from '@app/core/services/analytics/analytics-cache';
import { MoneyPipe } from '@app/shared/pipes/money';
import { DataCompleteness } from '@app/shared/models/dto/analytics/data-completeness';
import { DayPart } from '@app/shared/models/dto/analytics/operations-report';

@Component({
  selector: 'app-analytics-operations',
  imports: [CommonModule, ChartModule, SkeletonModule, MessageModule, MoneyPipe],
  templateUrl: './operations.html',
  styleUrl: './operations.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Operations {
  private readonly cache = inject(AnalyticsCache);

  constructor() {
    this.cache.operations.loadIfStale();
  }

  readonly isLoading = computed(() => this.cache.operations.isLoading());
  readonly error = computed(() => this.cache.operations.error());
  readonly report = computed(() => this.cache.operations.data());
  readonly notes = computed(() => this.report()?.notes ?? []);
  readonly completeness = computed<DataCompleteness>(
    () => this.report()?.dataCompleteness ?? 'EMPTY',
  );

  readonly stats = computed(() => {
    const r = this.report();
    if (!r) return null;
    return {
      revPashValue: r.revPash.value,
      revPashTotalNetSales: r.revPash.totalNetSales,
      totalAvailableSeatHours: r.revPash.totalAvailableSeatHours,
      overallTurnover: r.tableTurnover.overall,
      avgOccupancyMinutes: r.avgOccupancyMinutes,
    };
  });

  readonly dayPartChartData = computed(() => {
    const dayParts = this.report()?.tableTurnover.byDayPart ?? [];
    return {
      labels: dayParts.map((d) => this.dayPartLabel(d.dayPart)),
      datasets: [
        {
          label: 'Rotación (turnos)',
          data: dayParts.map((d) => d.turns),
          backgroundColor: '#3b82f6',
        },
        {
          label: 'Cubiertos',
          data: dayParts.map((d) => d.covers),
          backgroundColor: '#22c55e',
        },
      ],
    };
  });

  readonly dayPartChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom' as const } },
    scales: {
      x: { title: { display: true, text: 'Franja horaria' } },
      y: { beginAtZero: true, title: { display: true, text: 'Valor' } },
    },
  };

  dayPartLabel(d: DayPart): string {
    return { LUNCH: 'Almuerzo', DINNER: 'Cena', OTHER: 'Otro' }[d];
  }

  reload(): void { this.cache.operations.refresh(); }
}

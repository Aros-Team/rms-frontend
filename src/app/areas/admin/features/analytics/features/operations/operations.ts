import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import type { ChartData } from 'chart.js';
import { ChartModule } from 'primeng/chart';

import { AnalyticsCache } from '@app/core/services/analytics/analytics-cache';
import { downloadCsv, operationsCsv } from '@app/core/services/analytics/analytics-csv';
import { describeAnalyticsError } from '@app/core/services/analytics/analytics-error';
import { moneyAmount, percentChange } from '@app/core/services/analytics/analytics-money';
import { AnalyticsPeriodState } from '@app/core/services/analytics/analytics-period-state';
import { bucketLabel, previousRange, rangeLabel } from '@app/core/services/analytics/analytics-utils';
import { Money as MoneyPipe } from '@app/shared/pipes/money/money';
import { RmsChartFrame } from '@app/shared/ui/chart-frame/chart-frame';
import { rmsChartPalette } from '@app/shared/ui/chart/chart-theme';
import { RmsEmptyState } from '@app/shared/ui/empty-state/empty-state';
import { RmsPageHeader } from '@app/shared/ui/page-header/page-header';
import { RmsStatTile } from '@app/shared/ui/stat-tile/stat-tile';
import type { RmsDeltaTone } from '@app/shared/ui/stat-tile/stat-tile';

import { AnalyticsNotice } from '../../components/analytics-notice/analytics-notice';
import { countBarOptions, formatPct } from '../../analytics-chart-options';

interface Delta {
  text: string;
  tone: RmsDeltaTone;
}

const DAY_PART_LABEL: Record<string, string> = {
  LUNCH: 'Almuerzo',
  DINNER: 'Cena',
  OTHER: 'Otros',
};

@Component({
  selector: 'app-analytics-operations',
  imports: [
    ChartModule,
    MoneyPipe,
    RmsChartFrame,
    RmsEmptyState,
    RmsPageHeader,
    RmsStatTile,
    AnalyticsNotice,
  ],
  templateUrl: './operations.html',
  styleUrls: ['../../analytics-shared.css', './operations.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Operations {
  private readonly cache = inject(AnalyticsCache);
  private readonly period = inject(AnalyticsPeriodState);

  readonly isLoading = computed(() => this.cache.operations.isLoading());
  readonly error = computed(() => this.cache.operations.error());
  readonly report = computed(() => this.cache.operations.data());
  readonly previous = computed(() => this.cache.operationsPrevious.data() ?? null);
  readonly notes = computed(() => this.report()?.notes ?? []);
  readonly completeness = computed(() => this.report()?.dataCompleteness ?? 'EMPTY');
  readonly errorInfo = computed(() => {
    const error = this.error();
    return error === undefined ? null : describeAnalyticsError(error);
  });

  readonly rangeLabel = this.period.label;
  readonly previousLabel = computed(() => {
    const selection = this.period.period();
    const range = previousRange(selection.bucket, selection.from, selection.to);
    return rangeLabel(selection.bucket, range.from, range.to);
  });
  readonly subtitle = computed(
    () => `RevPASH, cubiertos y rotación · agrupado por ${bucketLabel(this.period.bucket()).toLowerCase()}`,
  );

  readonly busy = computed(() => this.isLoading() && this.report() === null);
  readonly isEmpty = computed(
    () =>
      !this.isLoading() &&
      this.error() === undefined &&
      (this.report() === null || this.completeness() === 'EMPTY'),
  );

  readonly dayPartRows = computed(() =>
    (this.report()?.tableTurnover.byDayPart ?? []).map((row) => ({
      ...row,
      label: DAY_PART_LABEL[row.dayPart] ?? row.dayPart,
    })),
  );

  readonly chartOptions = countBarOptions('Turnos');
  readonly chartData = computed<ChartData<'bar'>>(() => {
    const palette = rmsChartPalette();
    return {
      labels: this.dayPartRows().map((row) => row.label),
      datasets: [
        {
          label: 'Turnos',
          data: this.dayPartRows().map((row) => row.turns),
          backgroundColor: palette[0],
          borderWidth: 0,
        },
      ],
    };
  });

  readonly revPash = computed(() => this.report()?.revPash.value ?? null);
  readonly revPashDelta = computed(() =>
    this.deltaPct(
      moneyAmount(this.report()?.revPash.value),
      moneyAmount(this.previous()?.revPash.value),
      false,
    ),
  );
  readonly netSalesDelta = computed(() =>
    this.deltaPct(
      moneyAmount(this.report()?.revPash.totalNetSales),
      moneyAmount(this.previous()?.revPash.totalNetSales),
      false,
    ),
  );
  readonly coversDelta = computed(() =>
    this.deltaPct(this.report()?.covers, this.previous()?.covers, false),
  );
  readonly turnsDelta = computed(() =>
    this.deltaPct(
      this.report()?.tableTurnover.overall,
      this.previous()?.tableTurnover.overall,
      false,
    ),
  );
  readonly laborDelta = computed(() =>
    this.deltaPp(this.report()?.labor.sharePct, this.previous()?.labor.sharePct, true),
  );
  readonly occupancyDelta = computed(() =>
    this.deltaPct(
      this.report()?.avgOccupancyMinutes,
      this.previous()?.avgOccupancyMinutes,
      false,
    ),
  );

  constructor() {
    effect(() => {
      this.period.period();
      this.period.revision();
      this.cache.operations.load();
      this.cache.operationsPrevious.load();
    });
  }

  reload(): void {
    this.cache.operations.refresh();
    this.cache.operationsPrevious.refresh();
  }

  exportCsv(): void {
    const report = this.report();
    if (report === null) return;
    downloadCsv(`operacion-${report.period.from}-${report.period.to}.csv`, operationsCsv(report));
  }

  buildCsv(): string {
    const report = this.report();
    return report === null ? '' : operationsCsv(report);
  }

  dayPartLabel(dayPart: string): string {
    return DAY_PART_LABEL[dayPart] ?? dayPart;
  }

  minutes(value: number | null | undefined): string {
    if (value === null || value === undefined) return '—';
    return `${value.toFixed(1).replace('.', ',')} min`;
  }

  decimal(value: number | null | undefined): string {
    if (value === null || value === undefined) return '—';
    return value.toFixed(1).replace('.', ',');
  }

  readonly formatPct = formatPct;

  private deltaPct(
    current: number | null | undefined,
    previous: number | null | undefined,
    lowerIsBetter: boolean,
  ): Delta {
    const change = percentChange(current, previous);
    if (change === null) return { text: '', tone: 'neutral' };
    const tone = toneFor(change, lowerIsBetter);
    return { text: `${signed(change)}% vs anterior`, tone };
  }

  private deltaPp(
    current: number | null | undefined,
    previous: number | null | undefined,
    lowerIsBetter: boolean,
  ): Delta {
    if (current === null || current === undefined || previous === null || previous === undefined) {
      return { text: '', tone: 'neutral' };
    }
    const change = current - previous;
    const tone = toneFor(change, lowerIsBetter);
    return { text: `${signed(change)} pp vs anterior`, tone };
  }
}

function toneFor(change: number, lowerIsBetter: boolean): RmsDeltaTone {
  if (change === 0) return 'neutral';
  const positive = lowerIsBetter ? change < 0 : change > 0;
  return positive ? 'positive' : 'negative';
}

function signed(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded > 0 ? '+' : ''}${rounded.toFixed(1).replace('.', ',')}`;
}

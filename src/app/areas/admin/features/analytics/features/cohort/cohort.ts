import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import type { ChartData } from 'chart.js';

import { AnalyticsCache } from '@app/core/services/analytics/analytics-cache';
import { cohortCsv, downloadCsv } from '@app/core/services/analytics/analytics-csv';
import { describeAnalyticsError } from '@app/core/services/analytics/analytics-error';
import { AnalyticsPeriodState } from '@app/core/services/analytics/analytics-period-state';
import { bucketLabel, titleForKey } from '@app/core/services/analytics/analytics-utils';
import type { CohortFingerprintStrategy } from '@app/shared/models/dto/analytics/cohort-report';
import { Money as MoneyPipe } from '@app/shared/pipes/money/money';
import { RmsBadge } from '@app/shared/ui/badge/badge';
import type { RmsBadgeTone } from '@app/shared/ui/badge/badge';
import { RmsButton } from '@app/shared/ui/button/button';
import { RmsChartFrame } from '@app/shared/ui/chart-frame/chart-frame';
import { rmsChartPalette } from '@app/shared/ui/chart/chart-theme';
import { RmsChart } from '@app/shared/ui/chart/rms-chart';
import { RmsEmptyState } from '@app/shared/ui/empty-state/empty-state';
import { RmsPageHeader } from '@app/shared/ui/page-header/page-header';
import { RmsStatTile } from '@app/shared/ui/stat-tile/stat-tile';

import { AnalyticsNotice } from '../../components/analytics-notice/analytics-notice';
import { countBarOptions, formatPct } from '../../analytics-chart-options';

const STRATEGY_LABEL: Record<CohortFingerprintStrategy, string> = {
  PHONE: 'Teléfono',
  PHONE_OR_TABLE: 'Teléfono o mesa',
  TABLE_ONLY: 'Solo mesa',
};

@Component({
  selector: 'app-analytics-cohort',
  imports: [
    MoneyPipe,
    RmsBadge,
    RmsButton,
    RmsChart,
    RmsChartFrame,
    RmsEmptyState,
    RmsPageHeader,
    RmsStatTile,
    AnalyticsNotice,
  ],
  templateUrl: './cohort.html',
  styleUrls: ['../../analytics-shared.css', './cohort.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Cohort {
  private readonly cache = inject(AnalyticsCache);
  private readonly period = inject(AnalyticsPeriodState);

  readonly isLoading = computed(() => this.cache.cohort.isLoading());
  readonly error = computed(() => this.cache.cohort.error());
  readonly report = computed(() => this.cache.cohort.data());
  readonly notes = computed(() => this.report()?.notes ?? []);
  readonly completeness = computed(() => this.report()?.dataCompleteness ?? 'EMPTY');
  readonly errorInfo = computed(() => {
    const error = this.error();
    return error === undefined ? null : describeAnalyticsError(error);
  });

  readonly rangeLabel = this.period.label;
  readonly subtitle = computed(
    () => `Clientes nuevos y recurrentes · agrupado por ${bucketLabel(this.period.bucket()).toLowerCase()}`,
  );

  readonly busy = computed(() => this.isLoading() && this.report() === null);
  readonly isEmpty = computed(
    () =>
      !this.isLoading() &&
      this.error() === undefined &&
      (this.report() === null || this.completeness() === 'EMPTY'),
  );

  readonly rows = computed(() =>
    (this.report()?.cohorts ?? []).map((row) => ({
      ...row,
      label: titleForKey(this.period.bucket(), row.key),
    })),
  );

  readonly strategy = computed(() => {
    const value = this.report()?.fingerprintStrategy;
    return value === undefined ? null : STRATEGY_LABEL[value];
  });

  readonly windowDays = computed(() => this.report()?.cohortWindowDays ?? null);

  readonly strategyTone = computed<RmsBadgeTone>(() => {
    switch (this.report()?.fingerprintStrategy) {
      case 'PHONE':
        return 'success';
      case 'PHONE_OR_TABLE':
        return 'info';
      case 'TABLE_ONLY':
        return 'warning';
      default:
        return 'neutral';
    }
  });

  readonly chartOptions = countBarOptions('Pedidos', true);
  readonly chartData = computed<ChartData<'bar'>>(() => {
    const palette = rmsChartPalette();
    return {
      labels: this.rows().map((row) => row.label),
      datasets: [
        {
          label: 'Nuevos',
          data: this.rows().map((row) => row.newClients),
          backgroundColor: palette[0],
          borderWidth: 0,
          stack: 'clients',
        },
        {
          label: 'Recurrentes',
          data: this.rows().map((row) => row.recurringClients),
          backgroundColor: palette[1],
          borderWidth: 0,
          stack: 'clients',
        },
      ],
    };
  });

  readonly chartColors = computed(() => {
    const palette = rmsChartPalette();
    return { new: palette[0], recurring: palette[1] };
  });

  constructor() {
    effect(() => {
      this.period.period();
      this.period.revision();
      this.cache.cohort.load();
    });
  }

  reload(): void {
    this.cache.cohort.refresh();
  }

  exportCsv(): void {
    const report = this.report();
    if (report === null) return;
    downloadCsv(`cohorte-${report.period.from}-${report.period.to}.csv`, cohortCsv(report));
  }

  buildCsv(): string {
    const report = this.report();
    return report === null ? '' : cohortCsv(report);
  }

  readonly formatPct = formatPct;
}

import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Subscription, finalize } from 'rxjs';

import { Analytics } from '@app/core/services/analytics/analytics';
import { alertsCsv, downloadCsv } from '@app/core/services/analytics/analytics-csv';
import { describeAnalyticsError } from '@app/core/services/analytics/analytics-error';
import { AnalyticsPeriodState } from '@app/core/services/analytics/analytics-period-state';
import { isTimeBucket, titleForKey } from '@app/core/services/analytics/analytics-utils';
import type {
  AlertSeverity,
  AlertStatus,
  AlertsPage,
  SystemAlert,
} from '@app/shared/models/dto/analytics/system-alert';
import { RmsButton } from '@app/shared/ui/button/button';
import { RmsEmptyState } from '@app/shared/ui/empty-state/empty-state';
import { RmsPageHeader } from '@app/shared/ui/page-header/page-header';
import { RmsSelect, type RmsSelectOption } from '@app/shared/ui/select/select';
import { RmsSkeleton } from '@app/shared/ui/skeleton/skeleton';
import { RmsStatTile } from '@app/shared/ui/stat-tile/stat-tile';
import { RmsStatusPill } from '@app/shared/ui/status-pill/status-pill';
import type { RmsStatus } from '@app/shared/ui/types/ui-types';

import { AnalyticsNotice } from '../../components/analytics-notice/analytics-notice';

const PAGE_SIZE = 25;

const STATUS_LABEL: Record<AlertStatus, string> = {
  OPEN: 'Abierta',
  READ: 'Leída',
  DISMISSED: 'Descartada',
};

const STATUS_TONE: Record<AlertStatus, RmsStatus> = {
  OPEN: 'warning',
  READ: 'neutral',
  DISMISSED: 'neutral',
};

const SEVERITY_LABEL: Record<AlertSeverity, string> = {
  RED: 'Roja',
  YELLOW: 'Amarilla',
  INFO: 'Info',
};

const SEVERITY_TONE: Record<AlertSeverity, RmsStatus> = {
  RED: 'danger',
  YELLOW: 'warning',
  INFO: 'info',
};

const TYPE_LABEL: Record<string, string> = {
  FOOD_COST_DEVIATION: 'Costo de alimentos',
  LABOR_COST_DEVIATION: 'Costo de nómina',
  SALES_DROP_YOY: 'Caída de ventas',
  LOW_MARGIN_SKU_SPIKE: 'Producto de bajo margen',
  REVPASH_DROP: 'Caída de RevPASH',
};

const METRIC_LABEL: Record<string, string> = {
  food_cost_pct: 'Costo de alimentos',
  labor_cost_pct: 'Costo de nómina',
  revpash: 'RevPASH',
  dog_units: 'Unidades de bajo margen',
  sales: 'Ventas',
};

@Component({
  selector: 'app-analytics-alerts',
  imports: [
    FormsModule,
    RmsButton,
    RmsEmptyState,
    RmsPageHeader,
    RmsSelect,
    RmsSkeleton,
    RmsStatTile,
    RmsStatusPill,
    AnalyticsNotice,
  ],
  templateUrl: './alerts.html',
  styleUrls: ['../../analytics-shared.css', './alerts.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Alerts {
  private readonly api = inject(Analytics);
  private readonly period = inject(AnalyticsPeriodState);
  private readonly destroyRef = inject(DestroyRef);

  readonly page = signal<AlertsPage | null>(null);
  readonly loading = signal(false);
  readonly error = signal<unknown>(null);
  readonly actionError = signal('');
  readonly marking = signal<number | null>(null);

  readonly status = signal<AlertStatus | ''>('');
  readonly severity = signal<AlertSeverity | ''>('');
  readonly offset = signal(0);
  readonly limit = PAGE_SIZE;

  readonly statusOptions: RmsSelectOption[] = [
    { label: 'Todas', value: '' },
    { label: 'Abiertas', value: 'OPEN' },
    { label: 'Leídas', value: 'READ' },
    { label: 'Descartadas', value: 'DISMISSED' },
  ];

  readonly severityOptions: RmsSelectOption[] = [
    { label: 'Todas', value: '' },
    { label: 'Rojas', value: 'RED' },
    { label: 'Amarillas', value: 'YELLOW' },
    { label: 'Info', value: 'INFO' },
  ];

  readonly items = computed(() => this.page()?.items ?? []);
  readonly total = computed(() => this.page()?.page.total ?? 0);
  readonly errorInfo = computed(() => {
    const error = this.error();
    return error === null ? null : describeAnalyticsError(error);
  });

  readonly isEmpty = computed(
    () => !this.loading() && this.error() === null && this.items().length === 0,
  );

  readonly pageLabel = computed(() => {
    const total = this.total();
    if (total === 0) return 'Sin alertas';
    const start = this.offset() + 1;
    const end = Math.min(this.offset() + this.items().length, total);
    return `${String(start)}–${String(end)} de ${String(total)}`;
  });

  readonly canPrevious = computed(() => this.offset() > 0);
  readonly canNext = computed(() => this.offset() + this.limit < this.total());

  readonly openOnPage = computed(() => this.items().filter((item) => item.status === 'OPEN').length);
  readonly redOnPage = computed(() => this.items().filter((item) => item.severity === 'RED').length);

  private request?: Subscription;

  constructor() {
    effect(() => {
      this.period.revision();
      this.status();
      this.severity();
      this.offset();
      this.load();
    });
    this.destroyRef.onDestroy(() => this.request?.unsubscribe());
  }

  onStatusChange(value: string | number | null): void {
    this.status.set(typeof value === 'string' ? (value as AlertStatus | '') : '');
    this.offset.set(0);
  }

  onSeverityChange(value: string | number | null): void {
    this.severity.set(typeof value === 'string' ? (value as AlertSeverity | '') : '');
    this.offset.set(0);
  }

  previousPage(): void {
    this.offset.update((value) => Math.max(0, value - this.limit));
  }

  nextPage(): void {
    if (this.canNext()) this.offset.update((value) => value + this.limit);
  }

  markRead(alert: SystemAlert): void {
    if (alert.status !== 'OPEN' || this.marking() !== null) return;
    const before = this.page();
    if (before === null) return;

    this.actionError.set('');
    this.marking.set(alert.id);
    this.page.set({
      ...before,
      items: before.items.map((item) =>
        item.id === alert.id ? { ...item, status: 'READ' as const } : item,
      ),
    });

    this.api
      .markAlertRead(alert.id)
      .pipe(
        finalize(() => {
          this.marking.set(null);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        error: () => {
          this.page.set(before);
          this.actionError.set('No se pudo marcar la alerta como leída. Se restauró el estado.');
        },
      });
  }

  retry(): void {
    this.load();
  }

  exportCsv(): void {
    const items = this.items();
    if (items.length === 0) return;
    downloadCsv(`alertas-${new Date().toISOString().slice(0, 10)}.csv`, alertsCsv(items));
  }

  buildCsv(): string {
    return alertsCsv(this.items());
  }

  severityLabel(severity: AlertSeverity): string {
    return SEVERITY_LABEL[severity];
  }

  severityTone(severity: AlertSeverity): RmsStatus {
    return SEVERITY_TONE[severity];
  }

  statusLabel(status: AlertStatus): string {
    return STATUS_LABEL[status];
  }

  statusTone(status: AlertStatus): RmsStatus {
    return STATUS_TONE[status];
  }

  typeLabel(type: string): string {
    return TYPE_LABEL[type] ?? type;
  }

  metricLabel(alert: SystemAlert): string {
    return METRIC_LABEL[alert.metric] ?? alert.metric;
  }

  describe(alert: SystemAlert): string {
    const deviation = Math.abs(alert.deviationPct ?? 0).toFixed(1).replace('.', ',');
    switch (alert.type) {
      case 'FOOD_COST_DEVIATION':
        return `El costo de alimentos está ${deviation}% por encima del promedio de 12 meses.`;
      case 'LABOR_COST_DEVIATION':
        return `El costo de nómina está ${deviation}% por encima del promedio de 12 meses.`;
      case 'SALES_DROP_YOY':
        return `Las ventas cayeron ${deviation}% frente al mismo periodo del año anterior.`;
      case 'LOW_MARGIN_SKU_SPIKE':
        return `Las unidades de un producto de bajo margen crecieron ${deviation}% semana a semana.`;
      case 'REVPASH_DROP':
        return `RevPASH cayó ${deviation}% frente al promedio de 4 semanas.`;
      default:
        return `Variación de ${this.metricLabel(alert)}: ${deviation}%.`;
    }
  }

  metricValue(alert: SystemAlert): string {
    const formatter = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 });
    const current = alert.current === null ? '—' : formatter.format(alert.current);
    const baseline = alert.baseline === null ? '—' : formatter.format(alert.baseline);
    return `${current} (base ${baseline})`;
  }

  detectedLabel(alert: SystemAlert): string {
    const date = new Date(alert.detectedAt);
    if (Number.isNaN(date.getTime())) return alert.detectedAt;
    return new Intl.DateTimeFormat('es-CO', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  }

  periodLabel(alert: SystemAlert): string {
    return isTimeBucket(alert.bucket)
      ? titleForKey(alert.bucket, alert.period)
      : alert.period;
  }

  private load(): void {
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set(null);
    const status = this.status();
    const severity = this.severity();
    this.request = this.api
      .getAlerts({
        status: status === '' ? undefined : status,
        severity: severity === '' ? undefined : severity,
        limit: this.limit,
        offset: this.offset(),
      })
      .pipe(
        finalize(() => {
          this.loading.set(false);
        }),
      )
      .subscribe({
        next: (page) => {
          this.page.set(page);
        },
        error: (error: unknown) => {
          this.error.set(error);
        },
      });
  }
}

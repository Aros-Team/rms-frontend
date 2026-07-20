import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageModule } from 'primeng/message';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { PaginatorModule, type PaginatorState } from 'primeng/paginator';
import { MessageService } from 'primeng/api';

import { Analytics } from '@app/core/services/analytics/analytics';
import { AnalyticsCache } from '@app/core/services/analytics/analytics-cache';
import { MetricValuePipe } from '@app/shared/pipes/metric-value';
import { Alert, AlertSeverity, AlertStatus, AlertType, AlertsPage, ALERT_SEVERITIES, ALERT_STATUSES, ALERT_TYPES } from '@app/shared/models/dto/analytics/alert';

interface StatusOption { label: string; value: AlertStatus | null }
interface SeverityOption { label: string; value: AlertSeverity | null }

@Component({
  selector: 'app-analytics-alerts',
  imports: [CommonModule, FormsModule, SkeletonModule, MessageModule, TableModule, TagModule, ButtonModule, SelectModule, PaginatorModule, MetricValuePipe],
  providers: [MessageService],
  templateUrl: './alerts.html',
  styleUrl: './alerts.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Alerts {
  private readonly api = inject(Analytics);
  private readonly cache = inject(AnalyticsCache);
  private readonly toast = inject(MessageService);

  readonly limit = signal(50);
  readonly offset = signal(0);
  readonly statusFilter = signal<AlertStatus | null>(null);
  readonly severityFilter = signal<AlertSeverity | null>(null);
  readonly marking = signal<number | null>(null);
  readonly page = signal<AlertsPage | null>(null);
  readonly isLoading = signal(false);
  readonly error = signal<Error | null>(null);

  readonly statusOptions: StatusOption[] = [
    { label: 'Todos', value: null },
    ...ALERT_STATUSES.map((s): StatusOption => ({ label: this.statusLabel(s), value: s })),
  ];
  readonly severityOptions: SeverityOption[] = [
    { label: 'Todas', value: null },
    ...ALERT_SEVERITIES.map((s): SeverityOption => ({ label: this.severityLabel(s), value: s })),
  ];

  readonly items = computed(() => this.page()?.items ?? []);
  readonly total = computed(() => this.page()?.page.total ?? 0);

  readonly summary = computed(() => {
    const items = this.items();
    return {
      open: items.filter((a) => a.status === 'OPEN').length,
      red: items.filter((a) => a.severity === 'RED').length,
      yellow: items.filter((a) => a.severity === 'YELLOW').length,
      info: items.filter((a) => a.severity === 'INFO').length,
    };
  });

  constructor() {
    this.fetch();
    effect(() => {
      this.statusFilter();
      this.severityFilter();
      this.offset();
      this.limit();
      this.fetch();
    });
  }

  private fetch(): void {
    this.isLoading.set(true);
    this.error.set(null);
    const filters: {
      status?: AlertStatus;
      severity?: AlertSeverity;
      limit: number;
      offset: number;
    } = {
      limit: this.limit(),
      offset: this.offset(),
    };
    const statusVal = this.statusFilter();
    if (statusVal !== null) filters.status = statusVal;
    const sevVal = this.severityFilter();
    if (sevVal !== null) filters.severity = sevVal;

    this.api.listAlerts(filters).subscribe({
      next: (page) => {
        this.page.set(page);
        this.isLoading.set(false);
      },
      error: (err: unknown) => {
        this.error.set(err instanceof Error ? err : new Error(String(err)));
        this.isLoading.set(false);
      },
    });
  }

  statusLabel(s: AlertStatus): string {
    const map = { OPEN: 'Abierta', READ: 'Leída', DISMISSED: 'Descartada' } as const;
    return map[s];
  }
  severityLabel(s: AlertSeverity): string {
    const map = { RED: 'Roja', YELLOW: 'Amarilla', INFO: 'Info' } as const;
    return map[s];
  }
  typeLabel(t: AlertType): string {
    const map = {
      FOOD_COST_DEVIATION: 'Costo comida',
      LABOR_COST_DEVIATION: 'Costo laboral',
      SALES_DROP_YOY: 'Caída ventas YoY',
      LOW_MARGIN_SKU_SPIKE: 'SKU bajo margen',
      REVPASH_DROP: 'Caída RevPASH',
    } as const;
    return map[t];
  }
  typeIcon(t: AlertType): string {
    const map = {
      FOOD_COST_DEVIATION: 'pi pi-shopping-cart',
      LABOR_COST_DEVIATION: 'pi pi-users',
      SALES_DROP_YOY: 'pi pi-chart-line',
      LOW_MARGIN_SKU_SPIKE: 'pi pi-exclamation-triangle',
      REVPASH_DROP: 'pi pi-clock',
    } as const;
    return map[t];
  }
  severityColor(s: AlertSeverity): 'danger' | 'warn' | 'info' {
    const map = { RED: 'danger', YELLOW: 'warn', INFO: 'info' } as const;
    return map[s];
  }
  statusColor(s: AlertStatus): 'danger' | 'success' | 'secondary' {
    const map = { OPEN: 'danger', READ: 'success', DISMISSED: 'secondary' } as const;
    return map[s];
  }
  deviationFmt(d: number): string {
    const sign = d >= 0 ? '+' : '';
    return `${sign}${d.toFixed(2)}%`;
  }
  metricFmt(m: { amount: string } | undefined): string {
    if (!m) return '—';
    return m.amount;
  }

  onPage(event: PaginatorState): void {
    this.offset.set(event.first ?? 0);
    this.limit.set(event.rows ?? 50);
  }

  onStatusFilter(value: AlertStatus | null): void {
    this.statusFilter.set(value);
    this.offset.set(0);
  }

  onSeverityFilter(value: AlertSeverity | null): void {
    this.severityFilter.set(value);
    this.offset.set(0);
  }

  reload(): void {
    this.fetch();
  }

  markRead(id: number): void {
    this.marking.set(id);
    this.page.update((current) => {
      if (!current) return current;
      return {
        ...current,
        items: current.items.map((a: Alert) =>
          a.id === id && a.status !== 'READ' ? { ...a, status: 'READ' } : a,
        ),
      };
    });
    this.api.markAlertRead(id).subscribe({
      next: () => {
        this.marking.set(null);
        this.toast.add({ severity: 'success', summary: 'Alerta marcada como leída' });
      },
      error: () => {
        this.marking.set(null);
        this.toast.add({ severity: 'error', summary: 'No se pudo marcar la alerta' });
      },
    });
  }

  alertTypes = ALERT_TYPES;
}

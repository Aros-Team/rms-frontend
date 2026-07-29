import { Injectable, inject } from '@angular/core';

import { ResourceCache } from '@app/core/cache/resource-cache/resource-cache';
import { Analytics } from '@app/core/services/analytics/analytics';
import { AnalyticsPeriodState } from '@app/core/services/analytics/analytics-period-state';

import { AlertStatus, AlertsPage, Alert } from '@app/shared/models/dto/analytics/alert';
import { CohortReport } from '@app/shared/models/dto/analytics/cohort-report';
import { MenuEngineeringReport } from '@app/shared/models/dto/analytics/menu-engineering-report';
import { OperationsReport } from '@app/shared/models/dto/analytics/operations-report';
import { PrimeCostReport } from '@app/shared/models/dto/analytics/prime-cost-report';

@Injectable({ providedIn: 'root' })
export class AnalyticsCache {
  private readonly api = inject(Analytics);
  private readonly period = inject(AnalyticsPeriodState);

  readonly primeCost = new ResourceCache<PrimeCostReport>(
    () => {
      const p = this.period.period();
      return this.api.getPrimeCost(p.from, p.to);
    },
    { ttlMs: 600_000, staleWhileRevalidate: true },
  );

  readonly menuEngineering = new ResourceCache<MenuEngineeringReport>(
    () => {
      const p = this.period.period();
      return this.api.getMenuEngineering(p.from, p.to);
    },
    { ttlMs: 1_800_000, staleWhileRevalidate: true },
  );

  readonly operations = new ResourceCache<OperationsReport>(
    () => {
      const p = this.period.period();
      return this.api.getOperations(p.from, p.to);
    },
    { ttlMs: 300_000, staleWhileRevalidate: true },
  );

  readonly cohort = new ResourceCache<CohortReport>(
    () => {
      const p = this.period.period();
      return this.api.getCohort(p.from, p.to);
    },
    { ttlMs: 600_000, staleWhileRevalidate: true },
  );

  readonly alerts = new ResourceCache<AlertsPage>(
    () => this.api.listAlerts(),
    { ttlMs: 120_000, staleWhileRevalidate: true },
  );

  markAlertReadLocal(alertId: number): void {
    this.alerts.patchData((current) => {
      const items: Alert[] = current.items.map((a) =>
        a.id === alertId && a.status !== 'READ'
          ? { ...a, status: 'READ' satisfies AlertStatus }
          : a,
      );
      return { ...current, items };
    });
  }
}

import { Injectable, inject } from '@angular/core';

import { ResourceCache } from '@app/core/cache/resource-cache/resource-cache';
import { Analytics } from '@app/core/services/analytics/analytics';
import { AnalyticsPeriodState } from '@app/core/services/analytics/analytics-period-state';

import { MenuEngineeringReport } from '@app/shared/models/dto/analytics/menu-engineering-report';
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
}

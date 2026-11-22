import { Injectable, inject } from '@angular/core';
import { Observable, catchError, finalize, throwError } from 'rxjs';

import { ResourceCache } from '@app/core/cache/resource-cache/resource-cache';
import { Analytics } from '@app/core/services/analytics/analytics';
import { AnalyticsPeriodState } from '@app/core/services/analytics/analytics-period-state';
import { previousRange } from '@app/core/services/analytics/analytics-utils';
import { toAnalyticsRequestError } from '@app/core/services/analytics/analytics-request-error';

import { CohortReport } from '@app/shared/models/dto/analytics/cohort-report';
import { MenuEngineeringReport } from '@app/shared/models/dto/analytics/menu-engineering-report';
import { OperationsReport } from '@app/shared/models/dto/analytics/operations-report';
import { PrimeCostReport } from '@app/shared/models/dto/analytics/prime-cost-report';

/**
 * One cache per analytics report, keyed off the shared period.
 *
 * `staleWhileRevalidate` keeps the previous report on screen while a refresh
 * runs, so changing the period or pressing refresh never blanks the section
 * (P2-FE-AN-11: refresh preserves state). Operations also loads the previous
 * equivalent range so the KPI strip can show a real comparison.
 *
 * Failures are normalized to `AnalyticsRequestError` so the screen can still
 * read the status (403) and the RFC 7807 `detail`.
 */
@Injectable({ providedIn: 'root' })
export class AnalyticsCache {
  private readonly api = inject(Analytics);
  private readonly period = inject(AnalyticsPeriodState);

  readonly primeCost = new ResourceCache<PrimeCostReport>(
    () => {
      const selection = this.period.period();
      return wrap(this.api.getPrimeCost(selection.bucket, selection.from, selection.to));
    },
    { ttlMs: 600_000, staleWhileRevalidate: true },
  );

  readonly menuEngineering = new ResourceCache<MenuEngineeringReport>(
    () => {
      const selection = this.period.period();
      return wrap(this.api.getMenuEngineering(selection.bucket, selection.from, selection.to));
    },
    { ttlMs: 1_800_000, staleWhileRevalidate: true },
  );

  readonly operations = new ResourceCache<OperationsReport>(
    () => {
      const selection = this.period.period();
      return wrap(this.api.getOperations(selection.bucket, selection.from, selection.to));
    },
    { ttlMs: 600_000, staleWhileRevalidate: true },
  );

  readonly operationsPrevious = new ResourceCache<OperationsReport>(
    () => {
      const selection = this.period.period();
      const previous = previousRange(selection.bucket, selection.from, selection.to);
      return wrap(this.api.getOperations(selection.bucket, previous.from, previous.to));
    },
    { ttlMs: 600_000, staleWhileRevalidate: true },
  );

  readonly cohort = new ResourceCache<CohortReport>(
    () => {
      const selection = this.period.period();
      return wrap(this.api.getCohort(selection.bucket, selection.from, selection.to));
    },
    { ttlMs: 600_000, staleWhileRevalidate: true },
  );

  /**
   * Runs the backend rebuild and then asks every mounted section to reload.
   * The revision bump happens on success and on failure: cached data stays
   * visible in both cases, and a failed rebuild can be retried.
   */
  refreshAll(months = 13): Observable<Record<string, unknown>> {
    return this.api.refreshAnalytics(months).pipe(
      finalize(() => {
        this.period.requestRevision();
      }),
    );
  }
}

function wrap<T>(source: Observable<T>): Observable<T> {
  return source.pipe(catchError((error: unknown) => throwError(() => toAnalyticsRequestError(error))));
}

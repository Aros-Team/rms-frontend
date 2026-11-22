import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { AlertsPage, AlertsQuery } from '@app/shared/models/dto/analytics/system-alert';
import { CohortReport } from '@app/shared/models/dto/analytics/cohort-report';
import { MenuEngineeringReport } from '@app/shared/models/dto/analytics/menu-engineering-report';
import { OperationsReport } from '@app/shared/models/dto/analytics/operations-report';
import { PrimeCostReport } from '@app/shared/models/dto/analytics/prime-cost-report';
import { TimeBucket } from '@app/shared/models/dto/analytics/time-bucket';
import { TopSellingProduct } from '@app/shared/models/dto/analytics/top-selling-product';

const ANALYTICS = 'v1/analytics';

/**
 * Typed client for the analytics surface.
 *
 * Every endpoint is admin-only. Responses are already unwrapped from the
 * `{data: …}` envelope by `envelopeInterceptor`, so the service types describe
 * the payload itself. Money is never converted here: it stays a `MoneyDto`
 * decimal string and the screens aggregate it with `analytics-money`.
 */
@Injectable({ providedIn: 'root' })
export class Analytics {
  private readonly http = inject(HttpClient);

  getPrimeCost(
    bucket: TimeBucket,
    from: string,
    to: string,
  ): Observable<PrimeCostReport> {
    return this.http.get<PrimeCostReport>(`${ANALYTICS}/prime-cost`, {
      params: periodParams(bucket, from, to),
    });
  }

  getMenuEngineering(
    bucket: TimeBucket,
    from: string,
    to: string,
    categoryId?: number,
  ): Observable<MenuEngineeringReport> {
    let params = periodParams(bucket, from, to);
    if (categoryId !== undefined) params = params.set('categoryId', String(categoryId));
    return this.http.get<MenuEngineeringReport>(`${ANALYTICS}/menu-engineering`, { params });
  }

  getOperations(bucket: TimeBucket, from: string, to: string): Observable<OperationsReport> {
    return this.http.get<OperationsReport>(`${ANALYTICS}/operations`, {
      params: periodParams(bucket, from, to),
    });
  }

  getCohort(bucket: TimeBucket, from: string, to: string): Observable<CohortReport> {
    return this.http.get<CohortReport>(`${ANALYTICS}/cohort`, {
      params: periodParams(bucket, from, to),
    });
  }

  getAlerts(query: AlertsQuery = {}): Observable<AlertsPage> {
    let params = new HttpParams();
    if (query.status !== undefined) params = params.set('status', query.status);
    if (query.severity !== undefined) params = params.set('severity', query.severity);
    if (query.bucket !== undefined) params = params.set('bucket', query.bucket);
    if (query.from !== undefined) params = params.set('from', query.from);
    if (query.to !== undefined) params = params.set('to', query.to);
    params = params.set('limit', String(query.limit ?? 50));
    params = params.set('offset', String(query.offset ?? 0));
    return this.http.get<AlertsPage>(`${ANALYTICS}/alerts`, { params });
  }

  /** Idempotent mark-read; the API answers 204 No Content. */
  markAlertRead(id: number): Observable<null> {
    return this.http.patch<null>(`${ANALYTICS}/alerts/${String(id)}/read`, null);
  }

  /** Rebuilds menu cache, prime-cost rollups and alerts on demand. */
  refreshAnalytics(months = 13): Observable<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>(`${ANALYTICS}/refresh`, null, {
      params: new HttpParams().set('months', String(months)),
    });
  }

  /**
   * Real ranking by units sold. `from` and `to` are concrete ISO dates
   * (`YYYY-MM-DD`), not bucket keys; the screen converts the selected period
   * with `rangeToDates`.
   */
  getTopSellingProducts(
    from: string,
    to: string,
    limit = 10,
  ): Observable<TopSellingProduct[]> {
    return this.http.get<TopSellingProduct[]>('v1/products/top-selling', {
      params: new HttpParams()
        .set('from', from)
        .set('to', to)
        .set('limit', String(limit)),
    });
  }
}

function periodParams(bucket: TimeBucket, from: string, to: string): HttpParams {
  return new HttpParams().set('bucket', bucket).set('from', from).set('to', to);
}

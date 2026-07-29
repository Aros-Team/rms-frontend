import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { AlertSeverity, AlertStatus, AlertsPage } from '@app/shared/models/dto/analytics/alert';
import { CohortReport } from '@app/shared/models/dto/analytics/cohort-report';
import { MenuEngineeringReport } from '@app/shared/models/dto/analytics/menu-engineering-report';
import { OperationsReport } from '@app/shared/models/dto/analytics/operations-report';
import { PrimeCostReport } from '@app/shared/models/dto/analytics/prime-cost-report';
import { TopSellingProduct } from '@app/shared/models/dto/analytics/top-selling-product';

const BUCKET = 'monthly' as const;

interface ListAlertsFilters {
  status?: AlertStatus;
  severity?: AlertSeverity;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

@Injectable({ providedIn: 'root' })
export class Analytics {
  private readonly http = inject(HttpClient);

  getPrimeCost(from: string, to: string): Observable<PrimeCostReport> {
    const params = new HttpParams().set('bucket', BUCKET).set('from', from).set('to', to);
    return this.http.get<PrimeCostReport>('v1/analytics/prime-cost', { params });
  }

  getMenuEngineering(
    from: string,
    to: string,
    categoryId?: number,
  ): Observable<MenuEngineeringReport> {
    let params = new HttpParams().set('bucket', BUCKET).set('from', from).set('to', to);
    if (categoryId !== undefined) params = params.set('categoryId', String(categoryId));
    return this.http.get<MenuEngineeringReport>('v1/analytics/menu-engineering', { params });
  }

  getOperations(from: string, to: string): Observable<OperationsReport> {
    const params = new HttpParams().set('bucket', BUCKET).set('from', from).set('to', to);
    return this.http.get<OperationsReport>('v1/analytics/operations', { params });
  }

  getCohort(from: string, to: string): Observable<CohortReport> {
    const params = new HttpParams().set('bucket', BUCKET).set('from', from).set('to', to);
    return this.http.get<CohortReport>('v1/analytics/cohort', { params });
  }

  listAlerts(filters: ListAlertsFilters = {}): Observable<AlertsPage> {
    let params = new HttpParams();
    if (filters.status) params = params.set('status', filters.status);
    if (filters.severity) params = params.set('severity', filters.severity);
    params = params.set('bucket', BUCKET);
    if (filters.from) params = params.set('from', filters.from);
    if (filters.to) params = params.set('to', filters.to);
    params = params.set('limit', String(filters.limit ?? 50));
    params = params.set('offset', String(filters.offset ?? 0));
    return this.http.get<AlertsPage>('v1/analytics/alerts', { params });
  }

  markAlertRead(id: number): Observable<void> {
    return this.http.patch<undefined>(`v1/analytics/alerts/${String(id)}/read`, {});
  }

  // Legacy — kept for any remaining consumers.
  getTopSellingProducts(): Observable<TopSellingProduct[]> {
    return this.http.get<TopSellingProduct[]>('v1/products/top-selling');
  }
}

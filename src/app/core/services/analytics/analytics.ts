import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { MenuEngineeringReport } from '@app/shared/models/dto/analytics/menu-engineering-report';
import { PrimeCostReport } from '@app/shared/models/dto/analytics/prime-cost-report';
import { TopSellingProduct } from '@app/shared/models/dto/analytics/top-selling-product';

const BUCKET = 'monthly' as const;

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

  // Legacy — kept for any remaining consumers.
  getTopSellingProducts(): Observable<TopSellingProduct[]> {
    return this.http.get<TopSellingProduct[]>('v1/products/top-selling');
  }
}

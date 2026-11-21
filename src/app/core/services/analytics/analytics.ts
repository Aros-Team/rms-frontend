import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { MenuEngineeringReport } from '@app/shared/models/dto/analytics/menu-engineering-report';
import { PrimeCostReport } from '@app/shared/models/dto/analytics/prime-cost-report';
import { TimeBucket } from '@app/shared/models/dto/analytics/time-bucket';
import { ProductResponse } from '@app/shared/models/dto/products/product-response';

const DEFAULT_BUCKET: TimeBucket = 'monthly';

@Injectable({ providedIn: 'root' })
export class Analytics {
  private readonly http = inject(HttpClient);

  getPrimeCost(from: string, to: string, bucket: TimeBucket = DEFAULT_BUCKET): Observable<PrimeCostReport> {
    const params = new HttpParams().set('bucket', bucket).set('from', from).set('to', to);
    return this.http.get<PrimeCostReport>('v1/analytics/prime-cost', { params });
  }

  getMenuEngineering(
    from: string,
    to: string,
    categoryId?: number,
    bucket: TimeBucket = DEFAULT_BUCKET,
  ): Observable<MenuEngineeringReport> {
    let params = new HttpParams().set('bucket', bucket).set('from', from).set('to', to);
    if (categoryId !== undefined) params = params.set('categoryId', String(categoryId));
    return this.http.get<MenuEngineeringReport>('v1/analytics/menu-engineering', { params });
  }

  /**
   * Legacy — `GET /v1/products/top-selling` returns the same `ProductResponse[]`
   * shape as the product list (currently always empty server-side).
   */
  getTopSellingProducts(): Observable<ProductResponse[]> {
    return this.http.get<ProductResponse[]>('v1/products/top-selling');
  }
}

import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { SupplyVariantResponse } from '@models/dto/supplies/supply-variant-response';
import { SupplyVariantCreateRequest } from '@models/dto/supplies/supply-variant-create-request';
import { SupplyCategoryResponse } from '@models/dto/supplies/supply-category-response';
import { SupplyCategoryCreateRequest } from '@models/dto/supplies/supply-category-create-request';
import { SupplyUnitResponse } from '@models/dto/supplies/supply-unit-response';
import { SupplyResponse } from '@models/dto/supplies/supply-response';
import { SupplyCreateRequest } from '@models/dto/supplies/supply-create-request';

@Injectable({ providedIn: 'root' })
export class Supply {
  private http = inject(HttpClient);

  public getSupplyVariants(): Observable<SupplyVariantResponse[]> {
    return this.http.get<SupplyVariantResponse[]>('v1/supplies/variants');
  }

  public getVariantsByCategory(categoryId: number): Observable<SupplyVariantResponse[]> {
    return this.http.get<SupplyVariantResponse[]>('v1/supplies/variants', {
      params: { categoryId },
    });
  }

  public createVariant(data: SupplyVariantCreateRequest): Observable<SupplyVariantResponse> {
    return this.http.post<SupplyVariantResponse>('v1/supplies/variants', data);
  }

  public getCategories(): Observable<SupplyCategoryResponse[]> {
    return this.http.get<SupplyCategoryResponse[]>('v1/supplies/categories');
  }

  public createCategory(data: SupplyCategoryCreateRequest): Observable<SupplyCategoryResponse> {
    return this.http.post<SupplyCategoryResponse>('v1/supplies/categories', data);
  }

  public getUnits(): Observable<SupplyUnitResponse[]> {
    return this.http.get<SupplyUnitResponse[]>('v1/supplies/units');
  }

  public getSupplies(): Observable<SupplyResponse[]> {
    return this.http.get<SupplyResponse[]>('v1/supplies');
  }

  public createSupply(data: SupplyCreateRequest): Observable<SupplyResponse> {
    return this.http.post<SupplyResponse>('v1/supplies', data);
  }
}
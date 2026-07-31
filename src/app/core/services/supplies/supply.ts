import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { SupplyVariantResponse } from '@models/dto/supplies/supply-variant-response';
import { SupplyVariantCreateRequest } from '@models/dto/supplies/supply-variant-create-request';
import { SupplyCategoryResponse } from '@models/dto/supplies/supply-category-response';
import { SupplyCategoryCreateRequest } from '@models/dto/supplies/supply-category-create-request';
import { SupplyUnitResponse } from '@models/dto/supplies/supply-unit-response';
import { SupplyResponse } from '@models/dto/supplies/supply-response';
import { SupplyCreateRequest } from '@models/dto/supplies/supply-create-request';

export interface PaginatedSuppliesResponse {
  content: SupplyVariantResponse[];
  totalElements: number;
  totalPages: number;
  page: number;
  size: number;
}

export interface PagedSuppliesApiResponse {
  content?: SupplyVariantResponse[];
  page?: { size: number; number: number; totalElements: number; totalPages: number };
}

@Injectable({ providedIn: 'root' })
export class Supply {
  private http = inject(HttpClient);

  public getSupplyVariants(): Observable<SupplyVariantResponse[]> {
    return this.http.get<SupplyVariantResponse[] | PagedSuppliesApiResponse>('v1/supplies/variants', {
      params: { size: '100' },
    }).pipe(
      map((res) => Array.isArray(res) ? res : (res.content ?? [])),
    );
  }

  public getSupplyVariantsPaginated(
    page = 0,
    size = 20
  ): Observable<PaginatedSuppliesResponse> {
    const params: Record<string, string> = { page: String(page), size: String(size) };
    return this.http.get<PagedSuppliesApiResponse>('v1/supplies/variants', { params }).pipe(
      map((res) => ({
        content: res.content ?? [],
        totalElements: res.page?.totalElements ?? 0,
        totalPages: res.page?.totalPages ?? 0,
        page: res.page?.number ?? 0,
        size: res.page?.size ?? 0,
      }))
    );
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
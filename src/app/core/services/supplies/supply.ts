import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { EMPTY, Observable, expand, map, reduce } from 'rxjs';

import { SupplyVariantResponse } from '@models/dto/supplies/supply-variant-response';
import { SupplyVariantCreateRequest } from '@models/dto/supplies/supply-variant-create-request';
import { SupplyCategoryResponse } from '@models/dto/supplies/supply-category-response';
import { SupplyCategoryCreateRequest } from '@models/dto/supplies/supply-category-create-request';
import { SupplyUnitResponse } from '@models/dto/supplies/supply-unit-response';
import { SupplyResponse } from '@models/dto/supplies/supply-response';
import { SupplyCreateRequest } from '@models/dto/supplies/supply-create-request';
import { type Page, type PageEnvelope, unwrapPage } from '@app/shared/models/dto/common/pagination';

/** The API rejects `size > 100`, so "load everything" has to walk pages. */
const SUPPLY_PAGE_SIZE = 100;

/** Bounds the walk if the backend ever reports a bogus `total` or ignores `page`. */
const MAX_SUPPLY_PAGES = 50;

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

  /**
   * Every supply variant with stock, walked page by page.
   *
   * `GET /v1/supplies/variants` is a Spring `Page` capped at `size=100`; asking
   * for a single page silently truncates the catalog once it grows past one
   * page. The walk stops on the last page or at `MAX_SUPPLY_PAGES`.
   */
  public getSupplyVariants(): Observable<SupplyVariantResponse[]> {
    return this.collectAllPages<SupplyVariantResponse>('v1/supplies/variants');
  }

  /**
   * Unwraps the Spring `Page<SupplyResponse>` returned by `GET /v1/supplies`.
   *
   * Returns every supply, not just the first page, so category filters and
   * pickers see the whole catalog.
   */
  public getSupplies(): Observable<SupplyResponse[]> {
    return this.collectAllPages<SupplyResponse>('v1/supplies');
  }

  private collectAllPages<T>(
    url: string,
    params: Record<string, string> = {},
  ): Observable<T[]> {
    const fetchPage = (page: number): Observable<Page<T>> =>
      this.http
        .get<PageEnvelope<T>>(url, {
          params: { ...params, page: String(page), size: String(SUPPLY_PAGE_SIZE) },
        })
        .pipe(map((res) => unwrapPage<T>(res)));

    return fetchPage(0).pipe(
      expand((page: Page<T>, index: number) => {
        const nextPage = index + 1;
        if (nextPage >= MAX_SUPPLY_PAGES) return EMPTY;
        if (page.items.length === 0) return EMPTY;
        // A short page is the last one, regardless of the reported metadata.
        if (page.items.length < SUPPLY_PAGE_SIZE) return EMPTY;
        if (page.totalPages > 0 && nextPage >= page.totalPages) return EMPTY;
        if (page.total > 0 && nextPage * SUPPLY_PAGE_SIZE >= page.total) return EMPTY;
        return fetchPage(nextPage);
      }),
      reduce((acc: T[], page: Page<T>) => [...acc, ...page.items], []),
    );
  }

  public getSupplyVariantsPaginated(
    page = 0,
    size = 20,
    search?: string,
  ): Observable<PaginatedSuppliesResponse> {
    const params: Record<string, string> = { page: String(page), size: String(size) };
    if (search) {
      params['search'] = search;
    }
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

  public createSupply(data: SupplyCreateRequest): Observable<SupplyResponse> {
    return this.http.post<SupplyResponse>('v1/supplies', data);
  }
}
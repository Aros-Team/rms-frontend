import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { ProductCreateRequest, ProductOptionCreateRequest } from '@app/shared/models/dto/products/product-create-request';
import { ProductResponse } from '@app/shared/models/dto/products/product-response';
import { ProductListResponse } from '@app/shared/models/dto/products/product-list-response';
import { ProductUpdateRequest } from '@app/shared/models/dto/products/product-update-request';
import { ProductOption } from '@app/shared/models/dto/products/product-option';
import { ProductCostResponse } from '@app/shared/models/dto/products/product-cost-response';
import { ProductCostBreakdownResponse } from '@app/shared/models/dto/products/product-cost-breakdown-response';
import { type PageEnvelope, unwrapPage } from '@app/shared/models/dto/common/pagination';
import { Observable, catchError, map, of } from 'rxjs';
import { toAmount } from '@app/shared/models/dto/common/money';

/** `GET /v1/products` always answers with a Spring page envelope (`{ content, page }`). */
export interface PaginatedProductsResponse {
  content: ProductResponse[];
  totalElements: number;
  totalPages: number;
  page: number;
  size: number;
}

export interface PagedProductsApiResponse {
  content?: ProductResponse[];
  page?: { size: number; number: number; totalElements: number; totalPages: number };
}

/** API maximum accepted by `GET /v1/products?size`. */
const MAX_PAGE_SIZE = 100;

export interface PreparationArea {
  id: number;
  name: string;
  products: string[] | null;
}

export interface Category {
  id: number;
  name: string;
  products: string[] | null;
}

export interface ProductData {
  id: number;
  name: string;
  basePrice: number;
  active: boolean;
  categoryId: number;
  categoryName: string;
  areaId: number;
  quantity: number | null;
  observations: string | null;
}
@Injectable({
  providedIn: 'root',
})
export class Product {
  private http = inject(HttpClient);

  /**
   * Fetches the first page of products and flattens the page envelope into a
   * plain array. `GET /v1/products` is paginated: without an explicit `size`
   * the API returns only 20 items, so consumers that need "all" products ask
   * for the API maximum.
   */
  private listAll<T>(params: Record<string, string> = {}): Observable<T[]> {
    const query = { ...params, page: '0', size: String(MAX_PAGE_SIZE) };
    return this.http
      .get<PageEnvelope<T>>('v1/products', { params: query })
      .pipe(map((res) => unwrapPage<T>(res).items));
  }

  public getProducts(includeSelections?: boolean): Observable<ProductResponse[]> {
    return this.listAll<ProductResponse>(includeSelections ? { includeSelections: 'true' } : {});
  }

  public getProductsPaginated(page = 0, size = 20, includeInactive = false, includeSelections?: boolean, search?: string): Observable<PaginatedProductsResponse> {
    let params: Record<string, string> = {
      page: String(page),
      size: String(size),
      includeInactive: String(includeInactive),
    };
    if (includeSelections) {
      params = { ...params, includeSelections: 'true' };
    }
    if (search) {
      params = { ...params, search };
    }
    return this.http.get<PagedProductsApiResponse>('v1/products', { params }).pipe(
      map((res) => ({
        content: res.content ?? [],
        totalElements: res.page?.totalElements ?? 0,
        totalPages: res.page?.totalPages ?? 0,
        page: res.page?.number ?? 0,
        size: res.page?.size ?? 0,
      }))
    );
  }

  public getAllProducts(includeSelections?: boolean): Observable<ProductListResponse[]> {
    return this.listAll<ProductListResponse>(includeSelections ? { includeSelections: 'true' } : {});
  }

  /** Flattens the page envelope; `categories` is a comma-separated `List<Long>` filter. */
  public filterByCategories(categories: number[]): Observable<ProductResponse[]> {
    return this.listAll<ProductResponse>({ categories: categories.join(',') });
  }

  public createProduct(data: ProductCreateRequest): Observable<ProductResponse> {
    return this.http.post<ProductResponse>('v1/products', data);
  }

  public createProductOption(data: ProductOptionCreateRequest): Observable<object> {
    return this.http.post('v1/product-options', data);
  }

  public updateProduct(id: number, data: ProductUpdateRequest): Observable<object> {
    return this.http.put('v1/products/' + String(id), data);
  }

  public findProduct(id: number): Observable<ProductResponse> {
    return this.http.get<ProductResponse>('v1/products/' + String(id));
  }

  public getCost(productId: number): Observable<ProductCostResponse> {
    return this.http.get<ProductCostResponse>('v1/products/' + String(productId) + '/cost');
  }

  public getCostBreakdown(productId: number): Observable<ProductCostBreakdownResponse> {
    return this.http.get<ProductCostBreakdownResponse>('v1/products/' + String(productId) + '/cost-breakdown');
  }

  public disableProduct(id: number): Observable<object> {
    return this.http.put('v1/products/' + String(id) + '/disable', {});
  }

  public enableProduct(id: number): Observable<object> {
    return this.http.put('v1/products/' + String(id) + '/enable', {});
  }

  getProductById(id: number): Observable<ProductData | undefined> {
    return this.findProduct(id).pipe(
      map((product: ProductResponse) => ({
        id: product.id,
        name: product.name,
        basePrice: toAmount(product.basePrice),
        active: product.active,
        categoryId: product.categoryId,
        categoryName: product.categoryName,
        areaId: product.areaId,
        quantity: null,
        observations: null
      } as ProductData)),
      catchError(() => of(undefined))
    );
  }

  getProductsByCategories(categoryIds: number[], includeSelections?: boolean): Observable<ProductResponse[]> {
    if (categoryIds.length === 0) {
      return this.getProducts(includeSelections);
    }
    const params: Record<string, string> = { categories: categoryIds.join(',') };
    if (includeSelections) {
      params['includeSelections'] = 'true';
    }
    return this.listAll<ProductResponse>(params);
  }

  public getOptions(productId: number): Observable<ProductOption[]> {
    return this.http.get<ProductOption[]>('v1/products/' + String(productId) + '/options');
  }

}

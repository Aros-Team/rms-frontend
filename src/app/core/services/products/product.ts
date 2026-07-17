import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { ProductCreateRequest, ProductOptionCreateRequest } from '@app/shared/models/dto/products/product-create-request';
import { ProductResponse } from '@app/shared/models/dto/products/product-response';
import { ProductListResponse } from '@app/shared/models/dto/products/product-list-response.model';
import { ProductUpdateRequest } from '@app/shared/models/dto/products/product-update-request';
import { ProductOption } from '@app/shared/models/dto/products/product-option.model';
import { Observable, catchError, map, of } from 'rxjs';

export interface PaginatedProductsResponse {
  content: ProductResponse[];
  totalElements: number;
  totalPages: number;
  page: number;
  size: number;
}

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

  public getProducts(includeSelections?: boolean): Observable<ProductResponse[]> {
    if (includeSelections) {
      return this.http.get<ProductResponse[]>('v1/products', { params: { includeSelections: 'true' } });
    }
    return this.http.get<ProductResponse[]>('v1/products');
  }

  public getProductsPaginated(page = 0, size = 20, includeInactive = false, includeSelections?: boolean): Observable<PaginatedProductsResponse> {
    let params: Record<string, string> = {
      page: String(page),
      size: String(size),
      includeInactive: String(includeInactive),
    };
    if (includeSelections) {
      params = { ...params, includeSelections: 'true' };
    }
    return this.http.get<PaginatedProductsResponse>('v1/products', { params });
  }

  public getAllProducts(includeSelections?: boolean): Observable<ProductListResponse[]> {
    if (includeSelections) {
      return this.http.get<ProductListResponse[]>('v1/products', { params: { includeSelections: 'true' } });
    }
    return this.http.get<ProductListResponse[]>('v1/products');
  }

  public filterByCategories(categories: number[]) {
    return this.http.get<ProductResponse[]>('v1/products', {
      params: { categories: categories.join(',') },
    });
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

  public disableProduct(id: number): Observable<object> {
    return this.http.put('v1/products/' + String(id) + '/disable', {});
  }

  getProductById(id: number): Observable<ProductData | undefined> {
    return this.findProduct(id).pipe(
      map((product: ProductResponse) => ({
        id: product.id,
        name: product.name,
        basePrice: product.basePrice,
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
    return this.http.get<ProductResponse[]>('v1/products', { params });
  }

  public getOptions(productId: number): Observable<ProductOption[]> {
    return this.http.get<ProductOption[]>('v1/products/' + String(productId) + '/options');
  }

  public deleteProduct(id: number): Observable<object> {
    return this.http.delete('v1/products/' + String(id));
  }
}
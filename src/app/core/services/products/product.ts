import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { ProductCreateRequest, ProductOptionCreateRequest } from '@app/shared/models/dto/products/product-create-request';
import { ProductResponse } from '@app/shared/models/dto/products/product-response';
import { ProductListResponse } from '@app/shared/models/dto/products/product-list-response.model';
import { ProductUpdateRequest } from '@app/shared/models/dto/products/product-update-request';
import { ProductOption } from '@app/shared/models/dto/products/product-option.model';
import { catchError, map, Observable, of } from 'rxjs';

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

export interface Product {
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

  public getProducts(): Observable<ProductResponse[]> {
    return this.http.get<ProductResponse[]>('v1/products');
  }

  public getAllProducts(): Observable<ProductListResponse[]> {
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
    return this.http.put(`v1/products/${id}`, data);
  }

  public findProduct(id: number): Observable<ProductResponse> {
    return this.http.get<ProductResponse>(`v1/products/${id}`);
  }

  public disableProduct(id: number): Observable<object> {
    return this.http.put(`v1/products/${id}/disable`, {});
  }

  getProductById(id: number): Observable<Product | undefined> {
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
      } as Product)),
      catchError(() => of(undefined))
    );
  }

  getProductsByCategories(categoryIds: number[]): Observable<ProductResponse[]> {
    if (!categoryIds || categoryIds.length === 0) {
      return this.getProducts();
    }
    return this.http.get<ProductResponse[]>('v1/products', {
      params: { categories: categoryIds.join(',') }
    });
  }

  public getOptions(productId: number): Observable<ProductOption[]> {
    return this.http.get<ProductOption[]>(`v1/products/${productId}/options`);
  }
}
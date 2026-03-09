import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Product } from '../../../core/products/domain/models/product.model';
import { CreateProductDto, ProductsRepositoryPort } from '../../../core/products/application/ports/output/products.repository.port';

@Injectable({ providedIn: 'root' })
export class ProductsHttpRepository implements ProductsRepositoryPort {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/v1/products';

  getAll(): Observable<Product[]> {
    return this.http.get<Product[]>(this.baseUrl);
  }

  getById(id: number): Observable<Product> {
    return this.http.get<Product>(`${this.baseUrl}/${id}`);
  }

  create(dto: CreateProductDto): Observable<Product> {
    return this.http.post<Product>(this.baseUrl, dto);
  }

  update(id: number, dto: CreateProductDto): Observable<Product> {
    return this.http.put<Product>(`${this.baseUrl}/${id}`, dto);
  }

  disable(id: number): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/${id}/disable`, {});
  }
}
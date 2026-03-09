import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Category } from '../../../core/products/domain/models/category.model';
import { CategoryRepositoryPort } from '../../../core/products/application/ports/output/category.repository.port';

@Injectable({ providedIn: 'root' })
export class CategoriesHttpRepository implements CategoryRepositoryPort {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/v1/categories';

  getAll(): Observable<Category[]> {
    return this.http.get<Category[]>(this.baseUrl);
  }

  getById(id: number): Observable<Category> {
    return this.http.get<Category>(`${this.baseUrl}/${id}`);
  }
}
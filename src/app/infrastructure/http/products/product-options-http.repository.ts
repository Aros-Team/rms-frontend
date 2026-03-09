import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ProductOption, OptionCategory } from '../../../core/products/domain/models/product-option.model';
import { ProductOptionsRepositoryPort } from '../../../core/products/application/ports/output/product-options.repository.port';

@Injectable({ providedIn: 'root' })
export class ProductOptionsHttpRepository implements ProductOptionsRepositoryPort {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/v1';

  getOptions(): Observable<ProductOption[]> {
    return this.http.get<ProductOption[]>(`${this.baseUrl}/product-options`);
  }

  getOptionCategories(): Observable<OptionCategory[]> {
    return this.http.get<OptionCategory[]>(`${this.baseUrl}/option-categories`);
  }
}
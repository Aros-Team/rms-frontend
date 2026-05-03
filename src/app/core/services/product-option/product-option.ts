import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ProductOptionRequest, ProductOptionResponse } from '@app/shared/models/dto/products/product-option.model';

@Injectable({
  providedIn: 'root',
})
export class ProductOptionService {
  private http = inject(HttpClient);

  public getOptions(): Observable<ProductOptionResponse[]> {
    return this.http.get<ProductOptionResponse[]>('v1/product-options');
  }

  public getOption(id: number): Observable<ProductOptionResponse> {
    return this.http.get<ProductOptionResponse>(`v1/product-options/${String(id)}`);
  }

  public createOption(data: ProductOptionRequest): Observable<ProductOptionResponse> {
    return this.http.post<ProductOptionResponse>('v1/product-options', data);
  }

  public updateOption(id: number, data: ProductOptionRequest): Observable<ProductOptionResponse> {
    return this.http.put<ProductOptionResponse>(`v1/product-options/${String(id)}`, data);
  }
}
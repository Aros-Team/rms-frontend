import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { TopSellingProduct } from '@app/shared/models/dto/analytics/top-selling-product.model';

@Injectable({
  providedIn: 'root'
})
export class Analytics {
  private http = inject(HttpClient);

  public getTopSellingProducts(): Observable<TopSellingProduct[]> {
    return this.http.get<TopSellingProduct[]>('v1/products/top-selling');
  }
}
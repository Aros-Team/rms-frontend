import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { PurchaseResponse } from '@models/dto/purchases/purchase-response';
import { PurchaseCreateRequest } from '@models/dto/purchases/purchase-create-request';

@Injectable({ providedIn: 'root' })
export class Purchase {
  private http = inject(HttpClient);

  public getPurchases(): Observable<PurchaseResponse[]> {
    return this.http.get<PurchaseResponse[]>('v1/purchases');
  }

  public getPurchaseById(id: number): Observable<PurchaseResponse> {
    return this.http.get<PurchaseResponse>(`v1/purchases/${String(id)}`);
  }

  public createPurchase(data: PurchaseCreateRequest): Observable<PurchaseResponse> {
    return this.http.post<PurchaseResponse>('v1/purchases', data);
  }
}
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { SupplierResponse } from '@models/dto/suppliers/supplier-response';
import { SupplierCreateRequest } from '@models/dto/suppliers/supplier-create-request';
import { SupplierUpdateRequest } from '@models/dto/suppliers/supplier-update-request';

@Injectable({ providedIn: 'root' })
export class Supplier {
  private http = inject(HttpClient);

  public getSuppliers(search?: string): Observable<SupplierResponse[]> {
    let params = new HttpParams();
    if (search) {
      params = params.set('search', search);
    }
    return this.http.get<SupplierResponse[]>('v1/suppliers', { params });
  }

  public createSupplier(data: SupplierCreateRequest): Observable<SupplierResponse> {
    return this.http.post<SupplierResponse>('v1/suppliers', data);
  }

  public updateSupplier(id: number, data: SupplierUpdateRequest): Observable<SupplierResponse> {
    return this.http.put<SupplierResponse>(`v1/suppliers/${String(id)}`, data);
  }
}
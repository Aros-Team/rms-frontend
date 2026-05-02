import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { SupplierResponse } from '@models/dto/suppliers/supplier-response';
import { SupplierCreateRequest } from '@models/dto/suppliers/supplier-create-request';
import { SupplierUpdateRequest } from '@models/dto/suppliers/supplier-update-request';

@Injectable({ providedIn: 'root' })
export class Supplier {
  private http = inject(HttpClient);

  public getSuppliers(): Observable<SupplierResponse[]> {
    return this.http.get<SupplierResponse[]>('v1/suppliers');
  }

  public createSupplier(data: SupplierCreateRequest): Observable<SupplierResponse> {
    return this.http.post<SupplierResponse>('v1/suppliers', data);
  }

  public updateSupplier(id: number, data: SupplierUpdateRequest): Observable<SupplierResponse> {
    return this.http.put<SupplierResponse>(`v1/suppliers/${id}`, data);
  }
}
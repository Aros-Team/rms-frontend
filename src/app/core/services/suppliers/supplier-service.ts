import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { SupplierResponse } from '@models/dto/suppliers/supplier-response';
import { SupplierCreateRequest } from '@models/dto/suppliers/supplier-create-request';

@Injectable({ providedIn: 'root' })
export class SupplierService {
  private http = inject(HttpClient);

  public getSuppliers(): Observable<SupplierResponse[]> {
    return this.http.get<SupplierResponse[]>('v1/suppliers');
  }

  public createSupplier(data: SupplierCreateRequest): Observable<SupplierResponse> {
    return this.http.post<SupplierResponse>('v1/suppliers', data);
  }
}

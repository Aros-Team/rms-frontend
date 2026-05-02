import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { TransferRequest } from '@models/dto/inventory/transfer-request';
import { TransferResponse } from '@models/dto/inventory/transfer-response';

@Injectable({ providedIn: 'root' })
export class InventoryService {
  private http = inject(HttpClient);

  public transferToKitchen(data: TransferRequest): Observable<TransferResponse[]> {
    return this.http.post<TransferResponse[]>('v1/inventory/transfer', data);
  }
}
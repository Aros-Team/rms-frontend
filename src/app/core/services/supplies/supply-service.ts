import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { SupplyVariantResponse } from '@models/dto/supplies/supply-variant-response';

@Injectable({ providedIn: 'root' })
export class SupplyService {
  private http = inject(HttpClient);

  public getSupplyVariants(): Observable<SupplyVariantResponse[]> {
    return this.http.get<SupplyVariantResponse[]>('v1/supplies/variants');
  }
}

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Area } from '../../../core/products/domain/models/area.model';
import { AreaRepositoryPort } from '../../../core/products/application/ports/output/area.repository.port';

@Injectable({ providedIn: 'root' })
export class AreasHttpRepository implements AreaRepositoryPort {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/v1/areas';

  getAll(): Observable<Area[]> {
    return this.http.get<Area[]>(this.baseUrl);
  }

  getById(id: number): Observable<Area> {
    return this.http.get<Area>(`${this.baseUrl}/${id}`);
  }
}
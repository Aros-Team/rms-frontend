import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Table } from '../../../core/tables/domain/models/table.model';
import { TableRequest, ChangeStatusRequest } from '../../../core/tables/domain/models/table-request.model';
import { TablesRepositoryPort } from '../../../core/tables/application/ports/output/tables.repository.port';

@Injectable({ providedIn: 'root' })
export class TablesHttpRepository implements TablesRepositoryPort {
  private http = inject(HttpClient);
  private baseUrl = '/api/v1/tables';

  getTables(): Observable<Table[]> {
    return this.http.get<Table[]>(this.baseUrl);
  }

  getTableById(id: number): Observable<Table> {
    return this.http.get<Table>(`${this.baseUrl}/${id}`);
  }

  createTable(payload: TableRequest): Observable<Table> {
    return this.http.post<Table>(this.baseUrl, payload);
  }

  updateTable(id: number, payload: TableRequest): Observable<Table> {
    return this.http.put<Table>(`${this.baseUrl}/${id}`, payload);
  }

  changeTableStatus(id: number, payload: ChangeStatusRequest): Observable<Table> {
    return this.http.put<Table>(`${this.baseUrl}/${id}/status`, payload);
  }
}

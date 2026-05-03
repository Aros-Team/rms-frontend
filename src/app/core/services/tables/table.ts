import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { Observable, map } from "rxjs";
import { TableRequest, ChangeStatusRequest } from "@app/shared/models/dto/tables/table.model";
import { TableResponse } from "@app/shared/models/dto/tables/table-response.model";

@Injectable({
  providedIn: 'root',
})
export class Table {
  private http = inject(HttpClient);

  public getTables(): Observable<TableResponse[]> {
    return this.http.get<TableResponse[]>('v1/tables');
  }

  public getTableById(id: number): Observable<TableResponse> {
    return this.http.get<TableResponse>(`v1/tables/${String(id)}`);
  }

  public createTable(data: TableRequest): Observable<TableResponse> {
    return this.http.post<TableResponse>('v1/tables', data);
  }

  public updateTable(id: number, data: TableRequest): Observable<TableResponse> {
    return this.http.put<TableResponse>(`v1/tables/${String(id)}`, data);
  }

  public changeStatus(id: number, status: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED'): Observable<TableResponse> {
    return this.http.put<TableResponse>(`v1/tables/${String(id)}/status`, { status } as ChangeStatusRequest);
  }

  public getOccupiedTablesCount(): Observable<number> {
    return this.getTables().pipe(
      map(tables => tables.filter(t => t.status === 'OCCUPIED').length)
    );
  }

  public getTotalTablesCount(): Observable<number> {
    return this.getTables().pipe(
      map(tables => tables.length)
    );
  }
}
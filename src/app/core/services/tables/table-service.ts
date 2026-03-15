import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { TableResponse } from "@app/shared/models/dto/tables/table-response.model";

@Injectable({
  providedIn: 'root',
})
export class TableService {
  private http = inject(HttpClient);

  public getTables(): Observable<TableResponse[]> {
    return this.http.get<TableResponse[]>('v1/tables');
  }

  public getTableById(id: number): Observable<TableResponse> {
    return this.http.get<TableResponse>(`v1/tables/${id}`);
  }

  public createMultipleTables(total: number): Observable<object> {
    return this.http.post('v1/tables/create-multiple', { count: total });
  }

  public getTableAmount(): Observable<{ amount: number }> {
    return this.http.get<{ amount: number }>('v1/tables/get-amount');
  }
}

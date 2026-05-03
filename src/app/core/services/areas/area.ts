import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { Observable } from "rxjs";
import { AreaRequest, AreaResponse } from "@app/shared/models/dto/areas/area.model";

@Injectable({
  providedIn: 'root',
})
export class Area {
  private http = inject(HttpClient);

  public getAreas(): Observable<AreaResponse[]> {
    return this.http.get<AreaResponse[]>('v1/areas');
  }

  public getArea(id: number): Observable<AreaResponse> {
    return this.http.get<AreaResponse>(`v1/areas/${String(id)}`);
  }

  public createArea(data: AreaRequest): Observable<AreaResponse> {
    return this.http.post<AreaResponse>('v1/areas', data);
  }

  public updateArea(id: number, data: AreaRequest): Observable<AreaResponse> {
    return this.http.put<AreaResponse>(`v1/areas/${String(id)}`, data);
  }

  public toggleArea(id: number): Observable<AreaResponse> {
    return this.http.put<AreaResponse>(`v1/areas/${String(id)}/toggle`, {});
  }
}
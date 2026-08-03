import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { OptionGroupRequest, OptionGroupResponse } from '@app/shared/models/dto/option-groups/option-group';

@Injectable({
  providedIn: 'root',
})
export class OptionGroup {
  private http = inject(HttpClient);

  public getOptionGroups(search?: string): Observable<OptionGroupResponse[]> {
    let params = new HttpParams();
    if (search) {
      params = params.set('search', search);
    }
    return this.http.get<OptionGroupResponse[]>('v1/option-groups', { params });
  }

  public getProductOptionGroups(productId: number): Observable<OptionGroupResponse[]> {
    return this.http.get<OptionGroupResponse[]>('v1/option-groups', { params: { productId: String(productId) } });
  }

  public getOptionGroup(id: number): Observable<OptionGroupResponse> {
    return this.http.get<OptionGroupResponse>(`v1/option-groups/${String(id)}`);
  }

  public createOptionGroup(data: OptionGroupRequest): Observable<OptionGroupResponse> {
    return this.http.post<OptionGroupResponse>('v1/option-groups', data);
  }

  public updateOptionGroup(id: number, data: OptionGroupRequest): Observable<OptionGroupResponse> {
    return this.http.put<OptionGroupResponse>(`v1/option-groups/${String(id)}`, data);
  }
}

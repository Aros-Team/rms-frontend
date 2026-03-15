import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { OptionCategoryRequest, OptionCategoryResponse } from '@app/shared/models/dto/category/option-category.model';

@Injectable({
  providedIn: 'root',
})
export class OptionCategoryService {
  private http = inject(HttpClient);

  public getOptionCategories(): Observable<OptionCategoryResponse[]> {
    return this.http.get<OptionCategoryResponse[]>('v1/option-categories');
  }

  public getOptionCategory(id: number): Observable<OptionCategoryResponse> {
    return this.http.get<OptionCategoryResponse>(`v1/option-categories/${id}`);
  }

  public createOptionCategory(data: OptionCategoryRequest): Observable<OptionCategoryResponse> {
    return this.http.post<OptionCategoryResponse>('v1/option-categories', data);
  }

  public updateOptionCategory(id: number, data: OptionCategoryRequest): Observable<OptionCategoryResponse> {
    return this.http.put<OptionCategoryResponse>(`v1/option-categories/${id}`, data);
  }
}

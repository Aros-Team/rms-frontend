import { HttpClient, HttpParams } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { CategoryCreateRequest } from "@app/shared/models/dto/category/category-create-request";
import { CategorySimpleResponse } from "@app/shared/models/dto/category/category-simple-response";
import { Observable } from "rxjs";

@Injectable({
  providedIn: 'root'
})
export class Category {
  private http = inject(HttpClient);

  public getCategories(search?: string): Observable<CategorySimpleResponse[]> {
    let params = new HttpParams();
    if (search) {
      params = params.set('search', search);
    }
    return this.http.get<CategorySimpleResponse[]>('v1/categories', { params });
  }

  public createCategory(data: CategoryCreateRequest): Observable<object> {
    return this.http.post('v1/categories', data);
  }

  public toggleCategory(id: number): Observable<object> {
    return this.http.put(`v1/categories/${String(id)}/toggle`, {});
  }
}
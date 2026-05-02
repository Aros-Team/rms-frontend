import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { CategoryCreateRequest } from "@app/shared/models/dto/category/category-create-request";
import { CategorySimpleResponse } from "@app/shared/models/dto/category/category-simple-response";
import { Observable } from "rxjs";

@Injectable({
  providedIn: 'root'
})
export class Category {
  private http = inject(HttpClient);

  public getCategories(): Observable<CategorySimpleResponse[]> {
    return this.http.get<CategorySimpleResponse[]>('v1/categories');
  }

  public createCategory(data: CategoryCreateRequest): Observable<object> {
    return this.http.post('v1/categories', data);
  }

  public toggleCategory(id: number): Observable<object> {
    return this.http.put(`v1/categories/${id}/toggle`, {});
  }
}
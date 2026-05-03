import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { forkJoin, Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';

import { ProductListResponse } from '@app/shared/models/dto/products/product-list-response.model';
import { ProductOption, OptionCategory } from '@app/shared/models/dto/products/product-option.model';
import { TableResponse } from '@app/shared/models/dto/tables/table-response.model';

export interface MasterDataPayload {
  products: ProductListResponse[];
  productOptions: ProductOption[];
  optionCategories: OptionCategory[];
  tables: TableResponse[];
}

@Injectable({ providedIn: 'root' })
export class MasterData {
  private http = inject(HttpClient);

  private _data$ = new BehaviorSubject<MasterDataPayload | null>(null);
  readonly data$ = this._data$.asObservable();

  load(): Observable<MasterDataPayload> {
    return forkJoin({
      products: this.http.get<ProductListResponse[]>('v1/products'),
      productOptions: this.http.get<ProductOption[]>('v1/product-options'),
      optionCategories: this.http.get<OptionCategory[]>('v1/option-categories'),
      tables: this.http.get<TableResponse[]>('v1/tables'),
    }).pipe(
      tap(data => { this._data$.next(data); })
    );
  }

  reloadTables(): Observable<TableResponse[]> {
    return this.http.get<TableResponse[]>('v1/tables').pipe(
      tap(tables => {
        const current = this._data$.value;
        if (current) this._data$.next({ ...current, tables });
      })
    );
  }

  getProductOptions(productId: number): Observable<ProductOption[]> {
    return this.http.get<ProductOption[]>(`v1/products/${String(productId)}/options`);
  }

  groupOptionsByCategory(options: ProductOption[]): Record<string, ProductOption[]> {
    return options.reduce<Record<string, ProductOption[]>>((acc, opt) => {
      const key = opt.optionCategoryName;
      acc[key] ??= [];
      acc[key].push(opt);
      return acc;
    }, {});
  }

  get snapshot(): MasterDataPayload | null {
    return this._data$.value;
  }

  getAvailableTables(): TableResponse[] {
    return (this._data$.value?.tables ?? []).filter(t => t.status === 'AVAILABLE');
  }

  getAllTables(): TableResponse[] {
    return this._data$.value?.tables ?? [];
  }

  getActiveProducts(): ProductListResponse[] {
    return (this._data$.value?.products ?? []).filter(p => p.active);
  }

  getProductsByCategory(): Record<string, ProductListResponse[]> {
    const products = this.getActiveProducts();
    return products.reduce<Record<string, ProductListResponse[]>>((acc, p) => {
      const key = p.categoryName;
      acc[key] ??= [];
      acc[key].push(p);
      return acc;
    }, {});
  }
}
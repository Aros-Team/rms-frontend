import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { forkJoin, Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';

import { ProductListResponse } from '@app/shared/models/dto/products/product-list-response.model';
import { ProductOption, OptionCategory } from '@app/shared/models/dto/products/product-option.model';
import { TableResponse } from '@app/shared/models/dto/tables/table-response.model';

export interface MasterData {
  products: ProductListResponse[];
  productOptions: ProductOption[];
  optionCategories: OptionCategory[];
  tables: TableResponse[];
}

@Injectable({ providedIn: 'root' })
export class MasterDataService {
  private http = inject(HttpClient);

  private _data$ = new BehaviorSubject<MasterData | null>(null);
  readonly data$ = this._data$.asObservable();

  /** Carga todos los datos maestros en paralelo */
  load(): Observable<MasterData> {
    return forkJoin({
      products: this.http.get<ProductListResponse[]>('v1/products'),
      productOptions: this.http.get<ProductOption[]>('v1/product-options'),
      optionCategories: this.http.get<OptionCategory[]>('v1/option-categories'),
      tables: this.http.get<TableResponse[]>('v1/tables'),
    }).pipe(
      tap(data => this._data$.next(data))
    );
  }

  /** Recarga solo las mesas (después de crear una orden) */
  reloadTables(): Observable<TableResponse[]> {
    return this.http.get<TableResponse[]>('v1/tables').pipe(
      tap(tables => {
        const current = this._data$.value;
        if (current) this._data$.next({ ...current, tables });
      })
    );
  }

  /** Opciones específicas de un producto via API */
  getProductOptions(productId: number): Observable<ProductOption[]> {
    return this.http.get<ProductOption[]>(`v1/products/${productId}/options`);
  }

  /** Opciones agrupadas por categoría */
  groupOptionsByCategory(options: ProductOption[]): Record<string, ProductOption[]> {
    return options.reduce((acc, opt) => {
      const key = opt.optionCategoryName;
      if (!acc[key]) acc[key] = [];
      acc[key].push(opt);
      return acc;
    }, {} as Record<string, ProductOption[]>);
  }

  get snapshot(): MasterData | null {
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
    return products.reduce((acc, p) => {
      const key = p.categoryName;
      if (!acc[key]) acc[key] = [];
      acc[key].push(p);
      return acc;
    }, {} as Record<string, ProductListResponse[]>);
  }
}

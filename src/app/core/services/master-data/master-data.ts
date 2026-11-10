import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { forkJoin, Observable, BehaviorSubject } from 'rxjs';
import { map, tap } from 'rxjs/operators';

import { ProductListResponse } from '@app/shared/models/dto/products/product-list-response';
import { ProductOption } from '@app/shared/models/dto/products/product-option';
import { TableResponse } from '@app/shared/models/dto/tables/table-response';
import { type PageEnvelope, unwrapPage } from '@app/shared/models/dto/common/pagination';

export interface MasterDataPayload {
  products: ProductListResponse[];
  productOptions: ProductOption[];
  tables: TableResponse[];
}

@Injectable({ providedIn: 'root' })
export class MasterData {
  private http = inject(HttpClient);

  private _data$ = new BehaviorSubject<MasterDataPayload | null>(null);
  readonly data$ = this._data$.asObservable();

  load(): Observable<MasterDataPayload> {
    return forkJoin({
      // `/v1/products` answers with Spring HATEOAS (`{ content, page }`), but
      // `unwrapPage` also tolerates `{ items }` and bare arrays, so this keeps
      // working regardless of which dialect the endpoint settles on.
      products: this.http
        .get<PageEnvelope<ProductListResponse>>('v1/products?page=0&size=100')
        .pipe(map((res) => unwrapPage<ProductListResponse>(res).items)),
      productOptions: this.http
        .get<PageEnvelope<ProductOption>>('v1/product-options')
        .pipe(map((res) => unwrapPage<ProductOption>(res).items)),
      tables: this.http
        .get<PageEnvelope<TableResponse>>('v1/tables')
        .pipe(map((res) => unwrapPage<TableResponse>(res).items)),
    }).pipe(
      tap(data => {
        this._data$.next({
          products: Array.isArray(data.products) ? data.products : [],
          productOptions: Array.isArray(data.productOptions) ? data.productOptions : [],
          tables: Array.isArray(data.tables) ? data.tables : [],
        });
      })
    );
  }

  reloadTables(): Observable<TableResponse[]> {
    return this.http.get<PageEnvelope<TableResponse>>('v1/tables').pipe(
      map((res) => unwrapPage<TableResponse>(res).items),
      tap(tables => {
        const current = this._data$.value;
        if (current) this._data$.next({ ...current, tables });
      })
    );
  }

  /**
   * Applies a single table update from WebSocket directly into the in-memory
   * snapshot without making an HTTP request.
   */
  applyTableUpdate(updated: TableResponse): void {
    const current = this._data$.value;
    if (!current) return;
    const tables = current.tables.map(t => t.id === updated.id ? { ...t, ...updated } : t);
    this._data$.next({ ...current, tables });
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
    const tables = this._data$.value?.tables;
    return Array.isArray(tables) ? tables.filter(t => t.status === 'AVAILABLE') : [];
  }

  getAllTables(): TableResponse[] {
    const tables = this._data$.value?.tables;
    return Array.isArray(tables) ? tables : [];
  }

  getActiveProducts(): ProductListResponse[] {
    const products = this._data$.value?.products;
    return Array.isArray(products) ? products.filter(p => p.active) : [];
  }

  getProductsByCategory(): Record<string, ProductListResponse[]> {
    const products = this.getActiveProducts();
    if (products.length === 0) return {};
    return products.reduce<Record<string, ProductListResponse[]>>((acc, p) => {
      const key = p.categoryName;
      acc[key] ??= [];
      acc[key].push(p);
      return acc;
    }, {});
  }
}

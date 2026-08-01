import { Injectable, inject, OnDestroy } from '@angular/core';
import { forkJoin, map, Subscription } from 'rxjs';
import { ResourceCache } from '@app/core/cache/resource-cache/resource-cache';
import { Product } from '@app/core/services/products/product';
import { Area } from '@app/core/services/areas/area';
import { Category } from '@app/core/services/category/category';
import { OptionCategory } from '@app/core/services/option-category/option-category';
import { Supply } from '@app/core/services/supplies/supply';
import { ProductOption } from '@app/core/services/product-option/product-option';
import { ProductResponse } from '@app/shared/models/dto/products/product-response';
import { PaginatedProductsResponse } from '@app/core/services/products/product';
import { AreaSimpleResponse } from '@app/shared/models/dto/areas/area-simple-response';
import { CategorySimpleResponse } from '@app/shared/models/dto/category/category-simple-response';
import { OptionCategoryResponse } from '@app/shared/models/dto/category/option-category';
import { SupplyVariantResponse } from '@app/shared/models/dto/supplies/supply-variant-response';
import { ProductOptionResponse } from '@app/shared/models/dto/products/product-option';
import { WebSocket } from '@app/core/services/websocket/websocket';

export interface ProductReferenceData {
  areas: AreaSimpleResponse[];
  categories: CategorySimpleResponse[];
  optionCategories: OptionCategoryResponse[];
  variants: (SupplyVariantResponse & { displayName: string })[];
  productOptions: ProductOptionResponse[];
}

@Injectable({ providedIn: 'root' })
export class ProductCache implements OnDestroy {
  private readonly productService = inject(Product);
  private readonly areaService = inject(Area);
  private readonly categoryService = inject(Category);
  private readonly optionCategoryService = inject(OptionCategory);
  private readonly supplyService = inject(Supply);
  private readonly productOptionService = inject(ProductOption);
  private readonly wsService = inject(WebSocket);

  private cacheInvalidationSubscription: Subscription;

  // Lista de productos - ahora paginada (la página/tamaño se configuran por componente)
  private productListParams: { page: number; size: number; includeInactive: boolean; search?: string } = { page: 0, size: 6, includeInactive: false };

  readonly products = new ResourceCache<PaginatedProductsResponse>(
    () => this.productService.getProductsPaginated(this.productListParams.page, this.productListParams.size, this.productListParams.includeInactive, undefined, this.productListParams.search),
    { ttlMs: 10 * 60 * 1000, staleWhileRevalidate: true }
  );

  // Datos de referencia - solo carga bajo demanda, TTL largo (30 min)
  readonly referenceData = new ResourceCache<ProductReferenceData>(
    () => forkJoin({
      areas: this.areaService.getAreas(),
      categories: this.categoryService.getCategories(),
      optionCategories: this.optionCategoryService.getOptionCategories(),
      variants: this.supplyService.getSupplyVariants(),
      productOptions: this.productOptionService.getOptions()
    }).pipe(
      map(({ areas, categories, optionCategories, variants, productOptions }) => ({
        areas,
        categories: categories.filter(c => c.enabled),
        optionCategories,
        variants: variants.map(v => ({
          ...v,
          displayName: `${v.supplyName} — ${String(v.quantity)} ${v.unitAbbreviation}`
        })),
        productOptions
      }))
    ),
    { ttlMs: 30 * 60 * 1000, staleWhileRevalidate: true }
  );

  // Detalle de producto - caché por ID, TTL medio (5 min)
  private detailCaches = new Map<number, ResourceCache<ProductResponse>>();

  constructor() {
    this.cacheInvalidationSubscription = this.wsService.cacheInvalidation$.subscribe((event) => {
      if (event.resource === 'products') {
        this.invalidateProductList();
      }
    });
  }

  getProductDetail(id: number): ResourceCache<ProductResponse> {
    let cache = this.detailCaches.get(id);
    if (!cache) {
      cache = new ResourceCache<ProductResponse>(
        () => this.productService.findProduct(id),
        { ttlMs: 5 * 60 * 1000, staleWhileRevalidate: true }
      );
      this.detailCaches.set(id, cache);
    }
    return cache;
  }

  /** Cambia la página/tamaño de la lista de productos y vuelve a consultarla al servidor. */
  setProductListParams(params: { page?: number; size?: number; includeInactive?: boolean; search?: string }): void {
    this.productListParams = { ...this.productListParams, ...params };
    this.products.reset();
    this.products.load();
  }

  invalidateProductList(): void {
    this.products.invalidate();
  }

  invalidateAll(): void {
    this.products.invalidate();
    this.referenceData.invalidate();
    this.detailCaches.clear();
  }

  ngOnDestroy(): void {
    this.cacheInvalidationSubscription.unsubscribe();
  }
}

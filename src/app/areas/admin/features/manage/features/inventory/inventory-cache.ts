import { Injectable, inject } from '@angular/core';
import { forkJoin } from 'rxjs';
import { ResourceCache } from '@app/core/cache/resource-cache/resource-cache';
import { Inventory } from '@app/core/services/inventory/inventory';
import { Supplier } from '@app/core/services/suppliers/supplier';
import { Supply, PaginatedSuppliesResponse } from '@app/core/services/supplies/supply';
import { Purchase } from '@app/core/services/purchases/purchase';
import { SupplyVariantResponse } from '@app/shared/models/dto/supplies/supply-variant-response';
import { SupplyCategoryResponse } from '@app/shared/models/dto/supplies/supply-category-response';
import { SupplierResponse } from '@app/shared/models/dto/suppliers/supplier-response';
import { PurchaseResponse } from '@app/shared/models/dto/purchases/purchase-response';
import { SupplyUnitResponse } from '@app/shared/models/dto/supplies/supply-unit-response';
import { SupplyResponse } from '@app/shared/models/dto/supplies/supply-response';

export interface InventoryReferenceData {
  categories: SupplyCategoryResponse[];
  units: SupplyUnitResponse[];
  allSupplies: SupplyResponse[];
}

@Injectable({ providedIn: 'root' })
export class InventoryCache {
  private readonly inventoryService = inject(Inventory);
  private readonly supplierService = inject(Supplier);
  private readonly supplyService = inject(Supply);
  private readonly purchaseService = inject(Purchase);

  // Lista completa de insumos (para warning de costo cero, picker de compra y transferencia)
  readonly supplies = new ResourceCache<SupplyVariantResponse[]>(
    () => this.supplyService.getSupplyVariants(),
    { ttlMs: 2 * 60 * 1000, staleWhileRevalidate: true }
  );

  // Lista paginada de insumos - la página/tamaño se configuran por componente
  private supplyListParams: { page: number; size: number; search?: string } = { page: 0, size: 20 };
  private suppliersParams: { search?: string } = {};
  private purchasesParams: { search?: string } = {};

  readonly suppliesPage = new ResourceCache<PaginatedSuppliesResponse>(
    () => this.supplyService.getSupplyVariantsPaginated(
      this.supplyListParams.page,
      this.supplyListParams.size,
      this.supplyListParams.search,
    ),
    { ttlMs: 10 * 60 * 1000, staleWhileRevalidate: true }
  );

  // Suppliers - TTL largo (30 min), con búsqueda server-side
  readonly suppliers = new ResourceCache<SupplierResponse[]>(
    () => this.supplierService.getSuppliers(this.suppliersParams.search),
    { ttlMs: 30 * 60 * 1000, staleWhileRevalidate: true }
  );

  // Purchases - TTL medio (5 min), con búsqueda server-side
  readonly purchases = new ResourceCache<PurchaseResponse[]>(
    () => this.purchaseService.getPurchases(this.purchasesParams.search),
    { ttlMs: 5 * 60 * 1000, staleWhileRevalidate: true }
  );

  // Datos de referencia - solo bajo demanda, TTL largo (30 min)
  readonly referenceData = new ResourceCache<InventoryReferenceData>(
    () => forkJoin({
      categories: this.supplyService.getCategories(),
      units: this.supplyService.getUnits(),
      allSupplies: this.supplyService.getSupplies()
    }),
    { ttlMs: 30 * 60 * 1000, staleWhileRevalidate: true }
  );

  /** Cambia la página/tamaño de la lista de insumos y vuelve a consultarla al servidor. */
  setSuppliesListParams(params: { page?: number; size?: number; search?: string }): void {
    this.supplyListParams = { ...this.supplyListParams, ...params };
    this.suppliesPage.reset();
    this.suppliesPage.load();
  }

  setSuppliersListParams(params: { search?: string }): void {
    this.suppliersParams = { ...this.suppliersParams, ...params };
    this.suppliers.reset();
    this.suppliers.load();
  }

  setPurchasesListParams(params: { search?: string }): void {
    this.purchasesParams = { ...this.purchasesParams, ...params };
    this.purchases.reset();
    this.purchases.load();
  }

  invalidateSupplies(): void {
    this.supplies.invalidate();
    this.suppliesPage.invalidate();
  }

  invalidateAll(): void {
    this.supplies.invalidate();
    this.suppliesPage.invalidate();
    this.purchases.invalidate();
    this.suppliers.invalidate();
    this.referenceData.invalidate();
  }
}

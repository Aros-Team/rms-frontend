import { Injectable, inject } from '@angular/core';
import { forkJoin } from 'rxjs';
import { ResourceCache } from '@app/core/cache/resource-cache';
import { InventoryService } from '@app/core/services/inventory/inventory';
import { Supplier } from '@app/core/services/suppliers/supplier';
import { Supply } from '@app/core/services/supplies/supply';
import { Purchase } from '@app/core/services/purchases/purchase';
import { SupplyVariantResponse } from '@app/shared/models/dto/supplies/supply-variant-response';
import { SupplyCategoryResponse } from '@app/shared/models/dto/supplies/supply-category-response';
import { SupplierResponse } from '@app/shared/models/dto/suppliers/supplier-response';
import { PurchaseResponse } from '@app/shared/models/dto/purchases/purchase-response';
import { SupplyUnitResponse } from '@app/shared/models/dto/supplies/supply-unit-response';
import { SupplyResponse } from '@app/shared/models/dto/supplies/supply-response';

export interface InventoryReferenceData {
  categories: SupplyCategoryResponse[];
  suppliers: SupplierResponse[];
  units: SupplyUnitResponse[];
  allSupplies: SupplyResponse[];
}

@Injectable({ providedIn: 'root' })
export class InventoryCacheService {
  private readonly inventoryService = inject(InventoryService);
  private readonly supplierService = inject(Supplier);
  private readonly supplyService = inject(Supply);
  private readonly purchaseService = inject(Purchase);

  // Supplies list - carga principal, TTL corto (2 min)
  readonly supplies = new ResourceCache<SupplyVariantResponse[]>(
    () => this.supplyService.getSupplyVariants(),
    { ttlMs: 2 * 60 * 1000, staleWhileRevalidate: true }
  );

  // Purchases - TTL medio (5 min)
  readonly purchases = new ResourceCache<PurchaseResponse[]>(
    () => this.purchaseService.getPurchases(),
    { ttlMs: 5 * 60 * 1000, staleWhileRevalidate: true }
  );

  // Datos de referencia - solo bajo demanda, TTL largo (30 min)
  readonly referenceData = new ResourceCache<InventoryReferenceData>(
    () => forkJoin({
      categories: this.supplyService.getCategories(),
      suppliers: this.supplierService.getSuppliers(),
      units: this.supplyService.getUnits(),
      allSupplies: this.supplyService.getSupplies()
    }),
    { ttlMs: 30 * 60 * 1000, staleWhileRevalidate: true }
  );

  invalidateSupplies(): void {
    this.supplies.invalidate();
  }

  invalidateAll(): void {
    this.supplies.invalidate();
    this.purchases.invalidate();
    this.referenceData.invalidate();
  }
}

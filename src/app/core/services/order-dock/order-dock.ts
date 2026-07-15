import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Order } from '@app/core/services/orders/order';
import { Logging } from '@app/core/services/logging/logging';
import { MasterData } from '@app/core/services/master-data/master-data';
import { ProductListResponse } from '@app/shared/models/dto/products/product-list-response.model';
import { CreateOrderDetail } from '@app/shared/models/dto/orders/create-order-request.model';
import { TableResponse } from '@app/shared/models/dto/tables/table-response.model';
export interface DockItem {
  product: ProductListResponse;
  instructions: string;
  selectedOptionIds: number[];
  selectedProductIds?: number[];
  optionNames: string[];
  quantity: number;
  additionIds?: number[];
  clarifications?: { questionId: number; answer: string }[];
}

export interface DinerState {
  id: number;
  items: DockItem[];
}

@Injectable({ providedIn: 'root' })
export class OrderDock {
  private orderService = inject(Order);
  private logger = inject(Logging);
  private masterData = inject(MasterData);

  readonly availableTables = signal<TableResponse[]>([]);
  readonly tablesLoading = signal(false);
  readonly tablesError = signal<string | null>(null);
  readonly selectedTableId = signal<number | null>(null);

  private _diners = signal<DinerState[]>([{ id: 1, items: [] }]);
  private _selectedDinerIndex = signal<number>(0);

  readonly diners = this._diners.asReadonly();
  readonly selectedDinerIndex = this._selectedDinerIndex.asReadonly();

  readonly selectedDiner = computed(() => {
    const index = this._selectedDinerIndex();
    const diners = this._diners();
    return index < diners.length ? diners[index] : null;
  });

  readonly selectedDinerItems = computed(() => {
    const diner = this.selectedDiner();
    return diner?.items ?? [];
  });

  readonly totalDiners = computed(() => this._diners().length);

  readonly hasItems = computed(() =>
    this._diners().some(d => d.items.length > 0)
  );

  readonly canPlaceOrder = computed(() => this.hasItems() && this.hasSelectedTable());

  readonly allDinersEmpty = computed(() =>
    this._diners().length > 0 && this._diners().every(d => d.items.length === 0)
  );

  readonly hasSelectedTable = computed(() => this.selectedTableId() !== null);

  selectDiner(index: number): void {
    if (index >= 0 && index < this._diners().length) {
      this._selectedDinerIndex.set(index);
    }
  }

  addDiner(): void {
    this._diners.update(diners => {
      const newId = Math.max(...diners.map(d => d.id), 0) + 1;
      return [...diners, { id: newId, items: [] }];
    });
    this._selectedDinerIndex.set(this._diners().length - 1);
  }

  removeDiner(dinerIndex: number): void {
    this._diners.update(diners => {
      if (diners.length <= 1) return diners;
      return diners.filter((_, i) => i !== dinerIndex);
    });
    const current = this._selectedDinerIndex();
    const total = this._diners().length;
    if (current >= total) {
      this._selectedDinerIndex.set(Math.max(0, total - 1));
    }
    this.loadAvailableTables();
  }

  addItemToDiner(item: DockItem): void {
    const index = this._selectedDinerIndex();
    this._diners.update(diners => {
      const updated = [...diners];
      const currentItems = updated[index].items;

      // Check if same product + same options + same instructions exists
      const existingIndex = currentItems.findIndex(ex =>
        ex.product.id === item.product.id &&
        ex.instructions === item.instructions &&
        ex.selectedOptionIds.length === item.selectedOptionIds.length &&
        ex.selectedOptionIds.every((id, i) => id === item.selectedOptionIds[i])
      );

      if (existingIndex >= 0) {
        // Increment quantity on existing item
        const items = [...currentItems];
        items[existingIndex] = { ...items[existingIndex], quantity: items[existingIndex].quantity + 1 };
        updated[index] = { ...updated[index], items };
      } else {
        // Add new item with quantity
        updated[index] = { ...updated[index], items: [...currentItems, { ...item, quantity: item.quantity || 1 }] };
      }
      return updated;
    });
  }

  removeItemFromDiner(itemIndex: number): void {
    const index = this._selectedDinerIndex();
    this._diners.update(diners => {
      const updated = [...diners];
      const diner = {
        ...updated[index],
        items: updated[index].items.filter((_, i) => i !== itemIndex)
      };
      updated[index] = diner;
      return updated;
    });
  }

  incrementItemQuantity(itemIndex: number): void {
    const dinerIndex = this._selectedDinerIndex();
    this._diners.update(diners => {
      const updated = [...diners];
      const items = [...updated[dinerIndex].items];
      items[itemIndex] = { ...items[itemIndex], quantity: items[itemIndex].quantity + 1 };
      updated[dinerIndex] = { ...updated[dinerIndex], items };
      return updated;
    });
  }

  decrementItemQuantity(itemIndex: number): void {
    const dinerIndex = this._selectedDinerIndex();
    this._diners.update(diners => {
      const updated = [...diners];
      const currentItems = updated[dinerIndex].items;
      const currentQty = currentItems[itemIndex].quantity;

      if (currentQty <= 1) {
        // Remove item when quantity reaches 0
        updated[dinerIndex] = { ...updated[dinerIndex], items: currentItems.filter((_, i) => i !== itemIndex) };
      } else {
        const items = [...currentItems];
        items[itemIndex] = { ...items[itemIndex], quantity: currentQty - 1 };
        updated[dinerIndex] = { ...updated[dinerIndex], items };
      }
      return updated;
    });
  }

  updateDinerItem(dinerIndex: number, itemIndex: number, updates: Partial<DockItem>): void {
    this._diners.update(diners => {
      if (dinerIndex >= diners.length || itemIndex >= diners[dinerIndex].items.length) return diners;
      const updated = [...diners];
      const items = [...updated[dinerIndex].items];
      items[itemIndex] = { ...items[itemIndex], ...updates };
      updated[dinerIndex] = { ...updated[dinerIndex], items };
      return updated;
    });
  }

  clearAll(): void {
    this._diners.set([{ id: 1, items: [] }]);
    this._selectedDinerIndex.set(0);
  }

  loadAvailableTables(): void {
    this.tablesLoading.set(true);
    this.tablesError.set(null);
    this.masterData.reloadTables().subscribe({
      next: (tables) => {
        this.availableTables.set(tables.filter(t => t.status === 'AVAILABLE'));
        this.tablesLoading.set(false);
      },
      error: (err) => {
        this.tablesError.set(extractError(err));
        this.tablesLoading.set(false);
      },
    });
  }

  selectTable(id: number | null): void {
    this.selectedTableId.set(id);
  }

  resetTableSelection(): void {
    this.selectedTableId.set(null);
  }

  getOrderDetailsForAllDiners(): { dinerId: number; details: CreateOrderDetail[] }[] {
    return this._diners().map(diner => ({
      dinerId: diner.id,
      details: diner.items.flatMap(item =>
        Array.from({ length: item.quantity }, () => ({
          productId: item.product.id,
          instructions: item.instructions,
          selectedOptionIds: item.selectedOptionIds,
          additionIds: item.additionIds,
          clarifications: item.clarifications,
        }))
      )
    })).filter(d => d.details.length > 0);
  }

  getOrderDetailsForDiner(dinerIndex: number): CreateOrderDetail[] {
    const diners = this._diners();
    if (dinerIndex >= diners.length) return [];
    return diners[dinerIndex].items.flatMap(item =>
      Array.from({ length: item.quantity }, () => ({
        productId: item.product.id,
        instructions: item.instructions,
        selectedOptionIds: item.selectedOptionIds,
        additionIds: item.additionIds,
        clarifications: item.clarifications,
      }))
    );
  }
}

function extractError(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    const errorBody: unknown = err.error;
    const body = errorBody as { message?: string } | null;
    return body?.message ?? err.message;
  }
  if (err instanceof Error) return err.message;
  return 'Error desconocido';
}

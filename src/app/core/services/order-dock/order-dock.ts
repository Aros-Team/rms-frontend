import { Injectable, signal, computed, inject } from '@angular/core';
import { Order } from '@app/core/services/orders/order';
import { Logging } from '@app/core/services/logging/logging';
import { ProductListResponse } from '@app/shared/models/dto/products/product-list-response.model';
import { CreateOrderDetail } from '@app/shared/models/dto/orders/create-order-request.model';
export interface DockItem {
  product: ProductListResponse;
  instructions: string;
  selectedOptionIds: number[];
  optionNames: string[];
}

export interface DinerState {
  id: number;
  items: DockItem[];
}

@Injectable({ providedIn: 'root' })
export class OrderDock {
  private orderService = inject(Order);
  private logger = inject(Logging);

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

  readonly canPlaceOrder = computed(() => this.hasItems());

  readonly allDinersEmpty = computed(() =>
    this._diners().length > 0 && this._diners().every(d => d.items.length === 0)
  );

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
  }

  addItemToDiner(item: DockItem): void {
    const index = this._selectedDinerIndex();
    this._diners.update(diners => {
      const updated = [...diners];
      const diner = { ...updated[index], items: [...updated[index].items, item] };
      updated[index] = diner;
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

  clearAll(): void {
    this._diners.set([{ id: 1, items: [] }]);
    this._selectedDinerIndex.set(0);
  }

  getOrderDetailsForAllDiners(): { dinerId: number; details: CreateOrderDetail[] }[] {
    return this._diners().map(diner => ({
      dinerId: diner.id,
      details: diner.items.map(item => ({
        productId: item.product.id,
        instructions: item.instructions,
        selectedOptionIds: item.selectedOptionIds,
      }))
    })).filter(d => d.details.length > 0);
  }

  getOrderDetailsForDiner(dinerIndex: number): CreateOrderDetail[] {
    const diners = this._diners();
    if (dinerIndex >= diners.length) return [];
    return diners[dinerIndex].items.map(item => ({
      productId: item.product.id,
      instructions: item.instructions,
      selectedOptionIds: item.selectedOptionIds,
    }));
  }
}

import { Injectable, signal, computed, effect, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Order } from '@app/core/services/orders/order';
import { Logging } from '@app/core/services/logging/logging';
import { MasterData } from '@app/core/services/master-data/master-data';
import { ProductListResponse } from '@app/shared/models/dto/products/product-list-response';
import { CreateOrderDetail } from '@app/shared/models/dto/orders/create-order-request';
import { TableResponse } from '@app/shared/models/dto/tables/table-response';
import { toAmount } from '@app/shared/models/dto/common/money';

/** Option group chosen inside a combo, kept for the cart summary. */
export interface DockOptionGroup {
  groupName: string;
  optionNames: string[];
}

export interface DockItem {
  product: ProductListResponse;
  instructions: string;
  selectedOptionIds: number[];
  selectedProductIds?: number[];
  optionNames: string[];
  quantity: number;
  additionIds?: number[];
  clarifications?: { questionId: number; answer: string }[];
  /**
   * Surcharge per unit from product options or combo additions. The cart
   * displays it; the API recomputes the authoritative price on submit.
   */
  extraCharge?: number;
  /** Combo group selections, used by the cart to show real group names. */
  optionGroups?: DockOptionGroup[];
}

export interface DinerState {
  id: number;
  items: DockItem[];
}

/** Human label for a table status. Shared by the picker and the cart. */
export function tableStatusLabel(status: TableResponse['status']): string {
  const labels: Record<TableResponse['status'], string> = {
    AVAILABLE: 'Disponible',
    OCCUPIED: 'Ocupada',
    RESERVED: 'Reservada',
  };
  return labels[status];
}

/**
 * Temporary cart snapshot. `sessionStorage` (not `localStorage`) keeps the
 * composed order across a reload without keeping it after the tab is closed.
 */
const STORAGE_KEY = 'rms.waiter.order-dock.v1';

interface PersistedDock {
  diners: DinerState[];
  selectedDinerIndex: number;
  selectedTableId: number | null;
}

@Injectable({ providedIn: 'root' })
export class OrderDock {
  private orderService = inject(Order);
  private logger = inject(Logging);
  private masterData = inject(MasterData);

  readonly availableTables = signal<TableResponse[]>([]);
  /** Every table, including occupied and reserved, so the picker can show status. */
  readonly allTables = signal<TableResponse[]>([]);
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

  /** Selected table resolved against every loaded table, not only the free ones. */
  readonly selectedTable = computed(() => {
    const id = this.selectedTableId();
    if (id === null) return null;
    return (
      this.allTables().find((table) => table.id === id) ??
      this.availableTables().find((table) => table.id === id) ??
      null
    );
  });

  readonly selectedTableLabel = computed(() => {
    const table = this.selectedTable();
    return table ? `Mesa ${String(table.tableNumber)}` : 'Sin mesa';
  });

  /** Total number of units across every diner, used by the floating cart. */
  readonly totalItems = computed(() =>
    this._diners().reduce(
      (sum, diner) => sum + diner.items.reduce((lineSum, item) => lineSum + item.quantity, 0),
      0,
    ),
  );

  /** Cart total in COP. Authoritative totals come from the order response. */
  readonly totalAmount = computed(() =>
    this._diners().reduce(
      (sum, diner) => sum + diner.items.reduce((lineSum, item) => lineSum + itemTotal(item), 0),
      0,
    ),
  );

  constructor() {
    this.restore();
    // Persist after every cart mutation so a reload never loses the composed
    // order. `sessionStorage` keeps it for this tab only.
    effect(() => {
      persistSnapshot({
        diners: this._diners(),
        selectedDinerIndex: this._selectedDinerIndex(),
        selectedTableId: this.selectedTableId(),
      });
    });
  }

  private restore(): void {
    const snapshot = readSnapshot();
    if (!snapshot) return;
    this._diners.set(snapshot.diners);
    this._selectedDinerIndex.set(snapshot.selectedDinerIndex);
    this.selectedTableId.set(snapshot.selectedTableId);
  }

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
        this.allTables.set(tables);
        this.availableTables.set(tables.filter(t => t.status === 'AVAILABLE'));
        this.tablesLoading.set(false);
      },
      error: (err) => {
        this.tablesError.set(extractError(err));
        this.tablesLoading.set(false);
      },
    });
  }

  /** A table can be chosen when it is free, or when it is the current one. */
  canSelectTable(table: TableResponse): boolean {
    return table.status === 'AVAILABLE' || table.id === this.selectedTableId();
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
          selectedProductIds: item.selectedProductIds,
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
        selectedProductIds: item.selectedProductIds,
      }))
    );
  }
}

function extractError(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    const errorBody: unknown = err.error;
    const body = errorBody as { detail?: string; message?: string } | null;
    return body?.detail ?? body?.message ?? err.message;
  }
  if (err instanceof Error) return err.message;
  return 'Error desconocido';
}

function cartStorage(): Storage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}

function persistSnapshot(snapshot: PersistedDock): void {
  const store = cartStorage();
  if (!store) return;
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Private mode or quota: the in-memory cart keeps working.
  }
}

function isDinerState(value: unknown): value is DinerState {
  if (typeof value !== 'object' || value === null) return false;
  const diner = value as Partial<DinerState>;
  return typeof diner.id === 'number' && Array.isArray(diner.items);
}

function isDockItem(value: unknown): value is DockItem {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Partial<DockItem>;
  const product = item.product as unknown;
  return (
    typeof item.quantity === 'number' &&
    item.quantity > 0 &&
    typeof product === 'object' &&
    product !== null
  );
}

function readSnapshot(): PersistedDock | null {
  const store = cartStorage();
  if (!store) return null;
  try {
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedDock>;
    if (!Array.isArray(parsed.diners)) return null;

    const diners = (parsed.diners as unknown[])
      .filter(isDinerState)
      .map((diner) => ({
        id: diner.id,
        items: (diner.items as unknown[]).filter(isDockItem),
      }));
    if (diners.length === 0) return null;

    const rawIndex = parsed.selectedDinerIndex;
    const selectedDinerIndex = Math.min(
      Math.max(0, typeof rawIndex === 'number' ? rawIndex : 0),
      diners.length - 1,
    );
    const selectedTableId =
      typeof parsed.selectedTableId === 'number' ? parsed.selectedTableId : null;

    return { diners, selectedDinerIndex, selectedTableId };
  } catch {
    return null;
  }
}

/** One cart line: unit base price + option surcharge, times quantity. */
export function itemTotal(item: DockItem): number {
  return (toAmount(item.product.basePrice) + (item.extraCharge ?? 0)) * item.quantity;
}

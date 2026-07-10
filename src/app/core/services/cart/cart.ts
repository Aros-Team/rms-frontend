import { Injectable, signal } from '@angular/core';
import { DockItem } from '@app/core/services/order-dock/order-dock';

@Injectable({ providedIn: 'root' })
export class Cart {
  private _pendingItems = signal<DockItem[]>([]);

  get pendingItems() {
    return this._pendingItems.asReadonly();
  }

  addItems(items: DockItem[]): void {
    this._pendingItems.set(items);
  }

  flush(): DockItem[] {
    const items = this._pendingItems();
    this._pendingItems.set([]);
    return items;
  }

  hasPending(): boolean {
    return this._pendingItems().length > 0;
  }
}
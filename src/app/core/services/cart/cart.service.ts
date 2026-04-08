import { Injectable, signal } from '@angular/core';
import { CartItem } from '@app/features/waiter/take-order/take-order';

@Injectable({ providedIn: 'root' })
export class CartService {
  private _pendingItems = signal<CartItem[]>([]);

  get pendingItems() {
    return this._pendingItems.asReadonly();
  }

  addItems(items: CartItem[]): void {
    this._pendingItems.set(items);
  }

  flush(): CartItem[] {
    const items = this._pendingItems();
    this._pendingItems.set([]);
    return items;
  }

  hasPending(): boolean {
    return this._pendingItems().length > 0;
  }
}

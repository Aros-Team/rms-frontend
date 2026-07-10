import { Injectable, inject, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { ResourceCache } from '@app/core/cache/resource-cache';
import { DayMenu } from '@app/core/services/daymenu/daymenu';
import { Product } from '@app/core/services/products/product';
import { DayMenuResponse } from '@app/shared/models/dto/daymenu/daymenu-response';
import { ProductOption } from '@app/shared/models/dto/products/product-option.model';
import { WebSocket } from '@app/core/services/websocket/websocket';

@Injectable({ providedIn: 'root' })
export class DayMenuCacheService implements OnDestroy {
  private readonly dayMenuService = inject(DayMenu);
  private readonly productService = inject(Product);
  private readonly wsService = inject(WebSocket);

  private cacheInvalidationSubscription: Subscription;

  // Menú del día actual
  readonly currentMenu = new ResourceCache<DayMenuResponse | null>(
    () => this.dayMenuService.getCurrentDayMenu(),
    { ttlMs: 2 * 60 * 1000, staleWhileRevalidate: true }
  );

  // Opciones del producto del menú actual
  readonly currentOptions = new ResourceCache<ProductOption[]>(
    () => {
      const menu = this.currentMenu.data();
      if (!menu) return this.productService.getOptions(0);
      return this.productService.getOptions(menu.productId);
    },
    { ttlMs: 2 * 60 * 1000, staleWhileRevalidate: true }
  );

  constructor() {
    this.cacheInvalidationSubscription = this.wsService.cacheInvalidation$.subscribe((event) => {
      if (event.resource === 'day-menu') {
        this.invalidateAll();
      }
    });
  }

  invalidateAll(): void {
    this.currentMenu.invalidate();
    this.currentOptions.invalidate();
  }

  ngOnDestroy(): void {
    this.cacheInvalidationSubscription.unsubscribe();
  }
}
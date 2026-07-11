import { Component, OnInit, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { KeyValuePipe, DatePipe } from '@angular/common';

import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';

import { DayMenu as DayMenuSvc } from '@app/core/services/daymenu/daymenu';
import { Logging } from '@app/core/services/logging/logging';
import { MasterData } from '@app/core/services/master-data/master-data';
import { OrderDock, DockItem } from '@app/core/services/order-dock/order-dock';

import { DayMenuResponse } from '@app/shared/models/dto/daymenu/daymenu-response';
import { ProductOption } from '@app/shared/models/dto/products/product-option.model';
import { ProductListResponse } from '@app/shared/models/dto/products/product-list-response.model';

import { DayMenuSkeleton } from './skeletons/day-menu-skeleton';
import { ProductOptionsModal, ProductOptionsConfirmEvent } from '@app/shared/components/product-options-modal/product-options-modal';

@Component({
  selector: 'app-day-menu',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './day-menu.html',
  styleUrl: './day-menu.css',
  imports: [ButtonModule, KeyValuePipe, DatePipe, DayMenuSkeleton, ProductOptionsModal],
})
export class DayMenu implements OnInit {
  private dayMenuService = inject(DayMenuSvc);
  private masterData = inject(MasterData);
  private dock = inject(OrderDock);
  private logger = inject(Logging);
  private messageService = inject(MessageService);

  loading = signal(true);
  dayMenu = signal<DayMenuResponse | null>(null);
  error = signal<string | null>(null);

  /** Transforms DayMenuResponse into ProductListResponse for the shared modal. */
  dayMenuProduct = computed<ProductListResponse | null>(() => {
    const menu = this.dayMenu();
    if (!menu) return null;
    return {
      id: menu.productId,
      name: menu.productName,
      basePrice: menu.productBasePrice,
      active: true,
      categoryId: 0,
      categoryName: '',
      areaId: 0,
    };
  });

  // Options modal
  showOptionsModal = signal(false);

  // Opciones del producto mostradas en la card
  productOptions = signal<ProductOption[]>([]);
  productOptionsLoading = signal(false);
  optionsLoadError = signal<string | null>(null);

  productOptionsByCategory = computed(() =>
    this.masterData.groupOptionsByCategory(this.productOptions())
  );

  /** Request sequence token to cancel stale getProductOptions responses. */
  private optionsSeq = 0;

  /** True when user can click "Ordenar" — options fully loaded & no error. */
  canPlaceOrder = computed(() => {
    // Menu must be present and not loading
    if (this.loading() || !this.dayMenu()) return false;
    // Options must have settled (loading done, no error)
    if (this.productOptionsLoading()) return false;
    if (this.optionsLoadError()) return false;
    return true;
  });

  currencyFormat = Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' });

  constructor() {
    // Preload MasterData tables so dock always has table data ready,
    // even if user never opened Carta module.
    this.masterData.reloadTables().subscribe({
      error: () => { this.logger.warn('DayMenu: tables preload failed (non-fatal)'); },
    });
  }

  ngOnInit(): void {
    this.dayMenuService.getCurrentDayMenu().subscribe({
      next: (menu) => {
        if (!menu) {
          this.dayMenu.set(null);
          this.loading.set(false);
          return;
        }
        this.dayMenu.set(menu);
        // Start options load BEFORE clearing main loading flag to avoid
        // a synchronous frame where button is enabled without options.
        this.loadProductOptions(menu.productId);
        this.loading.set(false);
      },
      error: (err: { status?: number }) => {
        if (err.status === 404) {
          this.dayMenu.set(null);
        } else {
          this.error.set('No se pudo cargar el menú del día.');
          this.logger.error('DayMenu: failed to load', err);
        }
        this.loading.set(false);
      },
    });
  }

  private loadProductOptions(productId: number): void {
    const seq = ++this.optionsSeq;

    this.productOptionsLoading.set(true);
    this.optionsLoadError.set(null);
    this.productOptions.set([]);

    this.masterData.getProductOptions(productId).subscribe({
      next: (opts) => {
        if (seq !== this.optionsSeq) return; // stale — discard
        this.productOptions.set(opts);
        this.productOptionsLoading.set(false);
      },
      error: (err: unknown) => {
        if (seq !== this.optionsSeq) return; // stale — discard
        this.productOptionsLoading.set(false);
        const httpErr = err as { error?: { message?: string }; message?: string } | null;
        const msg = httpErr?.error?.message ?? httpErr?.message ?? 'Error desconocido al cargar opciones.';
        this.optionsLoadError.set(msg);
        this.logger.error('DayMenu: failed to load product options', err);
        this.messageService.add({
          severity: 'error',
          summary: 'Error de opciones',
          detail: 'No se pudieron cargar las opciones del producto. Intenta de nuevo.',
        });
      },
    });
  }

  orderDayMenu(): void {
    const prod = this.dayMenuProduct();
    if (!prod) return;

    if (this.productOptions().length === 0) {
      const item: DockItem = {
        product: prod,
        instructions: '', selectedOptionIds: [], optionNames: [],
        quantity: 1,
      };
      this.dock.addItemToDiner(item);
      return;
    }

    this.showOptionsModal.set(true);
  }

  onConfirmOptions(event: ProductOptionsConfirmEvent): void {
    const item: DockItem = {
      product: event.product,
      instructions: event.instructions,
      selectedOptionIds: event.selectedOptions.map(o => o.optionId),
      optionNames: event.selectedOptions.map(o => o.optionName),
      quantity: event.quantity,
    };

    this.dock.addItemToDiner(item);

    this.showOptionsModal.set(false);
  }

  closeModal(): void {
    this.showOptionsModal.set(false);
  }
}

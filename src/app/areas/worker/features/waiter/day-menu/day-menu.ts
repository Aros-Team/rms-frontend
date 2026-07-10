import { Component, OnInit, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { KeyValuePipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { DayMenuService } from '@app/core/services/daymenu/daymenu';
import { MasterData } from '@app/core/services/master-data/master-data';
import { OrderDock, DockItem } from '@app/core/services/order-dock/order-dock';
import { Logging } from '@app/core/services/logging/logging';

import { DayMenuResponse } from '@app/shared/models/dto/daymenu/daymenu-response';
import { ProductOption } from '@app/shared/models/dto/products/product-option.model';

import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TagModule } from 'primeng/tag';

import { DayMenuSkeleton } from './skeletons/day-menu-skeleton';

@Component({
  selector: 'app-day-menu',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './day-menu.html',
  imports: [ButtonModule, ProgressSpinnerModule, TagModule, KeyValuePipe, DatePipe, FormsModule, DayMenuSkeleton],
})
export class DayMenu implements OnInit {
  private dayMenuService = inject(DayMenuService);
  private masterData = inject(MasterData);
  private dock = inject(OrderDock);
  private logger = inject(Logging);
  private messageService = inject(MessageService);

  loading = signal(true);
  dayMenu = signal<DayMenuResponse | null>(null);
  error = signal<string | null>(null);

  // Options modal
  showOptionsModal = signal(false);
  modalOptions = signal<ProductOption[]>([]);
  modalOptionsLoading = signal(false);
  pendingOptions = signal<number[]>([]);
  pendingInstructions = signal('');
  optionsError = signal<string | null>(null);

  // Opciones del producto mostradas en la card
  productOptions = signal<ProductOption[]>([]);
  productOptionsLoading = signal(false);
  optionsLoadError = signal<string | null>(null);

  modalOptionsByCategory = computed(() =>
    this.masterData.groupOptionsByCategory(this.modalOptions())
  );

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
    const menu = this.dayMenu();
    if (!menu) return;

    const loadedOptions = this.productOptions();

    if (loadedOptions.length === 0) {
      const item: DockItem = {
        product: {
          id: menu.productId, name: menu.productName,
          basePrice: menu.productBasePrice,
          active: true, categoryId: 0, categoryName: '', areaId: 0,
        },
        instructions: '', selectedOptionIds: [], optionNames: [],
      };
      this.dock.addItemToDiner(item);
      return;
    }

    this.pendingOptions.set([]);
    this.pendingInstructions.set('');
    this.optionsError.set(null);
    this.modalOptions.set(loadedOptions);
    this.modalOptionsLoading.set(false);
    this.showOptionsModal.set(true);
  }

  toggleOption(optionId: number, categoryId: number): void {
    const sameCategory = this.modalOptions()
      .filter(o => o.optionCategoryId === categoryId)
      .map(o => o.id);

    this.pendingOptions.update(ids => {
      const withoutCategory = ids.filter(id => !sameCategory.includes(id));
      return ids.includes(optionId) ? withoutCategory : [...withoutCategory, optionId];
    });
  }

  isOptionSelected(optionId: number): boolean {
    return this.pendingOptions().includes(optionId);
  }

  confirmOptions(): void {
    const menu = this.dayMenu();
    if (!menu) return;

    const selectedIds = [...this.pendingOptions()];
    const optionNames = selectedIds
      .map(id => this.modalOptions().find(o => o.id === id)?.name ?? '')
      .filter(Boolean);

    const item: DockItem = {
      product: {
        id: menu.productId,
        name: menu.productName,
        basePrice: menu.productBasePrice,
        active: true,
        categoryId: 0,
        categoryName: '',
        areaId: 0,
      },
      instructions: this.pendingInstructions(),
      selectedOptionIds: selectedIds,
      optionNames,
    };

    this.dock.addItemToDiner(item);
    this.showOptionsModal.set(false);
  }

  closeModal(): void {
    this.showOptionsModal.set(false);
    this.pendingOptions.set([]);
    this.pendingInstructions.set('');
    this.optionsError.set(null);
  }
}

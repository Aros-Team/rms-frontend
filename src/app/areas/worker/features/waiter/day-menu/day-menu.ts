import { Component, OnInit, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { KeyValuePipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { DayMenuService } from '@app/core/services/daymenu/daymenu';
import { MasterData } from '@app/core/services/master-data/master-data';
import { Cart } from '@app/core/services/cart/cart';
import { Logging } from '@app/core/services/logging/logging';

import { DayMenuResponse } from '@app/shared/models/dto/daymenu/daymenu-response';
import { ProductOption } from '@app/shared/models/dto/products/product-option.model';
import { CartItem } from '@areas/worker/features/waiter/take-order/take-order';

import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TagModule } from 'primeng/tag';

@Component({
  selector: 'app-day-menu',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './day-menu.html',
  imports: [ButtonModule, ProgressSpinnerModule, TagModule, KeyValuePipe, DatePipe, FormsModule],
})
export class DayMenu implements OnInit {
  private dayMenuService = inject(DayMenuService);
  private masterData = inject(MasterData);
  private cartService = inject(Cart);
  private router = inject(Router);
  private logger = inject(Logging);

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

  modalOptionsByCategory = computed(() =>
    this.masterData.groupOptionsByCategory(this.modalOptions())
  );

  productOptionsByCategory = computed(() =>
    this.masterData.groupOptionsByCategory(this.productOptions())
  );

  currencyFormat = Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' });

  ngOnInit(): void {
    this.dayMenuService.getCurrentDayMenu().subscribe({
      next: (menu) => {
        // El backend retorna 204 No Content cuando no hay menú del día.
        // Angular HttpClient lo trata como éxito con body null.
        if (!menu) {
          this.dayMenu.set(null);
          this.loading.set(false);
          return;
        }
        this.dayMenu.set(menu);
        this.loading.set(false);
        this.loadProductOptions(menu.productId);
      },
      error: (err) => {
        // 404 también puede indicar que no hay menú configurado
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
    this.productOptionsLoading.set(true);
    this.masterData.getProductOptions(productId).subscribe({
      next: (opts) => { this.productOptions.set(opts); this.productOptionsLoading.set(false); },
      error: () => this.productOptionsLoading.set(false),
    });
  }

  orderDayMenu(): void {
    const menu = this.dayMenu();
    if (!menu) return;

    // Necesitamos saber si el producto tiene opciones — lo buscamos en master data
    // Si no está cargado aún, lo cargamos
    const snapshot = this.masterData.snapshot;
    if (snapshot) {
      this.resolveProduct(menu);
    } else {
      this.loading.set(true);
      this.masterData.load().subscribe({
        next: () => { this.loading.set(false); this.resolveProduct(menu); },
        error: () => { this.loading.set(false); this.resolveProduct(menu); },
      });
    }
  }

  private resolveProduct(menu: DayMenuResponse): void {
    // Always show the options modal — the product may or may not have options.
    // If no options are loaded, the user can confirm without selecting any.
    const loadedOptions = this.productOptions();

    if (loadedOptions.length === 0) {
      // No options available — add directly to cart without modal
      const item: CartItem = {
        product: {
          id: menu.productId, name: menu.productName,
          basePrice: menu.productBasePrice,
          active: true, categoryId: 0, categoryName: '', areaId: 0,
        },
        instructions: '', selectedOptionIds: [], optionNames: [],
      };
      this.cartService.addItems([item]);
      this.router.navigate(['/worker/take-order']);
      return;
    }

    // Options available — open modal for selection
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

    const item: CartItem = {
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

    this.cartService.addItems([item]);
    this.showOptionsModal.set(false);
    this.router.navigate(['/worker/take-order']);
  }

  closeModal(): void {
    this.showOptionsModal.set(false);
    this.pendingOptions.set([]);
    this.pendingInstructions.set('');
    this.optionsError.set(null);
  }
}

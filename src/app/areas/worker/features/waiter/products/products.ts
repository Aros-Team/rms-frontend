import { Component, OnInit, inject, signal, computed, DestroyRef, ChangeDetectionStrategy } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { MasterData } from '@app/core/services/master-data/master-data';
import { OptionGroup } from '@app/core/services/option-group/option-group';
import { OrderDock, DockItem, DockOptionGroup } from '@app/core/services/order-dock/order-dock';
import { Logging } from '@app/core/services/logging/logging';
import { ProductListResponse } from '@app/shared/models/dto/products/product-list-response';
import { ProductOption } from '@app/shared/models/dto/products/product-option';
import { Money } from '@app/shared/pipes/money/money';
import { productImageSrcSet } from '@app/shared/lib/product-image';

import { CartaSkeleton } from './skeletons/carta-skeleton';
import {
  ProductOptionsModal,
  ProductOptionsConfirmEvent,
} from '@app/shared/components/product-options-modal/product-options-modal';
import { RmsButton } from '@app/shared/ui/button/button';
import { RmsEmptyState } from '@app/shared/ui/empty-state/empty-state';
import { RmsInput } from '@app/shared/ui/input/input';

const ALL_CATEGORIES = 'all';

/**
 * Waiter "Carta".
 *
 * Feature: fast product browsing for one-handed service.
 *
 * Contract:
 *  - search and category chips are always visible and are at least 44px;
 *  - each product is one row with a real thumbnail or a typographic monogram,
 *    never a large "Sin imagen" box (F-027);
 *  - the whole row is the add action, and it opens the options dialog, clamped
 *    to the viewport at 320px (R-01);
 *  - a product with no image still reads as a product, not as a broken card.
 */
@Component({
  selector: 'app-products',
  templateUrl: './products.html',
  styleUrl: './products.css',
  imports: [
    CommonModule,
    FormsModule,
    CartaSkeleton,
    Money,
    ProductOptionsModal,
    RmsButton,
    RmsEmptyState,
    RmsInput,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Products implements OnInit {
  private readonly masterData = inject(MasterData);
  private readonly optionGroupService = inject(OptionGroup);
  private readonly dock = inject(OrderDock);
  private readonly logger = inject(Logging);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly productsByCategory = signal<Record<string, ProductListResponse[]>>({});
  readonly searchQuery = signal('');
  readonly activeCategory = signal<string>(ALL_CATEGORIES);

  readonly showOptionsModal = signal(false);
  readonly pendingProduct = signal<ProductListResponse | null>(null);
  readonly modalOptions = signal<ProductOption[]>([]);
  readonly modalRequiredGroupIds = signal<number[]>([]);
  readonly modalOptionsLoading = signal(false);
  readonly optionsError = signal<string | null>(null);
  private optionsSeq = 0;

  readonly categories = computed(() => Object.keys(this.productsByCategory()));
  readonly allProducts = computed(() => Object.values(this.productsByCategory()).flat());

  readonly filteredProducts = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    if (query.length > 0) {
      return this.allProducts().filter((product) => {
        const name = product.name.toLowerCase();
        const description = (product.description ?? '').toLowerCase();
        return name.includes(query) || description.includes(query);
      });
    }

    const category = this.activeCategory();
    if (category === ALL_CATEGORIES) return this.allProducts();
    return this.productsByCategory()[category] ?? [];
  });

  readonly resultCount = computed(() => this.filteredProducts().length);

  ngOnInit(): void {
    this.masterData
      .load()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.productsByCategory.set(this.masterData.getProductsByCategory());
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.logger.error('Products: failed to load master data', err);
          this.error.set('No se pudieron cargar los productos. Intenta de nuevo.');
          this.loading.set(false);
        },
      });
  }

  retry(): void {
    this.loading.set(true);
    this.error.set(null);
    this.masterData
      .load()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.productsByCategory.set(this.masterData.getProductsByCategory());
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.logger.error('Products: failed to load master data', err);
          this.error.set('No se pudieron cargar los productos. Intenta de nuevo.');
          this.loading.set(false);
        },
      });
  }

  selectCategory(category: string): void {
    this.activeCategory.set(category);
    this.searchQuery.set('');
  }

  clearSearch(): void {
    this.searchQuery.set('');
  }

  /** Two-letter monogram used when a product has no photo. */
  monogram(name: string): string {
    return name
      .split(/\s+/)
      .filter((word) => word.length > 0)
      .slice(0, 2)
      .map((word) => word.charAt(0).toUpperCase())
      .join('');
  }

  imageSrcSet(product: ProductListResponse): string | null {
    return productImageSrcSet(product);
  }

  addProduct(product: ProductListResponse): void {
    this.pendingProduct.set(product);
    this.modalOptions.set([]);
    this.modalRequiredGroupIds.set([]);
    this.showOptionsModal.set(true);
    this.error.set(null);
    this.optionsError.set(null);
    this.loadProductOptions(product);
  }

  private loadProductOptions(product: ProductListResponse): void {
    const seq = ++this.optionsSeq;
    this.modalOptionsLoading.set(true);

    forkJoin({
      options: this.masterData
        .getProductOptions(product.id)
        .pipe(catchError(() => of([] as ProductOption[]))),
      groups: this.optionGroupService
        .getProductOptionGroups(product.id)
        .pipe(catchError(() => of([]))),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ options, groups }) => {
          if (seq !== this.optionsSeq) return;
          this.modalOptions.set(options);
          this.modalRequiredGroupIds.set(
            groups.filter((group) => group.required).map((group) => group.id),
          );
          this.modalOptionsLoading.set(false);
        },
        error: (err: unknown) => {
          if (seq !== this.optionsSeq) return;
          this.logger.error('Products: failed to load product options', err);
          this.optionsError.set('No se pudieron cargar las opciones. Intenta de nuevo.');
          this.modalOptionsLoading.set(false);
        },
      });
  }

  onConfirmOptions(event: ProductOptionsConfirmEvent): void {
    const groups = new Map<string, string[]>();
    for (const selected of event.selectedOptions) {
      const option = this.modalOptions().find((candidate) => candidate.id === selected.optionId);
      if (!option) continue;
      const names = groups.get(option.optionGroupName) ?? [];
      names.push(option.name);
      groups.set(option.optionGroupName, names);
    }

    const optionGroups: DockOptionGroup[] = [...groups.entries()].map(
      ([groupName, optionNames]) => ({ groupName, optionNames }),
    );

    const item: DockItem = {
      product: event.product,
      instructions: event.instructions,
      selectedOptionIds: event.selectedOptions.map((option) => option.optionId),
      optionNames: event.selectedOptions.map((option) => option.optionName),
      optionGroups,
      extraCharge: event.extraCharge,
      quantity: event.quantity,
    };

    this.dock.addItemToDiner(item);
    this.closeModal();
  }

  closeModal(): void {
    this.showOptionsModal.set(false);
    this.pendingProduct.set(null);
    this.modalOptions.set([]);
    this.modalRequiredGroupIds.set([]);
    this.optionsError.set(null);
  }
}

import {
  ChangeDetectionStrategy,
  Component,
  Input,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DragDropModule } from '@angular/cdk/drag-drop';
import type { CdkDragDrop } from '@angular/cdk/drag-drop';

import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';

import { ComboReferenceCache } from '@app/core/services/combos/combo-reference-cache';
import { ComboWizardState } from '@app/core/services/combos/combo-wizard-state';
import type { WizardGroupDraft } from '@app/core/services/combos/combo-wizard-state';
import { ProductCard } from '@app/shared/components/product-card/product-card';
import type { ProductResponse } from '@app/shared/models/dto/products/product-response';

import { categoryStepId } from '../combo-wizard';

@Component({
  selector: 'app-group-step[comboWizardStep=category]',
  imports: [CommonModule, FormsModule, ButtonModule, InputTextModule, DragDropModule, ProductCard],
  templateUrl: './group-step.html',
  styleUrl: './group-step.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GroupStep {
  @Input() categoryId = 0;

  private readonly wizard = inject(ComboWizardState);
  private readonly reference = inject(ComboReferenceCache);
  private debounceHandle: ReturnType<typeof setTimeout> | null = null;

  readonly searchText = signal('');
  readonly searchQuery = signal('');

  readonly showMinWarning = signal(false);

  readonly categoryName = computed(() =>
    this.reference.categoryName(this.categoryId) ?? 'Categoría #' + String(this.categoryId),
  );

  readonly currentGroup = computed<WizardGroupDraft | undefined>(() =>
    this.wizard.data().groups.find((g) => g.categoryId === this.categoryId),
  );

  readonly selectedProductIds = computed<number[]>(() => this.currentGroup()?.productIds ?? []);

  readonly selectedCount = computed(() => this.selectedProductIds().length);

  readonly groupMinSelections = computed(() => this.currentGroup()?.minSelections ?? 0);

  readonly groupMaxSelections = computed(() => this.currentGroup()?.maxSelections ?? 0);

  readonly isRequired = computed(() => this.currentGroup()?.required ?? false);

  readonly canSelectMore = computed(() => this.selectedCount() < this.groupMaxSelections());

  private readonly allProducts = computed<ProductResponse[]>(() =>
    this.reference.specialSelectionProductsByCategory(this.categoryId),
  );

  readonly availableProducts = computed<ProductResponse[]>(() => {
    const selected = new Set(this.selectedProductIds());
    return this.allProducts().filter((p) => p.active && !selected.has(p.id));
  });

  readonly selectedProducts = computed<ProductResponse[]>(() => {
    const selectedIds = new Set(this.selectedProductIds());
    return this.allProducts().filter((p) => selectedIds.has(p.id));
  });

  readonly searchFilteredProducts = computed<ProductResponse[]>(() => {
    const query = this.searchQuery().toLowerCase();
    if (!query) return this.availableProducts();
    return this.availableProducts().filter((p) => p.name.toLowerCase().includes(query));
  });

  readonly selectionCountText = computed(() => {
    const count = this.selectedCount();
    const max = this.groupMaxSelections();
    return `${String(count)} / ${String(max)} seleccionados`;
  });

  readonly minMaxText = computed(() => {
    const min = this.groupMinSelections();
    const max = this.groupMaxSelections();
    return `Selecciona mínimo ${String(min)}, máximo ${String(max)}`;
  });

  readonly constraintBadge = computed(() => {
    if (!this.isRequired()) return '';
    const min = this.groupMinSelections();
    const max = this.groupMaxSelections();
    return `Obligatorio • Mín ${String(min)} • Máx ${String(max)}`;
  });

  private readonly currentStepId = computed(() => categoryStepId(this.categoryId));

  constructor() {
    effect(() => {
      const count = this.selectedCount();
      const min = this.groupMinSelections();
      const stepId = this.currentStepId();

      if (count >= min) {
        this.wizard.markStepCompleted(stepId);
      } else {
        this.wizard.markStepIncomplete(stepId);
      }
    });
  }

  onSearchInput(value: string): void {
    this.searchText.set(value);
    if (this.debounceHandle !== null) {
      clearTimeout(this.debounceHandle);
    }
    this.debounceHandle = setTimeout(() => {
      this.searchQuery.set(value);
    }, 300);
  }

  toggleProduct(product: ProductResponse): void {
    const ids = this.selectedProductIds();
    if (ids.includes(product.id)) {
      this.removeProduct(product.id);
    } else {
      this.addProduct(product.id);
    }
  }

  addProduct(productId: number): void {
    const group = this.currentGroup();
    if (!group || !this.canSelectMore()) return;

    this.showMinWarning.set(false);
    const updated = [...group.productIds, productId];
    this.updateGroup(updated);
  }

  removeProduct(productId: number): void {
    const group = this.currentGroup();
    if (!group) return;

    const min = this.groupMinSelections();
    if (min > 0 && group.productIds.length - 1 < min) {
      this.showMinWarning.set(true);
      return;
    }

    this.showMinWarning.set(false);
    const updated = group.productIds.filter((id) => id !== productId);
    this.updateGroup(updated);
  }

  onDragDrop(event: CdkDragDrop<number[]>): void {
    const productId = event.item.data as number;
    const targetId = event.container.id;

    if (targetId === 'selected-list') {
      this.addProduct(productId);
    } else if (targetId === 'available-list') {
      this.removeProduct(productId);
    }
  }

  trackById(_index: number, item: ProductResponse): number {
    return item.id;
  }

  private updateGroup(productIds: number[]): void {
    const groups = this.wizard.data().groups.map((g) => {
      if (g.categoryId === this.categoryId) {
        return { ...g, productIds: [...productIds] };
      }
      return g;
    });
    this.wizard.updateGroups(groups);
  }
}

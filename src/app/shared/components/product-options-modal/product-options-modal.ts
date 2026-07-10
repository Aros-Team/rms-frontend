import { Component, input, output, signal, computed, effect, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, KeyValuePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { DialogModule } from 'primeng/dialog';

import { ProductListResponse } from '@app/shared/models/dto/products/product-list-response.model';
import { ProductOption } from '@app/shared/models/dto/products/product-option.model';

export interface SelectedOption {
  optionId: number;
  optionName: string;
}

export interface ProductOptionsConfirmEvent {
  product: ProductListResponse;
  selectedOptions: SelectedOption[];
  instructions: string;
  quantity: number;
}

@Component({
  selector: 'app-product-options-modal',
  templateUrl: './product-options-modal.html',
  styleUrl: './product-options-modal.css',
  imports: [CommonModule, DialogModule, FormsModule, KeyValuePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductOptionsModal {
  // ── Inputs ──
  product = input<ProductListResponse | null>(null);
  options = input<ProductOption[]>([]);
  loading = input(false);
  error = input<string | null>(null);
  visible = input(false);

  // ── Outputs ──
  readonly confirm = output<ProductOptionsConfirmEvent>();
  readonly dismiss = output();
  readonly errorClear = output();

  // ── Internal state (public for template access) ──
  selectedOptionIds = signal<number[]>([]);
  instructions = signal('');
  quantity = signal(1);

  // ── Computed ──
  readonly groupedOptions = computed(() => {
    return this.options().reduce<Record<string, ProductOption[]>>((acc, opt) => {
      (acc[opt.optionCategoryName] ??= []).push(opt);
      return acc;
    }, {});
  });

  // ── Reset state when dialog opens ──
  constructor() {
    effect(() => {
      if (this.visible()) {
        this.selectedOptionIds.set([]);
        this.instructions.set('');
        this.quantity.set(1);
      }
    });
  }

  // ── Public methods ──

  toggleOption(optionId: number, categoryId: number): void {
    const sameCategory = this.options()
      .filter(o => o.optionCategoryId === categoryId)
      .map(o => o.id);

    this.selectedOptionIds.update(ids => {
      const withoutCategory = ids.filter(id => !sameCategory.includes(id));
      return ids.includes(optionId) ? withoutCategory : [...withoutCategory, optionId];
    });
  }

  isSelected(optionId: number): boolean {
    return this.selectedOptionIds().includes(optionId);
  }

  changeQuantity(delta: number): void {
    this.quantity.update(q => Math.max(1, Math.min(99, q + delta)));
  }

  onConfirm(): void {
    const prod = this.product();
    if (!prod) return;

    const selIds = this.selectedOptionIds();
    const selOptions: SelectedOption[] = selIds.map(id => ({
      optionId: id,
      optionName: this.options().find(o => o.id === id)?.name ?? '',
    }));

    this.confirm.emit({
      product: prod,
      selectedOptions: selOptions,
      instructions: this.instructions(),
      quantity: this.quantity(),
    });
  }

  onDismiss(): void {
    this.dismiss.emit();
  }

  onErrorClear(): void {
    this.errorClear.emit();
  }

  defaultImage = 'assets/placeholder-product.svg';
}

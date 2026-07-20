import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  untracked,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DividerModule } from 'primeng/divider';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectButtonModule } from 'primeng/selectbutton';

import { ComboReferenceCache } from '@app/core/services/combos/combo-reference-cache';
import {
  ComboWizardState,
  type WizardGroupDraft,
} from '@app/core/services/combos/combo-wizard-state';
import { STEP_PRICING_ID } from '../combo-wizard';
import type { ProductResponse } from '@app/shared/models/dto/products/product-response';

interface ProductCostView {
  id: number;
  name: string;
  basePrice: number;
}

interface GroupCostView {
  categoryName: string;
  categoryId: number;
  products: ProductCostView[];
  maxSelections: number;
  avgPrice: number;
  subtotal: number;
}

@Component({
  selector: 'app-pricing-step[comboWizardStep=pricing]',
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    CardModule,
    DividerModule,
    InputNumberModule,
    SelectButtonModule,
  ],
  templateUrl: './pricing-step.html',
  styleUrl: './pricing-step.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PricingStep {
  private readonly wizard = inject(ComboWizardState);
  private readonly reference = inject(ComboReferenceCache);

  readonly wizardData = this.wizard.data;

  readonly activeOptions = [
    { label: 'Sí', value: true },
    { label: 'No', value: false },
  ];

  readonly groupCosts = computed<GroupCostView[]>(() => {
    const groups = this.wizard.data().groups;
    return groups.map((group: WizardGroupDraft) => {
      const catName =
        group.categoryId !== null
          ? this.reference.categoryName(group.categoryId) ??
            `Categoría #${String(group.categoryId)}`
          : 'Sin categoría';
      const products: ProductCostView[] = group.productIds
        .map((id: number) => this.reference.productById(id))
        .filter((p): p is ProductResponse => p !== undefined)
        .map((p: ProductResponse) => ({
          id: p.id,
          name: p.name,
          basePrice: p.basePrice,
        }));
      const n = products.length;
      const avg = n > 0
        ? products.reduce((s, p) => s + p.basePrice, 0) / n
        : 0;
      const maxSel = group.maxSelections;
      return {
        categoryName: catName,
        categoryId: group.categoryId ?? 0,
        products,
        maxSelections: maxSel,
        avgPrice: avg,
        subtotal: avg * maxSel,
      };
    });
  });

  readonly totalCost = computed(() => {
    const costs = this.groupCosts();
    return costs.reduce((sum, g) => sum + g.subtotal, 0);
  });

  readonly suggestedRetailPrice = computed(() => this.totalCost() * 0.9);

  readonly customerSelectionCount = computed(() => {
    const groups = this.wizard.data().groups;
    return groups.reduce((count, g) => count + g.maxSelections, 0);
  });

  constructor() {
    effect(() => {
      const { basePrice } = this.wizard.data();
      const exists = this.wizard.steps().some((s) => s.id === STEP_PRICING_ID);
      const completed = exists && basePrice !== null && basePrice > 0;
      untracked(() => {
        if (completed) {
          this.wizard.markStepCompleted(STEP_PRICING_ID);
        } else {
          this.wizard.markStepIncomplete(STEP_PRICING_ID);
        }
      });
    });
  }

  onBasePriceChange(value: number | null): void {
    this.wizard.updateData({ basePrice: value });
  }

  onActiveChange(value: boolean): void {
    this.wizard.updateData({ active: value });
  }

  applySuggestedPrice(): void {
    this.wizard.updateData({ basePrice: this.suggestedRetailPrice() });
  }
}

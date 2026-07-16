import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';

import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DividerModule } from 'primeng/divider';
import { InputNumberModule } from 'primeng/inputnumber';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { SelectButtonModule } from 'primeng/selectbutton';

import { ComboReferenceCache } from '@app/core/services/combos/combo-reference-cache';
import {
  ComboWizardState,
  type WizardGroupDraft,
} from '@app/core/services/combos/combo-wizard-state';
import { STEP_PRICING_ID } from '../combo-wizard';
import { SpecialSelectionsCacheService } from '@app/core/services/special-selections/special-selections-cache.service';
import type { SuggestedPriceResponse } from '@app/shared/models/dto/special-selections/special-selection-suggested-price';
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
    MessageModule,
    ProgressSpinnerModule,
    SelectButtonModule,
  ],
  templateUrl: './pricing-step.html',
  styleUrl: './pricing-step.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PricingStep {
  private readonly wizard = inject(ComboWizardState);
  private readonly reference = inject(ComboReferenceCache);
  private readonly specialSelections = inject(SpecialSelectionsCacheService);

  readonly wizardData = this.wizard.data;
  readonly sourceId = this.wizard.sourceId;

  readonly margin = signal(30);
  readonly suggestedResult = signal<SuggestedPriceResponse | null>(null);
  readonly suggestedLoading = signal(false);
  readonly suggestedError = signal<string | null>(null);
  readonly missingVariants = signal<number[]>([]);

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
      const subtotal = products.reduce(
        (sum: number, p: ProductCostView) => sum + p.basePrice,
        0,
      );
      return {
        categoryName: catName,
        categoryId: group.categoryId ?? 0,
        products,
        subtotal,
      };
    });
  });

  readonly totalCost = computed(() => {
    const costs = this.groupCosts();
    return costs.reduce((sum, g) => sum + g.subtotal, 0);
  });

  readonly productCount = computed(() => {
    const costs = this.groupCosts();
    return costs.reduce((count, g) => count + g.products.length, 0);
  });

  constructor() {
    this.reference.loadIfStale();

    effect(() => {
      if (this.wizard.steps().some((s) => s.id === STEP_PRICING_ID)) {
        this.wizard.markStepCompleted(STEP_PRICING_ID);
      }
    });
  }

  onBasePriceChange(value: number | null): void {
    this.wizard.updateData({ basePrice: value });
  }

  onActiveChange(value: boolean): void {
    this.wizard.updateData({ active: value });
  }

  calculatePrice(): void {
    const id = this.sourceId();
    if (id === null) return;

    this.suggestedLoading.set(true);
    this.suggestedError.set(null);
    this.suggestedResult.set(null);
    this.missingVariants.set([]);

    this.specialSelections.suggestPrice(id, this.margin()).subscribe({
      next: (result: SuggestedPriceResponse) => {
        this.suggestedResult.set(result);
        this.suggestedLoading.set(false);
      },
      error: (err: unknown) => {
        this.suggestedLoading.set(false);
        if (err instanceof HttpErrorResponse && err.status === 422) {
          const body = err.error as {
            missingVariants?: number[];
            message?: string;
          } | null;
          this.suggestedError.set(
            body?.message ?? 'Error al calcular precio sugerido',
          );
          this.missingVariants.set(body?.missingVariants ?? []);
          return;
        }
        if (err instanceof HttpErrorResponse) {
          this.suggestedError.set(err.message);
        } else {
          this.suggestedError.set(
            err instanceof Error
              ? err.message
              : 'Error al calcular precio sugerido',
          );
        }
      },
    });
  }

  applySuggestedPrice(): void {
    const result = this.suggestedResult();
    if (result !== null) {
      this.wizard.updateData({ basePrice: result.suggestedPrice });
    }
  }
}

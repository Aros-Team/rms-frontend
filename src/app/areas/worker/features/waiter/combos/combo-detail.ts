import {
  Component,
  inject,
  signal,
  computed,
  effect,
  ChangeDetectionStrategy,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DestroyRef } from '@angular/core';

import { SpecialSelectionsCache } from '@app/core/services/special-selections/special-selections-cache';
import { OrderDock, DockItem, DockOptionGroup } from '@app/core/services/order-dock/order-dock';
import { MasterData } from '@app/core/services/master-data/master-data';
import { toAmount } from '@app/shared/models/dto/common/money';
import { Money } from '@app/shared/pipes/money/money';
import type { SpecialSelectionAdditionResponse } from '@app/shared/models/dto/special-selections/special-selection-addition';
import type { SpecialSelectionGroupResponse } from '@app/shared/models/dto/special-selections/special-selection-group';
import type { SpecialSelectionQuestionResponse } from '@app/shared/models/dto/special-selections/special-selection-question';

import { RmsButton } from '@app/shared/ui/button/button';
import { RmsEmptyState } from '@app/shared/ui/empty-state/empty-state';
import { RmsInput } from '@app/shared/ui/input/input';
import { RmsPageHeader } from '@app/shared/ui/page-header/page-header';
import { RmsSkeleton } from '@app/shared/ui/skeleton/skeleton';

/**
 * Waiter combo detail.
 *
 * Feature: choose the products and additions of a combo and add it to the cart.
 *
 * Contract:
 *  - reads the public `GET /v1/special-selections/{productId}` endpoint, never
 *    the admin one (P3-WA-14);
 *  - group titles come from the product categories already loaded, with a
 *    numbered fallback instead of a generic "Grupo" (P3-WA-15);
 *  - group products render their real names, not `Producto #12`;
 *  - required groups and questions are validated inline and the errors stay
 *    visible until the waiter fixes them.
 */
@Component({
  selector: 'app-combo-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './combo-detail.html',
  styleUrl: './combo-detail.css',
  imports: [FormsModule, Money, RmsButton, RmsEmptyState, RmsInput, RmsPageHeader, RmsSkeleton],
})
export class ComboDetail {
  private readonly cache = inject(SpecialSelectionsCache);
  private readonly dock = inject(OrderDock);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly messageService = inject(MessageService);
  private readonly masterData = inject(MasterData);
  private readonly destroyRef = inject(DestroyRef);

  private readonly routeParams = toSignal(this.route.paramMap);

  readonly comboId = computed(() => {
    const params = this.routeParams();
    if (!params) return null;
    const id = params.get('id');
    return id ? Number(id) : null;
  });

  private readonly detailCache = computed(() => {
    const id = this.comboId();
    return id === null ? null : this.cache.publicDetail(id);
  });

  readonly detail = computed(() => this.detailCache()?.data() ?? null);
  readonly loading = computed(() => this.detailCache()?.isLoading() ?? false);
  readonly loadError = computed(() => this.detailCache()?.error() ?? null);

  readonly validationErrors = signal<string[]>([]);
  readonly selectedOptions = signal<Map<number, number[]>>(new Map());
  readonly selectedAdditionIds = signal<number[]>([]);
  readonly clarifications = signal<Map<number, string>>(new Map());

  private readonly categoryNames = signal<Map<number, string>>(new Map());
  private readonly productsById = signal<Map<number, { name: string }>>(new Map());

  private readonly moneyPipe = new Money();

  readonly canSubmit = computed(() => this.detail() !== null && !this.loading());

  readonly additionLabels = computed(() => {
    const labels = new Map<number, string>();
    for (const addition of this.detail()?.additions ?? []) {
      labels.set(
        addition.id,
        `${addition.name} (+${this.moneyPipe.transform(toAmount(addition.extraPrice))})`,
      );
    }
    return labels;
  });

  readonly comboTotal = computed(() => {
    const combo = this.detail();
    if (!combo) return 0;
    const additions = combo.additions
      .filter((addition) => this.selectedAdditionIds().includes(addition.id))
      .reduce((sum, addition) => sum + toAmount(addition.extraPrice), 0);
    return toAmount(combo.basePrice) + additions;
  });

  constructor() {
    this.loadReferenceData();

    effect(() => {
      const id = this.comboId();
      if (id === null) return;
      this.selectedOptions.set(new Map());
      this.selectedAdditionIds.set([]);
      this.clarifications.set(new Map());
      this.validationErrors.set([]);
      this.cache.publicDetail(id).load();
    });
  }

  private loadReferenceData(): void {
    const apply = (): void => {
      this.categoryNames.set(this.masterData.getCategoryNames());
      this.productsById.set(this.masterData.getProductsById());
    };

    if (this.masterData.snapshot) {
      apply();
      return;
    }

    this.masterData
      .load()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: apply, error: () => undefined });
  }

  groupName(group: SpecialSelectionGroupResponse): string {
    if (group.categoryName) return group.categoryName;
    if (group.categoryId !== null) {
      const name = this.categoryNames().get(group.categoryId);
      if (name) return name;
    }
    return `Selección ${String(group.displayOrder)}`;
  }

  productName(productId: number): string {
    return this.productsById().get(productId)?.name ?? `Selección ${String(productId)}`;
  }

  additionLabel(addition: SpecialSelectionAdditionResponse): string {
    return this.additionLabels().get(addition.id) ?? addition.name;
  }

  isSelected(groupId: number, productId: number): boolean {
    return this.selectedOptions().get(groupId)?.includes(productId) ?? false;
  }

  isAdditionSelected(additionId: number): boolean {
    return this.selectedAdditionIds().includes(additionId);
  }

  toggleOption(group: SpecialSelectionGroupResponse, productId: number): void {
    this.validationErrors.set([]);
    this.selectedOptions.update((map) => {
      const next = new Map(map);
      const current = next.get(group.id) ?? [];

      if (group.maxSelections === 1) {
        next.set(group.id, [productId]);
        return next;
      }

      if (current.includes(productId)) {
        const filtered = current.filter((id) => id !== productId);
        if (filtered.length === 0) next.delete(group.id);
        else next.set(group.id, filtered);
        return next;
      }

      if (current.length >= group.maxSelections) {
        this.validationErrors.set([
          `Puedes elegir hasta ${String(group.maxSelections)} en ${this.groupName(group)}.`,
        ]);
        return next;
      }

      next.set(group.id, [...current, productId]);
      return next;
    });
  }

  toggleAddition(additionId: number): void {
    this.selectedAdditionIds.update((ids) =>
      ids.includes(additionId) ? ids.filter((id) => id !== additionId) : [...ids, additionId],
    );
  }

  setClarification(questionId: number, answer: string): void {
    this.validationErrors.set([]);
    this.clarifications.update((map) => {
      const next = new Map(map);
      if (answer.trim().length > 0) next.set(questionId, answer);
      else next.delete(questionId);
      return next;
    });
  }

  isBooleanQuestion(question: SpecialSelectionQuestionResponse): boolean {
    return question.questionType === 'BOOLEAN';
  }

  setBooleanAnswer(questionId: number, answer: string): void {
    this.setClarification(questionId, answer);
  }

  submitOrder(): void {
    const combo = this.detail();
    if (!combo || this.loading()) return;

    const errors: string[] = [];
    for (const group of combo.groups) {
      if (group.required) {
        const selected = this.selectedOptions().get(group.id);
        if (!selected || selected.length === 0) {
          errors.push(`Elige ${this.groupName(group)}.`);
        }
      }
    }

    for (const question of combo.questions) {
      if (!question.required) continue;
      const answer = this.clarifications().get(question.id);
      if (!answer || answer.trim().length === 0) {
        errors.push(`Responde: ${question.question}`);
      }
    }

    if (errors.length > 0) {
      this.validationErrors.set(errors);
      return;
    }

    const productIds: number[] = [];
    const optionGroups: DockOptionGroup[] = [];

    for (const group of combo.groups) {
      const selected = this.selectedOptions().get(group.id) ?? [];
      if (selected.length === 0) continue;
      productIds.push(...selected);
      optionGroups.push({
        groupName: this.groupName(group),
        optionNames: selected.map((id) => this.productName(id)),
      });
    }

    const extraCharge = combo.additions
      .filter((addition) => this.selectedAdditionIds().includes(addition.id))
      .reduce((sum, addition) => sum + toAmount(addition.extraPrice), 0);

    const item: DockItem = {
      product: {
        id: combo.productId,
        name: combo.name,
        basePrice: combo.basePrice,
        active: true,
        categoryId: 0,
        categoryName: '',
        areaId: combo.preparationAreaId,
      },
      instructions: '',
      selectedOptionIds: [],
      selectedProductIds: productIds,
      optionNames: optionGroups.flatMap((group) => group.optionNames),
      optionGroups,
      quantity: 1,
      additionIds: this.selectedAdditionIds(),
      extraCharge,
      clarifications: [...this.clarifications().entries()].map(([questionId, answer]) => ({
        questionId,
        answer,
      })),
    };

    this.dock.addItemToDiner(item);
    this.messageService.add({
      severity: 'success',
      summary: 'Combo agregado',
      detail: `${combo.name} está en el pedido.`,
    });

    void this.router.navigate(['/worker/waiter'], { queryParams: { tab: 'menu' } });
  }

  goBack(): void {
    void this.router.navigate(['/worker/waiter'], { queryParams: { tab: 'menu' } });
  }

  retry(): void {
    this.detailCache()?.load();
  }
}

import { Component, inject, signal, computed, effect, ChangeDetectionStrategy } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';

import { ButtonModule } from 'primeng/button';
import { ChipModule } from 'primeng/chip';
import { InputTextModule } from 'primeng/inputtext';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';

import { SpecialSelectionsCacheService } from '@app/core/services/special-selections/special-selections-cache.service';
import { OrderDock, DockItem } from '@app/core/services/order-dock/order-dock';
import { MasterData } from '@app/core/services/master-data/master-data';

@Component({
  selector: 'app-combo-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './combo-detail.html',
  styleUrl: './combo-detail.css',
  imports: [ButtonModule, ChipModule, InputTextModule, ToastModule],
})
export class ComboDetail {
  private cache = inject(SpecialSelectionsCacheService);
  private dock = inject(OrderDock);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private messageService = inject(MessageService);
  private masterData = inject(MasterData);

  private routeParams = toSignal(this.route.paramMap);

  comboId = computed(() => {
    const params = this.routeParams();
    if (!params) return null;
    const id = params.get('id');
    return id ? Number(id) : null;
  });

  detail = computed(() => {
    const id = this.comboId();
    if (id === null) return null;
    return this.cache.detail(id).data() ?? null;
  });

  loading = signal(true);

  /** groupId → selected optionIds */
  selectedOptions = signal<Map<number, number[]>>(new Map());
  selectedAdditionIds = signal<number[]>([]);

  /** questionId → answer */
  clarifications = signal<Map<number, string>>(new Map());

  currencyFormat = Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' });

  canSubmit = computed(() => this.detail() !== null);

  constructor() {
    effect(() => {
      const id = this.comboId();
      if (id !== null) {
        this.selectedOptions.set(new Map());
        this.selectedAdditionIds.set([]);
        this.clarifications.set(new Map());
        this.loading.set(true);
        this.cache.detail(id).load();
      }
    });

    effect(() => {
      if (this.detail() !== null) {
        this.loading.set(false);
      }
    });
  }

  toggleOption(groupId: number, optionId: number): void {
    this.selectedOptions.update((map) => {
      const next = new Map(map);
      const group = this.detail()?.groups.find((g) => g.id === groupId);
      if (!group) return next;

      const current = next.get(groupId) ?? [];

      if (group.maxSelections === 1) {
        // Single-select: always replace (no toggle-off)
        next.set(groupId, [optionId]);
      } else {
        // Multi-select: toggle
        if (current.includes(optionId)) {
          const filtered = current.filter((id) => id !== optionId);
          if (filtered.length === 0) {
            next.delete(groupId);
          } else {
            next.set(groupId, filtered);
          }
        } else {
          next.set(groupId, [...current, optionId]);
        }
      }

      return next;
    });
  }

  toggleAddition(additionId: number): void {
    this.selectedAdditionIds.update((ids) => {
      if (ids.includes(additionId)) {
        return ids.filter((id) => id !== additionId);
      }
      return [...ids, additionId];
    });
  }

  setClarification(questionId: number, answer: string): void {
    this.clarifications.update((m) => {
      const next = new Map(m);
      if (answer) {
        next.set(questionId, answer);
      } else {
        next.delete(questionId);
      }
      return next;
    });
  }

  submitOrder(): void {
    const combo = this.detail();
    if (!combo) return;

    // ── Validation ──
    const errors: string[] = [];

    for (const group of combo.groups) {
      if (group.required) {
        const selected = this.selectedOptions().get(group.id);
        if (!selected || selected.length === 0) {
          errors.push(`Debes seleccionar un producto para "${group.categoryName ?? 'este grupo'}".`);
        }
      }
    }

    for (const q of combo.questions) {
      if (q.required) {
        const answer = this.clarifications().get(q.id);
        if (!answer || answer.trim().length === 0) {
          errors.push(`Debes responder: "${q.question}".`);
        }
      }
    }

    if (errors.length > 0) {
      for (const err of errors) {
        this.messageService.add({
          severity: 'error',
          summary: 'Validación',
          detail: err,
        });
      }
      return;
    }

    // ── Build DockItem ──
    const productIds: number[] = [];

    for (const [, selected] of this.selectedOptions()) {
      for (const productId of selected) {
        productIds.push(productId);
      }
    }

    const item: DockItem = {
      product: {
        id: combo.id,
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
      optionNames: [],
      quantity: 1,
      additionIds: this.selectedAdditionIds(),
      clarifications: Array.from(this.clarifications().entries()).map(([questionId, answer]) => ({ questionId, answer })),
    };

    this.dock.addItemToDiner(item);

    this.messageService.add({
      severity: 'success',
      summary: 'Éxito',
      detail: 'Combo agregado al pedido',
    });

    void this.router.navigate(['/worker'], { queryParams: { tab: 'menu' } });
  }
}

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';

import { mapHttpError } from '@app/shared/lib/http-error-mapper/http-error-mapper';
import {
  DockItem,
  DockOptionGroup,
  OrderDock as OrderDockSvc,
  itemTotal,
  tableStatusLabel,
} from '@app/core/services/order-dock/order-dock';
import { Order } from '@app/core/services/orders/order';
import { MasterData } from '@app/core/services/master-data/master-data';
import type { RmsStatus } from '@app/shared/ui/types/ui-types';
import type { ProductListResponse } from '@app/shared/models/dto/products/product-list-response';
import type { ProductOption } from '@app/shared/models/dto/products/product-option';
import type { TableResponse } from '@app/shared/models/dto/tables/table-response';
import type { CreateOrderDetail } from '@app/shared/models/dto/orders/create-order-request';
import { Money } from '@app/shared/pipes/money/money';

import { RmsButton } from '@app/shared/ui/button/button';
import { RmsIconButton } from '@app/shared/ui/icon-button/icon-button';
import { RmsSheet } from '@app/shared/ui/sheet/sheet';
import { RmsStatusPill } from '@app/shared/ui/status-pill/status-pill';
import {
  ProductOptionsModal,
  ProductOptionsConfirmEvent,
} from '@app/shared/components/product-options-modal/product-options-modal';
import { WaiterTablePicker } from '@app/areas/worker/features/waiter/table-picker/table-picker';

interface SummaryLine {
  dinerId: number;
  text: string;
}

interface SubmitLine {
  dinerId: number;
  details: CreateOrderDetail[];
}

const TABLE_TONE: Record<TableResponse['status'], RmsStatus> = {
  AVAILABLE: 'success',
  OCCUPIED: 'info',
  RESERVED: 'warning',
};

/**
 * Waiter cart.
 *
 * Feature: compose and send an order from a phone, with a clear table context.
 *
 * Contract:
 *  - the trigger is one floating action, not a second bottom bar, so the shell
 *    navigation remains the only fixed bar;
 *  - the cart shows quantities, notes, option/combo groups and the running
 *    total (base + surcharges); the API remains authoritative on submit;
 *  - the table picker is reused from `app-waiter-table-picker`, so the same
 *    occupancy rules apply everywhere;
 *  - confirmation is a separate step and double submit is blocked by
 *    `submitting`, including a disabled confirm button;
 *  - failures keep the cart intact and show the RFC 7807 `detail` in a
 *    persistent banner, with the send action available to retry.
 */
@Component({
  selector: 'app-order-dock',
  templateUrl: './order-dock.html',
  styleUrl: './order-dock.css',
  imports: [
    CommonModule,
    Money,
    RmsButton,
    RmsIconButton,
    RmsSheet,
    RmsStatusPill,
    ProductOptionsModal,
    WaiterTablePicker,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderDock {
  protected readonly dock = inject(OrderDockSvc);
  private readonly orderService = inject(Order);
  private readonly messageService = inject(MessageService);
  private readonly masterData = inject(MasterData);
  private readonly router = inject(Router);
  private readonly moneyPipe = new Money();

  readonly sheetOpen = signal(false);
  readonly tablePickerOpen = signal(false);
  readonly confirmOpen = signal(false);
  readonly submitting = signal(false);
  readonly submitError = signal<string | null>(null);

  readonly removeDinerIndex = signal<number | null>(null);

  /* ── Edit item ── */
  readonly editItemIndex = signal<number | null>(null);
  readonly editProduct = signal<ProductListResponse | null>(null);
  readonly editOptions = signal<ProductOption[]>([]);
  readonly editOptionsLoading = signal(false);
  readonly editOptionsError = signal<string | null>(null);
  readonly editVisible = signal(false);
  readonly editInitialOptionIds = signal<number[]>([]);
  readonly editInitialInstructions = signal('');
  readonly editInitialQuantity = signal(1);
  private optionsSeq = 0;

  readonly selectedTable = computed(() => this.dock.selectedTable());
  readonly tableStatus = computed<RmsStatus | null>(() => {
    const table = this.dock.selectedTable();
    return table ? TABLE_TONE[table.status] : null;
  });
  readonly tableStatusText = computed(() => {
    const table = this.dock.selectedTable();
    return table ? tableStatusLabel(table.status) : 'Sin mesa';
  });

  readonly cartAriaLabel = computed(() => {
    const table = this.dock.selectedTableLabel();
    const count = this.dock.totalItems();
    const total = this.moneyPipe.transform(this.dock.totalAmount());
    const productWord = count === 1 ? 'producto' : 'productos';
    if (count === 0) {
      return `Pedido vacío. ${table}. Abre el pedido para revisarlo.`;
    }
    // The accessible name must start with the visible badge, table and total so
    // `label-content-name-mismatch` holds; the summary follows the same order.
    return `${String(count)} ${table}. ${total}. Abrir el pedido: ${String(count)} ${productWord}.`;
  });

  readonly sheetTitle = computed(() => (this.confirmOpen() ? 'Confirmar envío' : 'Tu pedido'));

  readonly removeDinerData = computed(() => {
    const index = this.removeDinerIndex();
    if (index === null) return null;
    return this.dock.diners()[index] ?? null;
  });

  readonly summaryLines = computed<SummaryLine[]>(() => {
    const lines: SummaryLine[] = [];
    for (const diner of this.dock.diners()) {
      for (const item of diner.items) {
        let text = `${String(item.quantity)}× ${item.product.name}`;
        const groups = item.optionGroups?.flatMap((group) => group.optionNames) ?? [];
        const extras = [...item.optionNames, ...groups].filter((name) => name.length > 0);
        if (extras.length > 0) text += ` (${extras.join(', ')})`;
        if (item.instructions) text += ` — “${item.instructions}”`;
        lines.push({ dinerId: diner.id, text });
      }
    }
    return lines;
  });

  readonly sendDisabledReason = computed(() => {
    if (this.submitting()) return 'Enviando el pedido…';
    if (this.submitError()) return 'Revisa el error y reintenta.';
    if (!this.dock.hasItems()) return 'Agrega al menos un producto.';
    if (!this.dock.hasSelectedTable()) return 'Elige una mesa antes de enviar.';
    return '';
  });

  readonly canSend = computed(
    () => this.dock.canPlaceOrder() && !this.submitting() && this.submitError() === null,
  );

  constructor() {
    if (this.dock.allTables().length === 0 && !this.dock.tablesLoading()) {
      this.dock.loadAvailableTables();
    }
  }

  /* ── Sheet ── */

  openCart(): void {
    this.sheetOpen.set(true);
  }

  closeCart(): void {
    if (this.submitting()) return;
    this.sheetOpen.set(false);
    this.tablePickerOpen.set(false);
    this.confirmOpen.set(false);
    this.removeDinerIndex.set(null);
  }

  /** Keep the confirmation state in sync when the native sheet closes itself. */
  onSheetOpenChange(open: boolean): void {
    this.sheetOpen.set(open);
    if (!open) {
      this.confirmOpen.set(false);
      this.removeDinerIndex.set(null);
    }
  }

  openTablePicker(): void {
    this.tablePickerOpen.set(true);
  }

  /* ── Quantities ── */

  increment(itemIndex: number): void {
    this.dock.incrementItemQuantity(itemIndex);
  }

  decrement(itemIndex: number): void {
    this.dock.decrementItemQuantity(itemIndex);
  }

  removeItem(itemIndex: number): void {
    this.dock.removeItemFromDiner(itemIndex);
  }

  lineTotal(item: DockItem): number {
    return itemTotal(item);
  }

  /* ── Diners ── */

  selectDiner(index: number): void {
    this.dock.selectDiner(index);
  }

  addDiner(): void {
    this.dock.addDiner();
  }

  requestRemoveDiner(): void {
    const index = this.dock.selectedDinerIndex();
    if (this.dock.diners().length <= 1) return;
    const diner = this.dock.diners()[index];
    if (diner.items.length > 0) {
      this.removeDinerIndex.set(index);
    } else {
      this.dock.removeDiner(index);
    }
  }

  confirmRemoveDiner(): void {
    const index = this.removeDinerIndex();
    if (index !== null) {
      this.dock.removeDiner(index);
      this.removeDinerIndex.set(null);
    }
  }

  cancelRemoveDiner(): void {
    this.removeDinerIndex.set(null);
  }

  /* ── Edit item ── */

  openEditModal(itemIndex: number): void {
    const diner = this.dock.selectedDiner();
    if (!diner || itemIndex >= diner.items.length) return;
    const item = diner.items[itemIndex];
    this.editItemIndex.set(itemIndex);
    this.editProduct.set(item.product);
    this.editInitialOptionIds.set(item.selectedOptionIds);
    this.editInitialInstructions.set(item.instructions);
    this.editInitialQuantity.set(item.quantity);
    // The options modal is a PrimeNG dialog; a native sheet is in the top
    // layer, so close it first or the dialog would render behind the scrim.
    this.sheetOpen.set(false);
    this.editVisible.set(true);
    this.loadEditOptions(item.product);
  }

  private loadEditOptions(product: ProductListResponse): void {
    const seq = ++this.optionsSeq;
    this.editOptionsLoading.set(true);
    this.editOptionsError.set(null);
    this.masterData.getProductOptions(product.id).subscribe({
      next: (options) => {
        if (seq !== this.optionsSeq) return;
        this.editOptions.set(options);
        this.editOptionsLoading.set(false);
      },
      error: () => {
        if (seq !== this.optionsSeq) return;
        this.editOptionsError.set('No se pudieron cargar las opciones. Intenta de nuevo.');
        this.editOptionsLoading.set(false);
      },
    });
  }

  onEditConfirm(event: ProductOptionsConfirmEvent): void {
    const index = this.editItemIndex();
    if (index === null) return;

    const groups = new Map<string, string[]>();
    for (const selected of event.selectedOptions) {
      const option = this.editOptions().find((candidate) => candidate.id === selected.optionId);
      if (!option) continue;
      const names = groups.get(option.optionGroupName) ?? [];
      names.push(option.name);
      groups.set(option.optionGroupName, names);
    }

    const updated: DockItem = {
      product: event.product,
      instructions: event.instructions,
      selectedOptionIds: event.selectedOptions.map((option) => option.optionId),
      optionNames: event.selectedOptions.map((option) => option.optionName),
      optionGroups: [...groups.entries()].map(([groupName, optionNames]) => ({
        groupName,
        optionNames,
      })),
      extraCharge: event.extraCharge,
      quantity: event.quantity,
    };

    this.dock.updateDinerItem(this.dock.selectedDinerIndex(), index, updated);
    this.closeEditModal();
  }

  closeEditModal(): void {
    this.editVisible.set(false);
    this.editItemIndex.set(null);
    this.editProduct.set(null);
    this.editOptions.set([]);
    this.editOptionsLoading.set(false);
    this.editOptionsError.set(null);
    // Return to the cart once the PrimeNG dialog is dismissed.
    this.sheetOpen.set(true);
  }

  /* ── Send ── */

  requestSend(): void {
    if (this.submitting()) return;
    if (!this.dock.hasSelectedTable()) {
      this.openTablePicker();
      return;
    }
    if (!this.dock.hasItems()) return;
    this.submitError.set(null);
    this.confirmOpen.set(true);
  }

  cancelSend(): void {
    if (this.submitting()) return;
    this.confirmOpen.set(false);
  }

  sendToKitchen(): void {
    if (this.submitting() || !this.dock.canPlaceOrder()) return;

    const tableId = this.dock.selectedTableId();
    if (tableId === null) {
      this.confirmOpen.set(false);
      this.openTablePicker();
      return;
    }

    const lines: SubmitLine[] = this.dock.getOrderDetailsForAllDiners();
    if (lines.length === 0) {
      this.confirmOpen.set(false);
      return;
    }

    this.submitting.set(true);
    this.submitError.set(null);

    this.orderService
      .createOrder({ tableId, details: lines.flatMap((line) => line.details) })
      .subscribe({
        next: (order) => {
          this.submitting.set(false);
          this.confirmOpen.set(false);
          this.sheetOpen.set(false);
          this.dock.clearAll();
          // Keep the table selected: the waiter may add another round to the
          // same table, and the requirement is that the table survives the
          // order. Refresh so its new occupancy is visible.
          this.dock.loadAvailableTables();
          this.messageService.add({
            severity: 'success',
            summary: 'Pedido enviado a cocina',
            detail: `Orden #${String(order.id)} · ${this.dock.selectedTableLabel()}`,
          });
          void this.router.navigate(['/worker/waiter'], { queryParams: { tab: 'pedidos' } });
        },
        error: (err: unknown) => {
          const httpErr = err instanceof HttpErrorResponse ? err : null;
          const detail = httpErr ? mapHttpError(httpErr, 'order') : 'No se pudo enviar el pedido.';
          this.submitting.set(false);
          this.confirmOpen.set(false);
          this.submitError.set(detail);
          this.dock.loadAvailableTables();
          this.messageService.add({
            severity: 'error',
            summary: httpErr?.status === 409 ? 'Mesa no disponible' : 'Error al enviar',
            detail,
            life: 8000,
          });
        },
      });
  }

  /** Retry after an RFC 7807 error without losing the composed cart. */
  retrySend(): void {
    if (this.submitting()) return;
    this.submitError.set(null);
    this.requestSend();
  }

  /* ── Helpers for the template ── */

  groupSummary(item: DockItem): string {
    const groups: DockOptionGroup[] = item.optionGroups ?? [];
    return groups
      .filter((group) => group.optionNames.length > 0)
      .map((group) => `${group.groupName}: ${group.optionNames.join(', ')}`)
      .join(' · ');
  }

  optionSummary(item: DockItem): string {
    return item.optionNames.join(', ');
  }

  trackDiner(_index: number, diner: { id: number }): number {
    return diner.id;
  }
}

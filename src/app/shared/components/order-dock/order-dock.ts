import { Component, inject, signal, computed, ElementRef, HostListener, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { OrderDock as OrderDockSvc, DockItem } from '@app/core/services/order-dock/order-dock';
import { Order } from '@app/core/services/orders/order';
import { MasterData } from '@app/core/services/master-data/master-data';
import { ProductListResponse } from '@app/shared/models/dto/products/product-list-response.model';
import { ProductOption } from '@app/shared/models/dto/products/product-option.model';
import { ProductOptionsModal, ProductOptionsConfirmEvent } from '@app/shared/components/product-options-modal/product-options-modal';

@Component({
  selector: 'app-order-dock',
  templateUrl: './order-dock.html',
  styleUrl: './order-dock.css',
  imports: [CommonModule, FormsModule, ConfirmDialogModule, DialogModule, SelectModule, InputTextModule, ProductOptionsModal],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderDock {
  protected dock = inject(OrderDockSvc);
  private orderService = inject(Order);
  private confirmationService = inject(ConfirmationService);
  private messageService = inject(MessageService);
  private masterData = inject(MasterData);

  /* ── Expand / collapse state ── */
  private readonly _expanded = signal(false);
  readonly isExpanded = this._expanded.asReadonly();

  /* ── Table popover state ── */
  readonly showTablePopover = signal(false);

  expand(): void {
    this._expanded.set(true);
  }

  collapse(): void {
    this._expanded.set(false);
    this.showTablePopover.set(false);
  }

  /** Tab click: toggle expand/collapse */
  onTabClick(): void {
    this._expanded.update(v => !v);
  }

  /** Click on table icon/name: toggle popover only, no expand */
  onTableInfoClick(): void {
    this.showTablePopover.update(v => !v);
  }

  onTableSelect(tableId: number): void {
    this.dock.selectTable(tableId);
    this.showTablePopover.set(false);
  }

  /* ── Touch swipe handling ── */
  private touchStartY = 0;

  onTouchStart(event: TouchEvent): void {
    this.touchStartY = event.touches[0].clientY;
  }

  onTouchEnd(event: TouchEvent): void {
    const deltaY = this.touchStartY - event.changedTouches[0].clientY;
    if (deltaY > 50) {
      this.expand();
    } else if (deltaY < -50) {
      this.collapse();
    }
  }

  /* ── Derived state ── */
  readonly selectedTable = computed(() => {
    const id = this.dock.selectedTableId();
    if (id === null) return null;
    return this.dock.availableTables().find(t => t.id === id) ?? null;
  });

  readonly totalItems = computed(() =>
    this.dock.diners().reduce((sum, d) => sum + d.items.length, 0)
  );

  private elRef = inject(ElementRef);

  /* ── Diners loading check ── */
  constructor() {
    if (this.dock.availableTables().length === 0 && !this.dock.tablesLoading()) {
      this.dock.loadAvailableTables();
    }
  }

  /** Click outside dock → collapse */
  @HostListener('document:click', ['$event'])
  onDocClick(event: MouseEvent): void {
    if (!this.isExpanded()) return;
    const target = event.target as HTMLElement;
    const el = this.elRef.nativeElement as HTMLElement;
    if (!el.contains(target)) {
      this._expanded.set(false);
    }
  }

  submitting = signal(false);

  /** Diner removal confirmation */
  dinerToRemove = signal<number | null>(null);
  showRemoveConfirm = computed(() => this.dinerToRemove() !== null);
  dinerRemoveData = computed(() => {
    const idx = this.dinerToRemove();
    if (idx === null) return null;
    const diners = this.dock.diners();
    return idx < diners.length ? diners[idx] : null;
  });

  /* ── Edit modal state ── */
  editItemIndex = signal<number | null>(null);
  editProduct = signal<ProductListResponse | null>(null);
  editOptions = signal<ProductOption[]>([]);
  editOptionsLoading = signal(false);
  editOptionsError = signal<string | null>(null);
  showEditModal = signal(false);

  // Pre-fill for editing existing items
  editInitialOptionIds = signal<number[]>([]);
  editInitialInstructions = signal<string>('');
  editInitialQuantity = signal<number>(1);

  private optionsSeq = 0;

  openEditModal(itemIndex: number): void {
    const diner = this.dock.selectedDiner();
    if (!diner || itemIndex >= diner.items.length) return;
    const item = diner.items[itemIndex];
    this.editItemIndex.set(itemIndex);
    this.editProduct.set(item.product);
    this.editInitialOptionIds.set(item.selectedOptionIds);
    this.editInitialInstructions.set(item.instructions);
    this.editInitialQuantity.set(item.quantity);
    this.showEditModal.set(true);
    this.loadEditOptions(item.product);
  }

  private loadEditOptions(product: ProductListResponse): void {
    const seq = ++this.optionsSeq;
    this.editOptionsLoading.set(true);
    this.editOptionsError.set(null);
    this.masterData.getProductOptions(product.id).subscribe({
      next: (opts) => {
        if (seq !== this.optionsSeq) return;
        this.editOptions.set(opts);
        this.editOptionsLoading.set(false);
      },
      error: () => {
        if (seq !== this.optionsSeq) return;
        this.editOptionsError.set('Error al cargar opciones');
        this.editOptionsLoading.set(false);
      }
    });
  }

  onEditConfirm(event: ProductOptionsConfirmEvent): void {
    const index = this.editItemIndex();
    if (index === null) return;
    const updatedItem: DockItem = {
      product: event.product,
      instructions: event.instructions,
      selectedOptionIds: event.selectedOptions.map(o => o.optionId),
      optionNames: event.selectedOptions.map(o => o.optionName),
      quantity: event.quantity,
    };
    this.dock.updateDinerItem(this.dock.selectedDinerIndex(), index, updatedItem);
    this.closeEditModal();
  }

  closeEditModal(): void {
    this.showEditModal.set(false);
    this.editItemIndex.set(null);
    this.editProduct.set(null);
    this.editOptions.set([]);
    this.editOptionsLoading.set(false);
    this.editOptionsError.set(null);
  }

  /* ── Narrative order summary ── */
  showNarrativeSummary = signal(false);
  narrativeSummary = signal('');

  generateNarrative(): string {
    const table = this.selectedTable();
    const tableName = table ? `Mesa ${String(table.tableNumber)}` : 'Sin mesa asignada';
    const diners = this.dock.diners();
    let text = `<strong>${tableName}</strong>, para ${String(diners.length)} comensal(es):<br><br>`;

    for (const diner of diners) {
      if (diner.items.length === 0) continue;
      const itemsSummary = diner.items.map(item => {
        let desc = `${String(item.quantity)}x ${item.product.name}`;
        if (item.optionNames.length > 0) {
          desc += ` (${item.optionNames.join(', ')})`;
        }
        if (item.instructions) {
          desc += ` — "${item.instructions}"`;
        }
        return desc;
      }).join(', ');
      text += `<strong>Comensal ${String(diner.id)}:</strong> ${itemsSummary}<br>`;
    }

    text += `<br>¿Está todo correcto?`;
    return text;
  }

  placeOrderWithNarrative(): void {
    if (!this.dock.canPlaceOrder()) return;
    this.narrativeSummary.set(this.generateNarrative());
    this.showNarrativeSummary.set(true);
  }

  confirmNarrativeOrder(): void {
    this.showNarrativeSummary.set(false);
    if (!this.dock.hasSelectedTable()) {
      this.messageService.add({ severity: 'warn', summary: 'Seleccionar mesa', detail: 'Debe seleccionar una mesa antes de colocar el pedido.' });
      return;
    }
    const previewOrders = this.dock.getOrderDetailsForAllDiners();
    if (previewOrders.length === 0) return;
    this.submitOrders(previewOrders);
  }

  cancelNarrativeOrder(): void {
    this.showNarrativeSummary.set(false);
  }

  private submitOrders(allDinerOrders: { dinerId: number; details: import('@app/shared/models/dto/orders/create-order-request.model').CreateOrderDetail[] }[]): void {
    this.submitting.set(true);

    const tableId = this.dock.selectedTableId();
    if (tableId === null) {
      this.messageService.add({ severity: 'warn', summary: 'Seleccionar mesa', detail: 'Debe seleccionar una mesa antes de colocar el pedido.' });
      this.submitting.set(false);
      return;
    }

    this.orderService.createOrder({
      tableId,
      details: allDinerOrders.flatMap(d => d.details),
    }).subscribe({
      next: (order) => {
        this.messageService.add({ severity: 'success', summary: 'Pedido creado', detail: `Orden #${String(order.id)} creada exitosamente` });
        this.dock.clearAll();
        this.dock.resetTableSelection();
        this.dock.loadAvailableTables();
        this.submitting.set(false);
      },
      error: (err) => {
        const status = err instanceof HttpErrorResponse ? err.status : 0;
        const summary = status === 409 ? 'Conflicto'
                      : status === 400 ? 'Datos inválidos'
                      : 'Error al crear pedido';
        this.messageService.add({
          severity: status === 400 ? 'warn' : 'error',
          summary,
          detail: extractError(err),
          life: 6000,
        });
        this.dock.loadAvailableTables();
        this.submitting.set(false);
      }
    });
  }

  onDinerSelect(index: number): void {
    this.dock.selectDiner(index);
  }

  onAddDiner(): void {
    this.dock.addDiner();
  }

  onRemoveDiner(): void {
    const index = this.dock.selectedDinerIndex();
    const diners = this.dock.diners();
    if (diners.length <= 1) return;
    const target = diners[index];
    if (target.items.length > 0) {
      // Show confirmation — diner has items
      this.dinerToRemove.set(index);
    } else {
      // No items, remove immediately
      this.dock.removeDiner(index);
    }
  }

  confirmRemoveDiner(): void {
    const index = this.dinerToRemove();
    if (index !== null) {
      this.dock.removeDiner(index);
      this.dinerToRemove.set(null);
    }
  }

  cancelRemoveDiner(): void {
    this.dinerToRemove.set(null);
  }

  onRemoveItem(index: number): void {
    this.dock.removeItemFromDiner(index);
  }

  trackByDinerId(_index: number, diner: { id: number }): number {
    return diner.id;
  }
}

function extractError(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    const errorBody: unknown = err.error;
    const body = errorBody as { message?: string } | null;
    return body?.message ?? err.message;
  }
  if (err instanceof Error) return err.message;
  return 'Error desconocido';
}

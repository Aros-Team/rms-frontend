import { Component, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { SelectModule } from 'primeng/select';
import { OrderDock as OrderDockSvc } from '@app/core/services/order-dock/order-dock';
import { Order } from '@app/core/services/orders/order';

@Component({
  selector: 'app-order-dock',
  templateUrl: './order-dock.html',
  styleUrl: './order-dock.css',
  imports: [CommonModule, FormsModule, ConfirmDialogModule, SelectModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderDock {
  protected dock = inject(OrderDockSvc);
  private orderService = inject(Order);
  private confirmationService = inject(ConfirmationService);
  private messageService = inject(MessageService);

  constructor() {
    if (this.dock.availableTables().length === 0 && !this.dock.tablesLoading()) {
      this.dock.loadAvailableTables();
    }
  }

  submitting = signal(false);
  showDinerList = signal(false);

  /** Diner removal confirmation */
  dinerToRemove = signal<number | null>(null);
  showRemoveConfirm = computed(() => this.dinerToRemove() !== null);
  dinerRemoveData = computed(() => {
    const idx = this.dinerToRemove();
    if (idx === null) return null;
    const diners = this.dock.diners();
    return idx < diners.length ? diners[idx] : null;
  });

  placeOrder(): void {
    if (!this.dock.canPlaceOrder()) return;

    // Preview for dialog message (ok if slightly stale — for display only)
    const previewOrders = this.dock.getOrderDetailsForAllDiners();
    if (previewOrders.length === 0) return;

    const totalItems = previewOrders.reduce((sum, d) => sum + d.details.length, 0);

    this.confirmationService.confirm({
      header: 'Confirmar Pedido',
      message: `¿Estás seguro de querer colocar ${String(totalItems)} producto(s) para ${String(previewOrders.length)} comensal(es)?<br><br><strong>Nota:</strong> Una vez colocado, no se puede cancelar.`,
      acceptLabel: 'Sí, colocar pedido',
      rejectLabel: 'Cancelar',
      acceptButtonProps: {
        class: 'bg-primary-500 hover:bg-primary-600 text-slate-900 font-bold px-6 py-2 rounded-xl',
      },
      rejectButtonProps: {
        class: 'text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700 px-4 py-2 rounded-xl',
      },
      accept: () => {
        // Capture fresh snapshot AFTER user confirms (fix stale snapshot)
        const freshOrders = this.dock.getOrderDetailsForAllDiners();
        if (freshOrders.length === 0) return;
        this.submitOrders(freshOrders);
      },
    });
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
        this.submitting.set(false);
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: extractError(err) });
        this.submitting.set(false);
      }
    });
  }

  toggleDinerList(): void {
    this.showDinerList.update(v => !v);
  }

  onDinerSelect(index: number): void {
    this.dock.selectDiner(index);
    this.showDinerList.set(false);
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

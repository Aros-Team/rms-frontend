import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { OrderDock as OrderDockSvc } from '@app/core/services/order-dock/order-dock';
import { Order } from '@app/core/services/orders/order';
import { MasterData } from '@app/core/services/master-data/master-data';

@Component({
  selector: 'app-order-dock',
  templateUrl: './order-dock.html',
  styleUrl: './order-dock.css',
  imports: [CommonModule, FormsModule, ConfirmDialogModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderDock {
  protected dock = inject(OrderDockSvc);
  private orderService = inject(Order);
  private masterData = inject(MasterData);
  private confirmationService = inject(ConfirmationService);
  private messageService = inject(MessageService);

  submitting = signal(false);
  showDinerList = signal(false);

  placeOrder(): void {
    if (!this.dock.canPlaceOrder()) return;

    const allDinerOrders = this.dock.getOrderDetailsForAllDiners();
    if (allDinerOrders.length === 0) return;

    const totalItems = allDinerOrders.reduce((sum, d) => sum + d.details.length, 0);

    this.confirmationService.confirm({
      header: 'Confirmar Pedido',
      message: `¿Estás seguro de querer colocar ${String(totalItems)} producto(s) para ${String(allDinerOrders.length)} comensal(es)?<br><br><strong>Nota:</strong> Una vez colocado, no se puede cancelar.`,
      acceptLabel: 'Sí, colocar pedido',
      rejectLabel: 'Cancelar',
      acceptButtonProps: {
        class: 'bg-primary-500 hover:bg-primary-600 text-slate-900 font-bold px-6 py-2 rounded-xl',
      },
      rejectButtonProps: {
        class: 'text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700 px-4 py-2 rounded-xl',
      },
      accept: () => {
        this.submitOrders(allDinerOrders);
      },
    });
  }

  private submitOrders(allDinerOrders: { dinerId: number; details: import('@app/shared/models/dto/orders/create-order-request.model').CreateOrderDetail[] }[]): void {
    this.submitting.set(true);

    const tableId = this.findAvailableTable();
    if (!tableId) {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No hay mesas disponibles. Libera una mesa primero.' });
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
        this.submitting.set(false);
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: extractError(err) });
        this.submitting.set(false);
      }
    });
  }

  private findAvailableTable(): number | null {
    const tables = this.masterData.getAvailableTables();
    return tables.length > 0 ? tables[0].id : null;
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
    this.dock.removeDiner();
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

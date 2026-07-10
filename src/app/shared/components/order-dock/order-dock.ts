import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConfirmationService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { OrderDock } from '@app/core/services/order-dock/order-dock';
import { Order } from '@app/core/services/orders/order';
import { Logging } from '@app/core/services/logging/logging';
import { MasterData } from '@app/core/services/master-data/master-data';

@Component({
  selector: 'app-order-dock',
  templateUrl: './order-dock.html',
  imports: [CommonModule, FormsModule, ConfirmDialogModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderDockComponent {
  protected dock = inject(OrderDock);
  private orderService = inject(Order);
  private logger = inject(Logging);
  private masterData = inject(MasterData);
  private confirmationService = inject(ConfirmationService);

  submitting = signal(false);
  successMessage = signal<string | null>(null);
  errorMessage = signal<string | null>(null);
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
    this.errorMessage.set(null);

    const tableId = this.findAvailableTable();
    if (!tableId) {
      this.errorMessage.set('No hay mesas disponibles. Libera una mesa primero.');
      this.submitting.set(false);
      return;
    }

    this.orderService.createOrder({
      tableId,
      details: allDinerOrders.flatMap(d => d.details),
    }).subscribe({
      next: (order) => {
        this.logger.info('OrderDock: order created', order);
        this.successMessage.set(`Orden #${String(order.id)} creada exitosamente`);
        this.dock.clearAll();
        this.submitting.set(false);
      },
      error: (err) => {
        this.logger.error('OrderDock: create order failed', err);
        this.errorMessage.set('No se pudo crear la orden. Intenta de nuevo.');
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

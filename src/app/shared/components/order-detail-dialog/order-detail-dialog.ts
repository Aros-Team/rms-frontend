import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogModule } from 'primeng/dialog';
import { OrderResponse, calculateTotalPrice } from '@app/shared/models/dto/orders/order-response';
import { Money } from '@app/shared/pipes/money/money';

@Component({
  selector: 'app-order-detail-dialog',
  imports: [CommonModule, DialogModule, Money],
  templateUrl: './order-detail-dialog.html',
})
export class OrderDetailDialog {
  @Input() visible = false;
  @Input() order: OrderResponse | null = null;

  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() closed = new EventEmitter<void>();

  /** Delegates to the DTO helper so `extraCharge` is folded in exactly once. */
  getTotalPrice(): number {
    if (!this.order) return 0;
    return calculateTotalPrice(this.order);
  }

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'DELIVERED':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'READY':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'PREPARING':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'QUEUE':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
      case 'CANCELLED':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default:
        return 'bg-surface-100 text-surface-800 dark:bg-surface-700 dark:text-surface-300';
    }
  }

  getStatusText(status: string): string {
    switch (status) {
      case 'DELIVERED':
        return 'Completado';
      case 'READY':
        return 'Listo';
      case 'PREPARING':
        return 'En preparación';
      case 'QUEUE':
        return 'En cola';
      case 'CANCELLED':
        return 'Cancelado';
      default:
        return status;
    }
  }

  onClose() {
    this.visible = false;
    this.visibleChange.emit(false);
    this.closed.emit();
  }
}
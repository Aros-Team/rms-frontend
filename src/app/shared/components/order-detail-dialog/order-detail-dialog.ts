import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogModule } from 'primeng/dialog';
import {
  type OrderDetailItem,
  type OrderResponse,
  calculateLineTotal,
  calculateTotalPrice,
} from '@app/shared/models/dto/orders/order-response';
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

  /**
   * Per-line money total.
   *
   * `unitPrice` is a `MoneyDto` on the wire and already includes the line's
   * option surcharge, so `extraCharge` is not added again. Normalization
   * happens here, in TS, via `calculateLineTotal`.
   */
  getLineTotal(item: OrderDetailItem): number {
    return calculateLineTotal(item);
  }

  /** Delegates to the DTO helper, which prefers the server-computed total. */
  getTotalPrice(): number {
    if (!this.order) return 0;
    return calculateTotalPrice(this.order);
  }

  /**
   * Status badges read the documented status roles, not the Tailwind palette.
   * Mapping: queue is waiting (warning), preparing is in flight (info), ready
   * and delivered are resolved (success), cancelled is destructive (danger).
   */
  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'DELIVERED':
      case 'READY':
        return 'rms-status-badge rms-status-badge--success';
      case 'PREPARING':
        return 'rms-status-badge rms-status-badge--info';
      case 'QUEUE':
        return 'rms-status-badge rms-status-badge--warning';
      case 'CANCELLED':
        return 'rms-status-badge rms-status-badge--danger';
      default:
        return 'rms-status-badge rms-status-badge--neutral';
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

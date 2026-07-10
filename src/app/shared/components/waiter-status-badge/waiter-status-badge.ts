import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { TagModule } from 'primeng/tag';

/**
 * Order status visualised as a strict functional color badge.
 *
 * Status → severity/label mapping follows the Waiter Service Design System
 * (see `docs/design/waiter-service.md` § 7.6 "Status Badges"):
 *
 *   QUEUE      → warn    (amber)    "EN COLA"
 *   PREPARING  → info    (blue)     "PREPARANDO"
 *   READY      → success (emerald)  "LISTO"        — highest priority waiter notification
 *   DELIVERED  → success (emerald)  "ENTREGADO"
 *   CANCELLED  → danger  (red)      "ANULADO"
 *
 * The component never hardcodes colors: it delegates to PrimeNG severity slots
 * (info / success / warn / danger) wired by `arosPreset` in `app.config.ts`.
 */
export type OrderStatus = 'QUEUE' | 'PREPARING' | 'READY' | 'DELIVERED' | 'CANCELLED';

@Component({
  selector: 'app-waiter-status-badge',
  templateUrl: './waiter-status-badge.html',
  styleUrl: './waiter-status-badge.css',
  imports: [TagModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WaiterStatusBadge {
  @Input({ required: true }) status!: OrderStatus;

  get severity(): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    switch (this.status) {
      case 'READY':
        return 'success';
      case 'DELIVERED':
        return 'success';
      case 'PREPARING':
        return 'info';
      case 'QUEUE':
        return 'warn';
      case 'CANCELLED':
        return 'danger';
      default:
        return 'secondary';
    }
  }

  get label(): string {
    switch (this.status) {
      case 'QUEUE':
        return 'EN COLA';
      case 'PREPARING':
        return 'PREPARANDO';
      case 'READY':
        return 'LISTO';
      case 'DELIVERED':
        return 'ENTREGADO';
      case 'CANCELLED':
        return 'ANULADO';
      default:
        return String(this.status);
    }
  }
}

import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MessageModule } from 'primeng/message';

/**
 * Cashier workspace placeholder.
 *
 * Feature: the fourth product role has a real, guarded route before the
 * payments backend exists (D-009). The screen states the current state and
 * offers the only working action (back to the account), instead of dropping the
 * user into the waiter menu.
 *
 * Contract:
 *  - `/worker/cashier` is reachable only with the CASH area (`AreaGuard`).
 *  - the copy never implies that charging or a cash shift already work.
 */
@Component({
  selector: 'app-cashier-area',
  imports: [RouterLink, MessageModule],
  templateUrl: './cashier-area.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CashierArea {
  readonly pendingModules = [
    {
      id: 'charge',
      title: 'Cobrar mesa',
      description: 'Selecciona una mesa abierta, aplica propina y registra el medio de pago.',
      icon: 'pi pi-credit-card',
    },
    {
      id: 'shift',
      title: 'Turno de caja',
      description: 'Apertura con base inicial, movimientos del turno y cierre contado.',
      icon: 'pi pi-wallet',
    },
    {
      id: 'summary',
      title: 'Resumen del día',
      description: 'Ventas cobradas, propinas y diferencias del turno.',
      icon: 'pi pi-chart-bar',
    },
  ] as const;
}

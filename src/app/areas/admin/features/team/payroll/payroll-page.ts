import { ChangeDetectionStrategy, Component } from '@angular/core';

import { RmsPageHeader } from '@app/shared/ui/page-header/page-header';
import { PayrollPanel } from './payroll-panel/payroll-panel';

/**
 * Payroll route (`/admin/team/payroll`).
 *
 * Feature: promotes the payroll panel out of the employees page into its own
 * destination, so Nómina is a sibling of Empleados instead of a tab nested
 * inside it.
 *
 * Contract:
 *  - this page owns the route H1; the panel keeps its worker/period selector;
 *  - `PayrollPanel` is self-contained (it selects its own worker), so the route
 *    needs no inputs or resolvers.
 */
@Component({
  selector: 'app-payroll-page',
  imports: [RmsPageHeader, PayrollPanel],
  templateUrl: './payroll-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PayrollPage {
  readonly title = 'Nómina';
  readonly subtitle = 'Eventos, liquidaciones y saldo por trabajador y periodo.';
}

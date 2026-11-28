import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, interval, of, switchMap } from 'rxjs';
import { MessageService } from 'primeng/api';

import { Auth } from '@app/core/services/auth/auth';
import { Logging } from '@app/core/services/logging/logging';
import { Payment } from '@app/core/services/payments/payment';
import { CashShift } from '@app/core/services/cash-shifts/cash-shift';
import { newIdempotencyKey } from '@app/core/services/payments/idempotency-key';
import {
  extractPaymentId,
  httpStatus,
  paymentErrorMessage,
} from '@app/core/services/payments/payment-problem';
import type {
  CashShiftResponse,
  CashShiftSummaryResponse,
} from '@app/shared/models/dto/cash-shifts/cash-shift';
import type { OrderResponse } from '@app/shared/models/dto/orders/order-response';
import type { PaymentResponse } from '@app/shared/models/dto/payments/payment-response';
import type { PaymentSummaryResponse } from '@app/shared/models/dto/payments/payment-summary-response';
import type { PendingOrderResponse } from '@app/shared/models/dto/payments/pending-order-response';
import type { RegisterPaymentRequest } from '@app/shared/models/dto/payments/register-payment-request';
import { toIsoDate, formatInstant } from '@app/shared/lib/date-format/date-format';
import { RmsButton } from '@app/shared/ui/button/button';
import { RmsPageHeader } from '@app/shared/ui/page-header/page-header';
import { RmsStatusPill } from '@app/shared/ui/status-pill/status-pill';
import { CashierOrderLookup } from './data/order-lookup';
import { CashierOrderCharge } from './components/order-charge/order-charge';
import { CashierPendingBoard } from './components/pending-board/pending-board';
import { CashierReceipt } from './components/receipt/receipt';
import { CashierShiftDialog, type CloseShiftPayload } from './components/shift-dialog/shift-dialog';
import { CashierVoidDialog } from './components/void-payment-dialog/void-payment-dialog';

const BOARD_PAGE_SIZE = 20;
const JOURNAL_PAGE_SIZE = 100;
const POLL_INTERVAL_MS = 30_000;

type ToastSeverity = 'success' | 'info' | 'warn' | 'error';

/**
 * Cashier workspace.
 *
 * Feature (D-009, Option B): the cashier sees today's unpaid delivered orders,
 * reviews the selected order, charges it with split tenders, a tip and one
 * reasoned discount, prints the receipt, voids a mistaken charge and reconciles
 * the cash drawer.
 *
 * Contract:
 *  - the board is readable while the shift is closed; charging is not;
 *  - the server is the source of truth: the preview is client-side, the receipt
 *    and the shift totals come from the API;
 *  - one idempotency key per charge attempt, reused on retry and reset after a
 *    success or when another order is selected;
 *  - `409 OrderAlreadyPaid` with a `paymentId` opens the existing receipt;
 *  - table release stays coupled to delivery, never to payment: the cashier
 *    never changes a table status.
 */
@Component({
  selector: 'app-cashier-area',
  templateUrl: './cashier-area.html',
  styleUrl: './cashier-area.css',
  imports: [
    DatePipe,
    RmsButton,
    RmsPageHeader,
    RmsStatusPill,
    CashierOrderCharge,
    CashierPendingBoard,
    CashierReceipt,
    CashierShiftDialog,
    CashierVoidDialog,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CashierArea implements OnInit {
  private readonly payments = inject(Payment);
  private readonly cashShift = inject(CashShift);
  private readonly orderLookup = inject(CashierOrderLookup);
  private readonly auth = inject(Auth);
  private readonly messageService = inject(MessageService);
  private readonly log = inject(Logging);
  private readonly destroyRef = inject(DestroyRef);

  // ---- pending board -----------------------------------------------------
  readonly pending = signal<PendingOrderResponse[]>([]);
  readonly pendingLoading = signal(true);
  readonly pendingRefreshing = signal(false);
  readonly pendingError = signal<string | null>(null);
  readonly pendingPage = signal(0);
  readonly pendingTotalPages = signal(0);
  readonly pendingTotal = signal(0);
  readonly search = signal('');
  readonly date = signal(toIsoDate(new Date()));
  readonly lastUpdated = signal<Date | null>(null);

  // ---- selected order ----------------------------------------------------
  readonly selected = signal<PendingOrderResponse | null>(null);
  readonly order = signal<OrderResponse | null>(null);
  readonly orderLoading = signal(false);
  readonly orderError = signal<string | null>(null);
  readonly tableNumber = signal<number | null>(null);

  // ---- shift -------------------------------------------------------------
  readonly shift = signal<CashShiftResponse | null>(null);
  readonly shiftSummary = signal<CashShiftSummaryResponse | null>(null);
  readonly closedSummary = signal<CashShiftSummaryResponse | null>(null);
  readonly shiftLoading = signal(true);
  readonly shiftBusy = signal(false);
  readonly shiftError = signal<string | null>(null);
  readonly journal = signal<PaymentSummaryResponse[]>([]);
  readonly shiftVisible = signal(false);

  // ---- charge ------------------------------------------------------------
  readonly chargeBusy = signal(false);
  readonly chargeError = signal<string | null>(null);
  private attemptKey: string | null = null;

  // ---- receipt -----------------------------------------------------------
  readonly receiptVisible = signal(false);
  readonly receiptPayment = signal<PaymentResponse | null>(null);
  readonly receiptOrder = signal<OrderResponse | null>(null);
  readonly receiptTable = signal<number | null>(null);
  readonly cashierName = signal('');

  // ---- void --------------------------------------------------------------
  readonly voidVisible = signal(false);
  readonly voidTarget = signal<PaymentResponse | null>(null);
  readonly voidBusy = signal(false);
  readonly voidError = signal<string | null>(null);

  readonly shiftOpen = computed(() => this.shift() !== null);

  readonly canVoidReceipt = computed(() => {
    const payment = this.receiptPayment();
    const shift = this.shift();
    return (
      payment !== null &&
      shift !== null &&
      payment.status === 'COMPLETED' &&
      payment.shiftId === shift.id
    );
  });

  ngOnInit(): void {
    this.cashierName.set(this.auth.getData()?.name ?? '');
    this.loadShift();
    this.loadPending();
    this.startPolling();
  }

  // ---- pending board -----------------------------------------------------

  loadPending(silent = false): void {
    if (!silent) this.pendingRefreshing.set(true);

    this.payments
      .getPending({
        date: this.date(),
        search: this.search(),
        page: this.pendingPage(),
        size: BOARD_PAGE_SIZE,
      })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.pendingRefreshing.set(false);
          this.pendingLoading.set(false);
        }),
      )
      .subscribe({
        next: (page) => {
          if (page.items.length === 0 && this.pendingPage() > 0) {
            this.pendingPage.update((value) => value - 1);
            this.loadPending(silent);
            return;
          }
          this.pending.set(page.items);
          this.pendingTotal.set(page.total);
          this.pendingTotalPages.set(page.totalPages);
          this.pendingError.set(null);
          this.lastUpdated.set(new Date());
        },
        error: (error: unknown) => {
          this.pendingLoading.set(false);
          if (!silent || this.pending().length === 0) {
            this.pendingError.set(
              paymentErrorMessage(error, 'No se pudieron cargar las cuentas pendientes.'),
            );
          } else {
            this.log.warn('Cashier board refresh failed', error);
          }
        },
      });
  }

  onSearchChange(search: string): void {
    // The backend only accepts an exact numeric order id or table number;
    // stripping non-digits lets "Mesa 3" and "#900029" behave as expected.
    this.search.set(search.replace(/\D/g, ''));
    this.pendingPage.set(0);
    this.clearSelection();
    this.loadPending();
  }

  onDateChange(date: string): void {
    this.date.set(date.length === 0 ? toIsoDate(new Date()) : date);
    this.pendingPage.set(0);
    this.clearSelection();
    this.orderLookup.clear();
    this.loadPending();
  }

  onPageChange(page: number): void {
    if (page < 0 || page === this.pendingPage()) return;
    this.pendingPage.set(page);
    this.clearSelection();
    this.loadPending();
  }

  // ---- order review ------------------------------------------------------

  onSelectOrder(pending: PendingOrderResponse): void {
    this.selected.set(pending);
    this.tableNumber.set(pending.tableNumber);
    this.order.set(null);
    this.orderError.set(null);
    this.chargeError.set(null);
    this.attemptKey = null;
    this.orderLoading.set(true);

    this.orderLookup
      .find(pending)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.orderLoading.set(false);
        }),
      )
      .subscribe({
        next: (order) => {
          if (order === null) {
            this.orderError.set('No se encontró el detalle del pedido en los pedidos del día.');
            return;
          }
          this.order.set(order);
        },
        error: (error: unknown) => {
          this.orderError.set(
            paymentErrorMessage(error, 'No se pudo cargar el detalle del pedido.'),
          );
        },
      });
  }

  retryOrder(): void {
    const selected = this.selected();
    if (selected !== null) this.onSelectOrder(selected);
  }

  private clearSelection(): void {
    this.selected.set(null);
    this.order.set(null);
    this.orderError.set(null);
    this.tableNumber.set(null);
    this.chargeError.set(null);
    this.attemptKey = null;
  }

  // ---- charge ------------------------------------------------------------

  onCharge(request: RegisterPaymentRequest): void {
    if (this.chargeBusy()) return;
    if (this.shift() === null) {
      this.chargeError.set('No hay un turno de caja abierto. Abre la caja para cobrar.');
      this.shiftVisible.set(true);
      return;
    }

    this.chargeBusy.set(true);
    this.chargeError.set(null);
    this.attemptKey ??= newIdempotencyKey();
    const key = this.attemptKey;

    this.payments
      .charge(request, key)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.chargeBusy.set(false);
        }),
      )
      .subscribe({
        next: (payment) => {
          this.attemptKey = null;
          this.openReceipt(payment, this.order(), this.tableNumber());
          this.toast(
            'success',
            'Cobro registrado',
            `${payment.receiptNumber} · ${formatInstant(payment.completedAt)}`,
          );
          this.clearSelection();
          this.afterMutation();
        },
        error: (error: unknown) => {
          this.handleChargeError(error);
        },
      });
  }

  private handleChargeError(error: unknown): void {
    const paymentId = extractPaymentId(error);
    if (paymentId !== null) {
      this.payments
        .getById(paymentId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (payment) => {
            this.openReceipt(payment, null, this.tableNumber());
            this.toast(
              'warn',
              'La cuenta ya estaba cobrada',
              `Se abrió el recibo ${payment.receiptNumber}.`,
            );
            this.clearSelection();
            this.loadPending(true);
          },
          error: () => {
            this.chargeError.set(
              'La cuenta ya tiene un cobro activo, pero no se pudo abrir su recibo.',
            );
          },
        });
      return;
    }

    this.chargeError.set(
      paymentErrorMessage(error, 'No se pudo registrar el cobro. Intenta de nuevo.'),
    );

    if (httpStatus(error) === 409) {
      this.cashShift
        .getCurrent()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (shift) => {
            this.shift.set(shift);
            if (shift === null) this.shiftVisible.set(true);
          },
          error: () => undefined,
        });
    }
  }

  // ---- shift -------------------------------------------------------------

  loadShift(silent = false): void {
    if (!silent) this.shiftLoading.set(true);

    this.cashShift
      .getCurrent()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          if (!silent) this.shiftLoading.set(false);
        }),
      )
      .subscribe({
        next: (shift) => {
          this.shift.set(shift);
          this.shiftError.set(null);
          if (shift !== null) {
            this.loadSummary(shift.id);
            this.loadJournal(shift.id, shift.openedAt);
          } else {
            this.shiftSummary.set(null);
            if (this.closedSummary() === null) this.journal.set([]);
          }
        },
        error: (error: unknown) => {
          this.shift.set(null);
          this.shiftSummary.set(null);
          this.shiftError.set(paymentErrorMessage(error, 'No se pudo consultar el turno de caja.'));
        },
      });
  }

  private loadSummary(shiftId: number): void {
    this.cashShift
      .getSummary(shiftId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (summary) => {
          this.shiftSummary.set(summary);
        },
        error: (error: unknown) => {
          this.log.warn('Cashier shift summary failed', error);
        },
      });
  }

  private loadJournal(shiftId: number, openedAt: string | null): void {
    const day = (openedAt ?? `${this.date()}T00:00:00`).slice(0, 10);
    this.payments
      .getJournal({ date: day, page: 0, size: JOURNAL_PAGE_SIZE })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.journal.set(page.items.filter((payment) => payment.shiftId === shiftId));
        },
        error: (error: unknown) => {
          this.log.warn('Cashier payment journal failed', error);
          this.journal.set([]);
        },
      });
  }

  openShiftDialog(): void {
    this.shiftVisible.set(true);
    this.loadShift();
  }

  onShiftVisibleChange(visible: boolean): void {
    this.shiftVisible.set(visible);
    if (visible) this.loadShift();
  }

  refreshShift(): void {
    this.loadShift(true);
  }

  onOpenShift(openingFloat: number): void {
    if (this.shiftBusy()) return;
    this.shiftBusy.set(true);
    this.shiftError.set(null);

    this.cashShift
      .open(openingFloat)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.shiftBusy.set(false);
        }),
      )
      .subscribe({
        next: (shift) => {
          this.shift.set(shift);
          this.closedSummary.set(null);
          this.toast('success', 'Caja abierta', `Turno #${String(shift.id)} con fondo inicial.`);
          this.loadSummary(shift.id);
          this.loadJournal(shift.id, shift.openedAt);
          this.loadPending(true);
        },
        error: (error: unknown) => {
          this.shiftError.set(paymentErrorMessage(error, 'No se pudo abrir la caja.'));
          if (httpStatus(error) === 409) this.loadShift();
        },
      });
  }

  onCloseShift(payload: CloseShiftPayload): void {
    const shift = this.shift();
    if (shift === null || this.shiftBusy()) return;

    this.shiftBusy.set(true);
    this.shiftError.set(null);

    this.cashShift
      .close(shift.id, payload.countedCash, payload.notes)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.shiftBusy.set(false);
        }),
      )
      .subscribe({
        next: (summary) => {
          this.shift.set(null);
          this.shiftSummary.set(null);
          this.closedSummary.set(summary);
          this.journal.set([]);
          this.loadJournal(summary.id, summary.openedAt);
          this.toast(
            'success',
            'Caja cerrada',
            `Turno #${String(summary.id)} cerrado con ${String(summary.paymentsCount)} cobros.`,
          );
          this.loadPending(true);
        },
        error: (error: unknown) => {
          this.shiftError.set(paymentErrorMessage(error, 'No se pudo cerrar la caja.'));
        },
      });
  }

  // ---- receipt -----------------------------------------------------------

  private openReceipt(
    payment: PaymentResponse,
    order: OrderResponse | null,
    tableNumber: number | null,
  ): void {
    this.receiptPayment.set(payment);
    this.receiptOrder.set(order);
    this.receiptTable.set(tableNumber);
    this.receiptVisible.set(true);
  }

  onReceiptVisibleChange(visible: boolean): void {
    this.receiptVisible.set(visible);
  }

  onNewCharge(): void {
    this.receiptVisible.set(false);
    this.receiptPayment.set(null);
    this.receiptOrder.set(null);
    this.receiptTable.set(null);
  }

  onViewReceipt(summary: PaymentSummaryResponse): void {
    this.payments
      .getById(summary.id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap((payment) =>
          this.orderLookup
            .find({
              orderId: summary.orderId,
              tableId: null,
              tableNumber: null,
              partySize: null,
              deliveredAt: summary.completedAt ?? `${this.date()}T00:00:00`,
              total: summary.total,
              paymentStatus: 'UNPAID',
            })
            .pipe(switchMap((order) => of({ payment, order }))),
        ),
      )
      .subscribe({
        next: ({ payment, order }) => {
          this.openReceipt(payment, order, null);
        },
        error: (error: unknown) => {
          this.toast(
            'error',
            'No se pudo abrir el recibo',
            paymentErrorMessage(error, 'Intenta de nuevo.'),
          );
        },
      });
  }

  // ---- void --------------------------------------------------------------

  onVoidRequested(payment: PaymentResponse): void {
    this.voidTarget.set(payment);
    this.voidError.set(null);
    this.voidVisible.set(true);
  }

  onVoidFromJournal(summary: PaymentSummaryResponse): void {
    this.payments
      .getById(summary.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (payment) => {
          this.onVoidRequested(payment);
        },
        error: (error: unknown) => {
          this.toast(
            'error',
            'No se pudo abrir la anulación',
            paymentErrorMessage(error, 'Intenta de nuevo.'),
          );
        },
      });
  }

  onVoidVisibleChange(visible: boolean): void {
    this.voidVisible.set(visible);
    if (!visible) this.voidError.set(null);
  }

  confirmVoid(reason: string): void {
    const target = this.voidTarget();
    if (target === null || this.voidBusy()) return;

    this.voidBusy.set(true);
    this.voidError.set(null);

    this.payments
      .voidPayment(target.id, reason)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.voidBusy.set(false);
        }),
      )
      .subscribe({
        next: (voided) => {
          this.voidVisible.set(false);
          this.voidTarget.set(null);
          if (this.receiptPayment()?.id === voided.id) {
            this.receiptPayment.set(voided);
          }
          this.toast(
            'success',
            'Cobro anulado',
            `El recibo ${voided.receiptNumber} quedó anulado.`,
          );
          this.afterMutation();
        },
        error: (error: unknown) => {
          this.voidError.set(paymentErrorMessage(error, 'No se pudo anular el cobro.'));
        },
      });
  }

  // ---- helpers -----------------------------------------------------------

  openedAt(): string {
    return formatInstant(this.shift()?.openedAt ?? null);
  }

  private afterMutation(): void {
    this.loadPending(true);
    this.loadShift(true);
  }

  private startPolling(): void {
    interval(POLL_INTERVAL_MS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (!this.chargeBusy() && !this.shiftBusy() && !this.receiptVisible()) {
          this.loadPending(true);
        }
      });
  }

  private toast(severity: ToastSeverity, summary: string, detail: string): void {
    this.messageService.add({ severity, summary, detail, life: 5000 });
  }
}

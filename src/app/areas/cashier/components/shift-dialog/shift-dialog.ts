import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  computed,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

import type {
  CashShiftResponse,
  CashShiftSummaryResponse,
  ShiftDifferenceKind,
} from '@app/shared/models/dto/cash-shifts/cash-shift';
import { toAmount } from '@app/shared/models/dto/common/money';
import { parseMoneyInput } from '@app/shared/models/dto/payments/money-amount';
import type { PaymentSummaryResponse } from '@app/shared/models/dto/payments/payment-summary-response';
import { formatInstant } from '@app/shared/lib/date-format/date-format';
import { Money } from '@app/shared/pipes/money/money';
import { RmsBadge } from '@app/shared/ui/badge/badge';
import { RmsButton } from '@app/shared/ui/button/button';
import { RmsDialog } from '@app/shared/ui/dialog/dialog';
import { RmsInput } from '@app/shared/ui/input/input';
import { RmsSkeleton } from '@app/shared/ui/skeleton/skeleton';

/** Payload emitted by the two-step close confirmation. */
export interface CloseShiftPayload {
  countedCash: number;
  notes: string;
}

/**
 * Cash-drawer shift dialog.
 *
 * Feature: open a shift with a float, watch the live expected cash, close with
 * the counted cash (expected vs counted difference) and read the Z-summary,
 * plus the shift's payment journal with receipt and void actions.
 *
 * Contract:
 *  - no shift → open form only;
 *  - open shift → live totals, journal, counted input and a two-step close;
 *  - closed shift → read-only Z-summary and a form to open the next shift;
 *  - the difference is computed in cents from the server's `expectedCash`;
 *    it is always text ("Faltante"/"Sobrante"/"Cuadra"), never colour alone;
 *  - close and void are disabled while a request is in flight.
 */
@Component({
  selector: 'app-cashier-shift-dialog',
  templateUrl: './shift-dialog.html',
  styleUrl: './shift-dialog.css',
  imports: [FormsModule, Money, RmsBadge, RmsButton, RmsDialog, RmsInput, RmsSkeleton],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CashierShiftDialog implements OnChanges {
  @Input() visible = false;
  /** Current open shift, or `null`. */
  @Input() shift: CashShiftResponse | null = null;
  /** Live summary of the open shift. */
  @Input() summary: CashShiftSummaryResponse | null = null;
  /** Frozen Z-summary of the last closed shift. */
  @Input() closedSummary: CashShiftSummaryResponse | null = null;
  /** Payments of the active (or last closed) shift. */
  @Input() payments: PaymentSummaryResponse[] = [];
  @Input() loading = false;
  @Input() busy = false;
  @Input() error: string | null = null;

  @Output() readonly visibleChange = new EventEmitter<boolean>();
  @Output() readonly openShift = new EventEmitter<number>();
  @Output() readonly closeShift = new EventEmitter<CloseShiftPayload>();
  @Output() readonly refresh = new EventEmitter<void>();
  @Output() readonly viewReceipt = new EventEmitter<PaymentSummaryResponse>();
  @Output() readonly voidRequested = new EventEmitter<PaymentSummaryResponse>();

  readonly floatInput = signal('0');
  readonly countedInput = signal('');
  readonly notes = signal('');
  readonly closing = signal(false);

  readonly floatValue = computed(() => parseMoneyInput(this.floatInput()));
  readonly countedValue = computed(() => parseMoneyInput(this.countedInput()));

  readonly floatError = computed(() => {
    const value = this.floatValue();
    if (value === null) {
      return this.floatInput().trim().length === 0
        ? 'Ingresa el fondo inicial.'
        : 'Monto inválido.';
    }
    return value < 0 ? 'El fondo no puede ser negativo.' : '';
  });

  readonly countedError = computed(() => {
    const value = this.countedValue();
    if (value === null) {
      return this.countedInput().trim().length === 0
        ? 'Ingresa el efectivo contado.'
        : 'Monto inválido.';
    }
    return value < 0 ? 'El efectivo contado no puede ser negativo.' : '';
  });

  /** Live difference between counted and expected, or `null` when unparsable. */
  difference(): number | null {
    const counted = this.countedValue();
    if (counted === null) return null;
    const expected = toAmount(this.activeSummary?.expectedCash ?? null);
    return Math.round((counted - expected) * 100) / 100;
  }

  differenceKind(): ShiftDifferenceKind {
    const value = this.difference();
    if (value === null || value === 0) return 'balanced';
    return value > 0 ? 'over' : 'short';
  }

  canOpen(): boolean {
    return !this.busy && (this.floatValue() ?? -1) >= 0;
  }

  canClose(): boolean {
    return (
      !this.busy &&
      this.shift !== null &&
      (this.countedValue() ?? -1) >= 0 &&
      this.countedError().length === 0
    );
  }

  get activeSummary(): CashShiftSummaryResponse | null {
    return this.closedSummary ?? this.summary;
  }

  get isClosed(): boolean {
    return this.closedSummary !== null;
  }

  get journalTitle(): string {
    return this.isClosed ? 'Cobros del turno cerrado' : 'Cobros del turno';
  }

  ngOnChanges(changes: SimpleChanges): void {
    const change = changes['visible'] as { currentValue: boolean } | undefined;
    if (change?.currentValue === true) {
      this.floatInput.set('0');
      this.countedInput.set('');
      this.notes.set('');
      this.closing.set(false);
    }
  }

  onFloatChange(value: string): void {
    this.floatInput.set(value);
  }

  onCountedChange(value: string): void {
    this.countedInput.set(value);
    this.closing.set(false);
  }

  onNotesChange(value: string): void {
    this.notes.set(value);
  }

  open(): void {
    const value = this.floatValue();
    if (value === null || value < 0 || this.busy) return;
    this.openShift.emit(value);
  }

  /** First step of the close: validate and show the confirmation. */
  reviewClose(): void {
    if (!this.canClose()) return;
    this.closing.set(true);
  }

  cancelClose(): void {
    this.closing.set(false);
  }

  /** Second step: send the counted cash to the server. */
  confirmClose(): void {
    const value = this.countedValue();
    if (value === null || value < 0 || this.busy) return;
    this.closeShift.emit({ countedCash: value, notes: this.notes().trim() });
  }

  openedAt(): string {
    return formatInstant(this.activeSummary?.openedAt ?? this.shift?.openedAt ?? null);
  }

  closedAt(): string {
    return formatInstant(this.activeSummary?.closedAt ?? null);
  }

  shiftTitle(): string {
    const id = this.activeSummary?.id ?? this.shift?.id;
    return id === undefined ? 'Turno de caja' : `Turno #${String(id)}`;
  }

  countLabel(count: number): string {
    return count === 1 ? '1 cobro' : `${String(count)} cobros`;
  }

  differenceLabel(): string {
    const value = this.difference();
    if (value === null) return 'Sin contar';
    if (value === 0) return 'Cuadra';
    return value > 0 ? 'Sobrante' : 'Faltante';
  }

  differenceClass(): string {
    switch (this.differenceKind()) {
      case 'over':
        return 'shift-dialog__difference--over';
      case 'short':
        return 'shift-dialog__difference--short';
      default:
        return 'shift-dialog__difference--balanced';
    }
  }

  differencePrefix(): string {
    const value = this.difference();
    if (value === null || value === 0) return '';
    return value > 0 ? '+' : '-';
  }

  differenceAmount(): number {
    return Math.abs(this.difference() ?? 0);
  }

  canVoidPayment(payment: PaymentSummaryResponse): boolean {
    return !this.isClosed && !this.busy && payment.status === 'COMPLETED' && this.shift !== null;
  }

  paymentTime(payment: PaymentSummaryResponse): string {
    return formatInstant(payment.completedAt);
  }
}

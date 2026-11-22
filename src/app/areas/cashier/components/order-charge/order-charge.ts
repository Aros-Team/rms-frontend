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

import {
  computeCharge,
  computeDiscountAmount,
  tipFromPercent,
  toRegisterPaymentRequest,
} from '@app/core/services/payments/charge-draft';
import type {
  ChargeDraft,
  ChargeIssue,
  ChargeIssueCode,
  DiscountDraft,
  TenderDraft,
} from '@app/shared/models/dto/payments/charge-draft';
import { toAmount } from '@app/shared/models/dto/common/money';
import {
  formatMoneyInput,
  parseMoneyInput,
} from '@app/shared/models/dto/payments/money-amount';
import {
  PAYMENT_METHOD_LABEL,
  type PaymentDiscountType,
  type PaymentTenderMethod,
} from '@app/shared/models/dto/payments/payment-method';
import type { RegisterPaymentRequest } from '@app/shared/models/dto/payments/register-payment-request';
import type { OrderResponse } from '@app/shared/models/dto/orders/order-response';
import { formatInstant } from '@app/shared/lib/date-format/date-format';
import { Money } from '@app/shared/pipes/money/money';
import { RmsBadge } from '@app/shared/ui/badge/badge';
import { RmsButton } from '@app/shared/ui/button/button';
import { RmsEmptyState } from '@app/shared/ui/empty-state/empty-state';
import { RmsIconButton } from '@app/shared/ui/icon-button/icon-button';
import { RmsInput } from '@app/shared/ui/input/input';
import { RmsSection } from '@app/shared/ui/section/section';
import { RmsSelect, type RmsSelectOption } from '@app/shared/ui/select/select';
import { RmsSkeleton } from '@app/shared/ui/skeleton/skeleton';
import { countOrderItems, groupOrderLines } from '../../lib/order-lines';

interface TenderRow {
  id: number;
  method: PaymentTenderMethod;
  amountInput: string;
  reference: string;
}

/** Field-level issue shown under the offending control. */
const FIELD_ISSUES: ReadonlySet<ChargeIssueCode> = new Set<ChargeIssueCode>([
  'TENDER_AMOUNT_REQUIRED',
  'DISCOUNT_VALUE_REQUIRED',
  'DISCOUNT_PERCENT_RANGE',
  'DISCOUNT_TOO_LARGE',
  'DISCOUNT_REASON_REQUIRED',
]);

const GLOBAL_ISSUE_TEXT: Readonly<Partial<Record<ChargeIssueCode, string>>> = {
  SUBTOTAL_MISSING: 'El pedido no tiene un monto cobrable.',
  TIP_NEGATIVE: 'La propina no puede ser negativa.',
  TIP_INVALID: 'La propina no es un monto válido.',
  TENDER_REQUIRED: 'Agrega al menos un medio de pago.',
  NON_CASH_OVER_REMAINING: 'Solo el efectivo puede superar el saldo restante.',
  CASH_OVER_NOT_LAST: 'El efectivo que supera el saldo debe ser el último medio de pago.',
  UNDERPAID: 'Los medios de pago no cubren el total.',
  TOTAL_NOT_POSITIVE: 'El total a cobrar debe ser mayor que cero.',
};

/**
 * Cashier order review and charge panel.
 *
 * Feature: read the selected order, apply one discount and a tip, split the
 * payment across cash/card/transfer and preview the change before charging.
 *
 * Contract:
 *  - the subtotal always comes from the server order (`order.total`); the
 *    client only previews discount, tip, total and change;
 *  - the confirm button is disabled while a charge is in flight, when the shift
 *    is closed, or when any backend invariant is violated;
 *  - the form resets when a different order is selected and prefills the first
 *    cash tender with the exact total (one-click exact-cash payment);
 *  - every money value is a number derived through `toAmount()` or
 *    `parseMoneyInput()`; wire strings are never added.
 */
@Component({
  selector: 'app-cashier-order-charge',
  templateUrl: './order-charge.html',
  styleUrl: './order-charge.css',
  imports: [
    FormsModule,
    Money,
    RmsBadge,
    RmsButton,
    RmsEmptyState,
    RmsIconButton,
    RmsInput,
    RmsSection,
    RmsSelect,
    RmsSkeleton,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CashierOrderCharge implements OnChanges {
  @Input() order: OrderResponse | null = null;
  @Input() tableNumber: number | null = null;
  @Input() loading = false;
  /** Detail lookup failed; the parent offers a retry. */
  @Input() error: string | null = null;
  @Input() shiftOpen = false;
  @Input() submitting = false;
  /** ProblemDetail of the last failed charge. */
  @Input() submitError: string | null = null;

  @Output() readonly charge = new EventEmitter<RegisterPaymentRequest>();
  @Output() readonly retry = new EventEmitter<void>();
  @Output() readonly openShift = new EventEmitter<void>();

  readonly tipInput = signal('0');
  readonly discountType = signal<'' | PaymentDiscountType>('');
  readonly discountValueInput = signal('');
  readonly discountReason = signal('');
  readonly tenders = signal<TenderRow[]>([
    { id: 1, method: 'CASH', amountInput: '', reference: '' },
  ]);

  private nextTenderId = 2;

  readonly discountOptions: RmsSelectOption[] = [
    { label: 'Sin descuento', value: '' },
    { label: 'Porcentaje (%)', value: 'PERCENT' },
    { label: 'Monto en pesos', value: 'AMOUNT' },
  ];

  readonly methodOptions: RmsSelectOption[] = [
    { label: PAYMENT_METHOD_LABEL.CASH, value: 'CASH' },
    { label: PAYMENT_METHOD_LABEL.CARD, value: 'CARD' },
    { label: PAYMENT_METHOD_LABEL.TRANSFER, value: 'TRANSFER' },
  ];

  readonly tipPresets = [0, 10, 15] as const;

  readonly lines = computed(() => groupOrderLines(this.order?.details ?? []));
  readonly itemCount = computed(() => countOrderItems(this.lines()));
  readonly subtotal = computed(() => toAmount(this.order?.total ?? null));
  readonly hasDiscount = computed(() => this.discountType() !== '');

  readonly draft = computed<ChargeDraft>(() => ({
    subtotal: this.subtotal(),
    tip: this.tipValue(),
    discount: this.discountDraft(),
    tenders: this.tenderDrafts(),
  }));

  readonly computation = computed(() => computeCharge(this.draft()));

  readonly tipBase = computed(() =>
    Math.max(0, this.subtotal() - computeDiscountAmount(this.draft())),
  );

  /** Issues that do not belong to a single field. */
  readonly summaryIssues = computed(() =>
    this.computation().issues.filter((issue) => !FIELD_ISSUES.has(issue.code)),
  );

  readonly discountValueError = computed(() => this.fieldError('discount-value'));
  readonly discountReasonError = computed(() => this.fieldError('discount-reason'));

  readonly canSubmit = computed(
    () =>
      this.order !== null &&
      this.shiftOpen &&
      !this.submitting &&
      this.computation().valid,
  );

  ngOnChanges(changes: SimpleChanges): void {
    const change = changes['order'] as
      | { previousValue: OrderResponse | null; currentValue: OrderResponse | null }
      | undefined;
    if (change === undefined) return;

    if ((change.previousValue?.id ?? null) !== (change.currentValue?.id ?? null)) {
      this.resetDraft(change.currentValue);
    }
  }

  // ---- form handlers -----------------------------------------------------

  onTipChange(value: string): void {
    this.tipInput.set(value);
  }

  setTipPreset(percent: number): void {
    this.tipInput.set(formatMoneyInput(tipFromPercent(this.tipBase(), percent)));
  }

  onDiscountTypeChange(value: string | number | null): void {
    this.discountType.set(value === 'PERCENT' || value === 'AMOUNT' ? value : '');
  }

  onDiscountValueChange(value: string): void {
    this.discountValueInput.set(value);
  }

  onDiscountReasonChange(value: string): void {
    this.discountReason.set(value);
  }

  addTender(): void {
    const remaining = this.computation().remaining;
    this.tenders.update((rows) => [
      ...rows,
      {
        id: this.nextTenderId++,
        method: 'CASH',
        amountInput: remaining > 0 ? formatMoneyInput(remaining) : '',
        reference: '',
      },
    ]);
  }

  removeTender(index: number): void {
    this.tenders.update((rows) => (rows.length <= 1 ? rows : rows.filter((_, i) => i !== index)));
  }

  onTenderMethodChange(index: number, value: string | number | null): void {
    const method: PaymentTenderMethod =
      value === 'CARD' || value === 'TRANSFER' ? value : 'CASH';
    this.tenders.update((rows) =>
      rows.map((row, i) =>
        i === index
          ? { ...row, method, reference: method === 'CASH' ? '' : row.reference }
          : row,
      ),
    );
  }

  onTenderAmountChange(index: number, value: string): void {
    this.tenders.update((rows) =>
      rows.map((row, i) => (i === index ? { ...row, amountInput: value } : row)),
    );
  }

  onTenderReferenceChange(index: number, value: string): void {
    this.tenders.update((rows) =>
      rows.map((row, i) => (i === index ? { ...row, reference: value } : row)),
    );
  }

  /** Fills a tender with the amount still missing before it. */
  fillRemaining(index: number): void {
    const value = this.remainingBefore(index);
    this.onTenderAmountChange(index, formatMoneyInput(value));
  }

  // ---- template helpers --------------------------------------------------

  tableLabel(): string {
    return this.tableNumber === null ? 'Sin mesa' : `Mesa ${String(this.tableNumber)}`;
  }

  orderTime(): string {
    return this.order === null ? '—' : formatInstant(this.order.date);
  }

  remainingBefore(index: number): number {
    const total = this.computation().total;
    const previous = this.tenders()
      .slice(0, index)
      .reduce((sum, row) => sum + (parseMoneyInput(row.amountInput) ?? 0), 0);
    return Math.max(0, Math.round((total - previous) * 100) / 100);
  }

  tenderChange(index: number): number {
    return this.computation().tenders[index].change;
  }

  tenderAmountError(index: number): string {
    return this.hasIssue('TENDER_AMOUNT_REQUIRED', index)
      ? 'Ingresa un monto mayor que cero.'
      : '';
  }

  tenderOverError(index: number): string {
    if (this.hasIssue('NON_CASH_OVER_REMAINING', index)) {
      return 'Solo el efectivo puede superar el saldo restante.';
    }
    if (this.hasIssue('CASH_OVER_NOT_LAST', index)) {
      return 'Este efectivo supera el saldo; debe ser el último medio.';
    }
    return '';
  }

  issueText(issue: ChargeIssue): string {
    const base = GLOBAL_ISSUE_TEXT[issue.code] ?? 'Revisa los datos del cobro.';
    return issue.index === undefined ? base : `${base} (medio ${String(issue.index + 1)})`;
  }

  submit(): void {
    const order = this.order;
    if (order === null || !this.canSubmit()) return;
    this.charge.emit(toRegisterPaymentRequest(this.draft(), order.id));
  }

  // ---- internals ---------------------------------------------------------

  private hasIssue(code: ChargeIssueCode, index: number): boolean {
    return this.computation().issues.some(
      (issue) => issue.code === code && issue.index === index,
    );
  }

  private fieldError(kind: 'discount-value' | 'discount-reason'): string {
    const codes = this.computation().issues.map((issue) => issue.code);
    if (kind === 'discount-value') {
      if (codes.includes('DISCOUNT_VALUE_REQUIRED')) return 'Ingresa el valor del descuento.';
      if (codes.includes('DISCOUNT_PERCENT_RANGE')) return 'El porcentaje debe estar entre 0 y 100.';
      if (codes.includes('DISCOUNT_TOO_LARGE')) {
        return 'El descuento debe ser menor que el subtotal.';
      }
      return '';
    }
    return codes.includes('DISCOUNT_REASON_REQUIRED') ? 'Explica el motivo del descuento.' : '';
  }

  private tipValue(): number {
    const raw = this.tipInput();
    const parsed = parseMoneyInput(raw);
    if (parsed === null) return raw.trim().length === 0 ? 0 : Number.NaN;
    return parsed;
  }

  private discountDraft(): DiscountDraft | null {
    const type = this.discountType();
    if (type === '') return null;
    return {
      type,
      value: parseMoneyInput(this.discountValueInput()) ?? Number.NaN,
      reason: this.discountReason(),
    };
  }

  private tenderDrafts(): TenderDraft[] {
    return this.tenders().map((row) => ({
      method: row.method,
      amount: parseMoneyInput(row.amountInput) ?? Number.NaN,
      reference: row.reference,
    }));
  }

  private resetDraft(order: OrderResponse | null): void {
    this.tipInput.set('0');
    this.discountType.set('');
    this.discountValueInput.set('');
    this.discountReason.set('');

    const total = toAmount(order?.total ?? null);
    this.tenders.set([
      {
        id: this.nextTenderId++,
        method: 'CASH',
        amountInput: total > 0 ? formatMoneyInput(total) : '',
        reference: '',
      },
    ]);
  }
}

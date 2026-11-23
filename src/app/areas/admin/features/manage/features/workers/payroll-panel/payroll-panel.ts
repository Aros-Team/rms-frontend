import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  ElementRef,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ConfirmationService, MessageService } from 'primeng/api';
import { CheckboxModule } from 'primeng/checkbox';
import { DatePickerModule } from 'primeng/datepicker';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';

import { ResourceCache } from '@app/core/cache/resource-cache/resource-cache';
import { Logging } from '@app/core/services/logging/logging';
import { Payroll } from '@app/core/services/payroll/payroll';
import { PayrollCache } from '@app/core/services/payroll/payroll-cache';
import { WorkersCache } from '@areas/admin/features/manage/features/workers/workers-cache';
import {
  formatInstant,
  formatIsoDate,
  parseIsoDate,
  toIsoDate,
} from '@shared/lib/date-format/date-format';
import { mapHttpError } from '@shared/lib/http-error-mapper/http-error-mapper';
import { TableSkeleton } from '@shared/skeletons/table-skeleton/table-skeleton';
import { RmsButton } from '@app/shared/ui/button/button';
import { RmsIconButton } from '@app/shared/ui/icon-button/icon-button';
import { RmsInput } from '@app/shared/ui/input/input';
import { RmsStatusPill } from '@app/shared/ui/status-pill/status-pill';
import type { RmsStatus } from '@app/shared/ui/types/ui-types';
import { toAmount, type Money as MoneyValue } from '@models/dto/common/money';
import {
  PAYROLL_EVENT_TYPES,
  SETTLEMENT_TYPES,
  type PayrollCalculateRequest,
  type PayrollCalculateResponse,
  type PayrollEventRequest,
  type PayrollEventResponse,
  type PayrollEventType,
  type PayrollResponse,
  type PayrollSettlementRequest,
  type PayrollSettlementResponse,
  type SettlementType,
} from '@models/dto/payroll';
import type { WorkerResponse } from '@models/dto/workers/worker-response';
import { DEFAULT_CURRENCY, Money as MoneyPipe } from '@shared/pipes/money/money';

/** Spanish label per payroll event type — the wire value stays the enum name. */
const EVENT_LABELS: Record<PayrollEventType, string> = {
  OVERTIME: 'Hora extra',
  NIGHT_SURCHARGE: 'Recargo nocturno',
  ABSENCE: 'Falta',
  BONUS_ATTENDANCE: 'Bono de asistencia',
  BONUS_PERFORMANCE: 'Bono de desempeño',
  DEDUCTION: 'Deducción',
};

/** PrimeNG tag severity per event type — deductions read as danger, extras as info/warn. */
const EVENT_SEVERITIES: Record<PayrollEventType, 'success' | 'info' | 'warn' | 'danger'> = {
  OVERTIME: 'info',
  NIGHT_SURCHARGE: 'warn',
  ABSENCE: 'danger',
  BONUS_ATTENDANCE: 'success',
  BONUS_PERFORMANCE: 'success',
  DEDUCTION: 'danger',
};

/** Spanish label per settlement granularity. */
const SETTLEMENT_LABELS: Record<SettlementType, string> = {
  DAILY: 'Diaria',
  WEEKLY: 'Semanal',
  BIWEEKLY: 'Quincenal',
  MONTHLY: 'Mensual',
};

/** Month options for the period selector; `value` is the 1-based month the API expects. */
const MONTH_OPTIONS: { label: string; value: number }[] = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
].map((label, index) => ({ label, value: index + 1 }));

/** Years offered by the period selector: two back, one forward. */
function buildYearOptions(currentYear: number): { label: string; value: number }[] {
  return [currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map((year) => ({
    label: String(year),
    value: year,
  }));
}

/**
 * Relationship between the amount typed in the settle dialog and the payroll's
 * `pendingAmount` — the whole point of the guard in `settle()`.
 */
type SettleDivergence = 'unknown' | 'invalid' | 'match' | 'under' | 'over';

/** Elements the focus trap cycles through inside an open dialog. */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/** Tolerance (in pesos) under which the typed amount counts as the pending one. */
const HALF_CENT = 0.005;

/**
 * Payroll panel of one worker: period summary, registered events and settlements.
 *
 * Reads go through `PayrollCache` (period-keyed `ResourceCache` entries) so the
 * summary and both tables are invalidated together after any mutation; writes go
 * through the `Payroll` service and then reload the same caches.
 */
@Component({
  selector: 'app-payroll-panel',
  imports: [
    FormsModule,
    TableModule,
    CheckboxModule,
    SelectModule,
    InputNumberModule,
    DatePickerModule,
    SkeletonModule,
    TooltipModule,
    TableSkeleton,
    MoneyPipe,
    RmsButton,
    RmsIconButton,
    RmsInput,
    RmsStatusPill,
  ],
  templateUrl: './payroll-panel.html',
  styleUrl: './payroll-panel.css',
  host: {
    // PrimeNG appends the select/datepicker panels to `<body>`, so focus can sit
    // outside the dialog subtree while a dialog is open: Escape and Tab must be
    // handled at document level or they never reach the dialog.
    '(document:keydown)': 'onDocumentKeydown($event)',
  },
})
export class PayrollPanel {
  private readonly payrollApi = inject(Payroll);
  private readonly payrollCache = inject(PayrollCache);
  private readonly workersCache = inject(WorkersCache);
  private readonly messages = inject(MessageService);
  private readonly confirmations = inject(ConfirmationService);
  private readonly logger = inject(Logging);

  @ViewChild('eventDialog') private eventDialog?: ElementRef<HTMLElement>;
  @ViewChild('settleDialog') private settleDialog?: ElementRef<HTMLElement>;

  /** Element that opened the current dialog, so focus can go back to it. */
  private lastFocusedElement: HTMLElement | null = null;

  private readonly today = new Date();

  // ── Filters ─────────────────────────────────────────────────────────────
  readonly workers = computed<WorkerResponse[]>(() => this.workersCache.workers.data() ?? []);
  readonly workerId = signal<number | null>(null);
  readonly selectedMonth = signal(this.today.getMonth() + 1);
  readonly selectedYear = signal(this.today.getFullYear());
  /** Period actually loaded — only changes when the admin presses "Cargar". */
  readonly periodMonth = signal(this.today.getMonth() + 1);
  readonly periodYear = signal(this.today.getFullYear());
  readonly monthOptions = MONTH_OPTIONS;
  readonly yearOptions = buildYearOptions(this.today.getFullYear());

  readonly eventTypeOptions = PAYROLL_EVENT_TYPES.map((type) => ({
    label: EVENT_LABELS[type],
    value: type,
  }));
  readonly settlementTypeOptions = SETTLEMENT_TYPES.map((type) => ({
    label: SETTLEMENT_LABELS[type],
    value: type,
  }));

  // ── Cache-backed data ───────────────────────────────────────────────────
  private readonly payrollResource = computed<ResourceCache<PayrollResponse[]> | null>(() => {
    const workerId = this.workerId();
    return workerId === null ? null : this.payrollCache.worker(workerId);
  });

  private readonly eventsResource = computed<ResourceCache<PayrollEventResponse[]> | null>(() => {
    const workerId = this.workerId();
    return workerId === null
      ? null
      : this.payrollCache.events(workerId, this.periodYear(), this.periodMonth());
  });

  private readonly settlementsResource = computed<
    ResourceCache<PayrollSettlementResponse[]> | null
  >(() => {
    const workerId = this.workerId();
    return workerId === null
      ? null
      : this.payrollCache.settlements(workerId, this.periodYear(), this.periodMonth());
  });

  /** Payroll record of the selected worker in the loaded period, if registered. */
  readonly summary = computed<PayrollResponse | null>(() => {
    const records = this.payrollResource()?.data() ?? [];
    const year = this.periodYear();
    const month = this.periodMonth();
    return records.find((record) => record.year === year && record.month === month) ?? null;
  });

  readonly events = computed<PayrollEventResponse[]>(() => this.eventsResource()?.data() ?? []);
  readonly settlements = computed<PayrollSettlementResponse[]>(
    () => this.settlementsResource()?.data() ?? [],
  );

  readonly isLoading = computed<boolean>(() =>
    [this.payrollResource(), this.eventsResource(), this.settlementsResource()].some(
      (resource) => resource?.isLoading() === true,
    ),
  );

  /** A failed load surfaces as a readable banner instead of a raw `HttpErrorResponse`. */
  readonly loadErrorMessage = computed<string | null>(() =>
    [this.payrollResource(), this.eventsResource(), this.settlementsResource()].some(
      (resource) => resource?.error() !== undefined,
    )
      ? 'No se pudieron cargar los datos de nómina.'
      : null,
  );

  /** Drives the "Pendiente por pagar" warning without string/number coercion bugs. */
  readonly hasPending = computed<boolean>(() => toAmount(this.summary()?.pendingAmount) > 0);

  readonly hasWorker = computed<boolean>(() => this.workerId() !== null);

  // ── Event form state ────────────────────────────────────────────────────
  readonly eventModalVisible = signal(false);
  readonly eventType = signal<PayrollEventType>('OVERTIME');
  readonly eventDate = signal<Date | null>(new Date());
  readonly eventQuantity = signal<number | null>(null);
  readonly eventUnitRate = signal<number | null>(null);
  readonly eventNotes = signal('');
  readonly eventError = signal<string | null>(null);
  readonly eventSaving = signal(false);
  readonly calculating = signal(false);
  /** Basis returned by `POST /v1/payroll/events/calculate` (hours × multiplier). */
  readonly calculateBasis = signal<PayrollCalculateResponse | null>(null);

  // ── Settlement form state ───────────────────────────────────────────────
  readonly settleModalVisible = signal(false);
  readonly settlementType = signal<SettlementType>('MONTHLY');
  readonly settlePeriodStart = signal<Date | null>(null);
  readonly settlePeriodEnd = signal<Date | null>(null);
  readonly settleAmount = signal<number | null>(null);
  readonly settleNotes = signal('');
  readonly settleError = signal<string | null>(null);
  readonly settleSaving = signal(false);
  /** True once the admin edits the amount; blocks overwriting it with a refresh. */
  private readonly settleAmountEdited = signal(false);
  /** Explicit acknowledgement required to settle more than the pending amount. */
  readonly settleOverpaymentAcknowledged = signal(false);

  /**
   * Reference basis of the settlement: the payroll's `pendingAmount`, rendered
   * next to the amount input so the typed figure is never judged in a vacuum.
   */
  readonly settleBasis = computed<MoneyValue | null>(() => this.summary()?.pendingAmount ?? null);

  private readonly settlePendingValue = computed<number | null>(() => {
    const basis = this.settleBasis();
    return basis === null ? null : toAmount(basis);
  });

  /** Live relationship between the typed amount and the pending basis. */
  readonly settleDivergence = computed<SettleDivergence>(() => {
    const pending = this.settlePendingValue();
    const amount = this.settleAmount();
    if (amount === null || !Number.isFinite(amount) || amount <= 0) return 'invalid';
    if (pending === null) return 'unknown';
    const difference = amount - pending;
    if (Math.abs(difference) < HALF_CENT) return 'match';
    return difference < 0 ? 'under' : 'over';
  });

  /** Absolute gap between the typed amount and the pending basis, as `Money`. */
  readonly settleDifference = computed<MoneyValue | null>(() => {
    const pending = this.settlePendingValue();
    const amount = this.settleAmount();
    if (pending === null || amount === null) return null;
    const difference = Math.abs(amount - pending);
    if (!Number.isFinite(difference)) return null;
    return { amount: difference.toFixed(2), currency: DEFAULT_CURRENCY };
  });

  constructor() {
    this.workersCache.workers.loadIfStale();

    // Auto-select the first employee once the list arrives, then load its period.
    effect(() => {
      const list = this.workers();
      if (this.workerId() !== null || list.length === 0) return;
      const first = list[0];
      untracked(() => {
        this.workerId.set(first.id ?? null);
        this.loadPeriod();
      });
    });

    // `openSettleModal()` refreshes the payroll row; re-apply the (possibly new)
    // pending amount while the admin has not typed anything in the dialog.
    effect(() => {
      const pending = this.settlePendingValue();
      const modalOpen = this.settleModalVisible();
      const edited = this.settleAmountEdited();
      if (!modalOpen || edited || pending === null) return;
      untracked(() => {
        if (this.settleAmount() !== pending) this.settleAmount.set(pending);
      });
    });
  }

  // ── Filter handlers ─────────────────────────────────────────────────────

  selectWorker(workerId: number | null): void {
    this.workerId.set(workerId);
    this.loadPeriod();
  }

  applyPeriod(): void {
    this.periodMonth.set(this.selectedMonth());
    this.periodYear.set(this.selectedYear());
    this.loadPeriod();
  }

  retry(): void {
    this.loadPeriod();
  }

  // ── Labels / formatting ─────────────────────────────────────────────────

  eventLabel(type: PayrollEventType): string {
    return EVENT_LABELS[type];
  }

  eventSeverity(type: PayrollEventType): 'success' | 'info' | 'warn' | 'danger' {
    return EVENT_SEVERITIES[type];
  }

  /** Domain status for the design-system pill (same source as the legacy tag). */
  eventStatus(type: PayrollEventType): RmsStatus {
    const severity = this.eventSeverity(type);
    return severity === 'warn' ? 'warning' : severity;
  }

  settlementLabel(type: SettlementType): string {
    return SETTLEMENT_LABELS[type];
  }

  formatDate(iso: string | null | undefined): string {
    return formatIsoDate(iso);
  }

  /** `Instant` fields (e.g. `settledAt`) carry a time: render date **and** time. */
  formatDateTime(iso: string | null | undefined): string {
    return formatInstant(iso);
  }

  // ── Event flow ──────────────────────────────────────────────────────────

  openEventModal(): void {
    this.rememberFocus();
    this.eventType.set('OVERTIME');
    this.eventDate.set(new Date());
    this.eventQuantity.set(null);
    this.eventUnitRate.set(null);
    this.eventNotes.set('');
    this.eventError.set(null);
    this.calculateBasis.set(null);
    this.eventModalVisible.set(true);
    this.focusDialog('event');
  }

  closeEventModal(): void {
    this.eventModalVisible.set(false);
    this.eventError.set(null);
    this.restoreFocus();
  }

  /**
   * A suggestion belongs to the event type it was calculated for: changing the
   * type drops both the rate and the basis line, so the form can never submit a
   * rate that belongs to another type.
   */
  onEventTypeChange(type: PayrollEventType): void {
    if (type === this.eventType()) return;
    this.eventType.set(type);
    if (this.calculateBasis() === null) return;
    this.calculateBasis.set(null);
    this.eventUnitRate.set(null);
  }

  /** Prefills rate/amount from the backend so the number is never magic. */
  calculateSuggested(): void {
    const workerId = this.workerId();
    const quantity = this.eventQuantity();
    const date = this.eventDate();
    if (workerId === null || quantity === null || quantity <= 0 || date === null) {
      this.eventError.set('Indica la fecha y una cantidad mayor a cero para calcular.');
      return;
    }

    const request: PayrollCalculateRequest = {
      userId: workerId,
      eventType: this.eventType(),
      quantity,
    };

    this.calculating.set(true);
    this.eventError.set(null);
    this.payrollApi.calculate(request).subscribe({
      next: (response) => {
        this.calculateBasis.set(response);
        this.eventUnitRate.set(toAmount(response.suggestedUnitRate));
        this.calculating.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.logger.error('Payroll: failed to calculate event', err);
        this.calculating.set(false);
        this.eventError.set(mapHttpError(err, 'payroll'));
      },
    });
  }

  createEvent(): void {
    const workerId = this.workerId();
    const quantity = this.eventQuantity();
    const unitRate = this.eventUnitRate();
    const date = this.eventDate();

    if (workerId === null || quantity === null || quantity <= 0 || date === null) {
      this.eventError.set('Completa la fecha y una cantidad mayor a cero.');
      return;
    }
    if (unitRate === null || unitRate <= 0) {
      this.eventError.set('Completa el valor unitario del evento (o usa "Calcular sugerido").');
      return;
    }

    const request: PayrollEventRequest = {
      userId: workerId,
      eventDate: toIsoDate(date),
      eventType: this.eventType(),
      quantity,
      unitRate,
      notes: this.eventNotes().trim(),
    };

    this.eventSaving.set(true);
    this.eventError.set(null);
    this.payrollApi.createEvent(request).subscribe({
      next: () => {
        this.eventSaving.set(false);
        this.eventModalVisible.set(false);
        this.restoreFocus();
        this.afterMutation('Evento registrado correctamente.');
      },
      error: (err: HttpErrorResponse) => {
        this.logger.error('Payroll: failed to create event', err);
        this.eventSaving.set(false);
        this.eventError.set(mapHttpError(err, 'payroll'));
        this.notifyError(mapHttpError(err, 'payroll'));
      },
    });
  }

  deleteEvent(event: PayrollEventResponse): void {
    this.confirmations.confirm({
      message: `¿Eliminar el evento "${EVENT_LABELS[event.eventType]}" del ${formatIsoDate(event.eventDate)}? Esta acción recalcula la nómina del periodo.`,
      header: 'Confirmar eliminación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      acceptButtonProps: { severity: 'danger' },
      accept: () => {
        this.payrollApi.deleteEvent(event.id).subscribe({
          next: () => {
            this.afterMutation('Evento eliminado correctamente.');
          },
          error: (err: HttpErrorResponse) => {
            this.logger.error('Payroll: failed to delete event', err);
            this.notifyError(mapHttpError(err, 'payroll'));
          },
        });
      },
    });
  }

  // ── Settlement flow ─────────────────────────────────────────────────────

  openSettleModal(): void {
    const payroll = this.summary();
    this.rememberFocus();
    this.settlementType.set('MONTHLY');
    this.settleAmountEdited.set(false);
    this.settleOverpaymentAcknowledged.set(false);
    this.settleAmount.set(payroll === null ? null : toAmount(payroll.pendingAmount));
    this.settlePeriodStart.set(payroll === null ? null : parseIsoDate(payroll.periodStart));
    this.settlePeriodEnd.set(payroll === null ? null : parseIsoDate(payroll.periodEnd));
    this.settleNotes.set('');
    this.settleError.set(null);
    this.settleModalVisible.set(true);
    this.focusDialog('settle');

    // The cached payroll row can be up to the cache TTL (2 min) old, so another
    // admin's settlement would not be reflected in the prefill. Refresh it; the
    // prefill effect re-applies the new pending amount unless the admin typed.
    this.payrollResource()?.refresh();
  }

  closeSettleModal(): void {
    this.settleModalVisible.set(false);
    this.settleError.set(null);
    this.restoreFocus();
  }

  /** Marks the amount as admin-edited so a background refresh cannot overwrite it. */
  onSettleAmountChange(amount: number | null): void {
    this.settleAmountEdited.set(true);
    this.settleOverpaymentAcknowledged.set(false);
    this.settleAmount.set(amount);
  }

  settle(): void {
    const workerId = this.workerId();
    const payroll = this.summary();
    const amount = this.settleAmount();
    const periodStart = this.settlePeriodStart();
    const periodEnd = this.settlePeriodEnd();

    if (payroll === null) {
      this.settleError.set('No hay una nómina cargada para este trabajador y periodo.');
      return;
    }
    if (workerId === null || amount === null || !Number.isFinite(amount) || amount <= 0) {
      this.settleError.set('Indica un monto mayor a cero para liquidar.');
      return;
    }
    if (periodStart === null || periodEnd === null) {
      this.settleError.set('Indica el inicio y el fin del periodo liquidado.');
      return;
    }

    const periodError = this.settlePeriodError(periodStart, periodEnd);
    if (periodError !== null) {
      this.settleError.set(periodError);
      return;
    }

    if (this.settleDivergence() === 'over' && !this.settleOverpaymentAcknowledged()) {
      // The exact gap is rendered (through the `money` pipe) in the warning line
      // above the buttons; this message only explains what is required.
      this.settleError.set(
        'El monto supera el pendiente del periodo. Confirma la diferencia para continuar.',
      );
      return;
    }

    const request: PayrollSettlementRequest = {
      // The backend addresses the settlement by payroll id; `year`/`month` are
      // not part of the request.
      payrollId: payroll.id,
      userId: workerId,
      settlementType: this.settlementType(),
      periodStart: toIsoDate(periodStart),
      periodEnd: toIsoDate(periodEnd),
      amount,
      notes: this.settleNotes().trim(),
    };

    this.settleSaving.set(true);
    this.settleError.set(null);
    this.payrollApi.settle(request).subscribe({
      next: () => {
        this.settleSaving.set(false);
        this.settleModalVisible.set(false);
        this.restoreFocus();
        this.afterMutation('Liquidación registrada correctamente.');
      },
      error: (err: HttpErrorResponse) => {
        this.logger.error('Payroll: failed to settle', err);
        this.settleSaving.set(false);
        this.settleError.set(mapHttpError(err, 'payroll'));
        this.notifyError(mapHttpError(err, 'payroll'));
      },
    });
  }

  // ── Internals ───────────────────────────────────────────────────────────

  /**
   * Escape / Tab handling for the dialogs, registered on `document` by the
   * component host: PrimeNG appends its select and datepicker panels to
   * `<body>`, so a dialog-scoped handler would miss Escape while one is open.
   */
  onDocumentKeydown(event: KeyboardEvent): void {
    const open = this.eventModalVisible() ? 'event' : this.settleModalVisible() ? 'settle' : null;
    if (open === null) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      if (open === 'event') this.closeEventModal();
      else this.closeSettleModal();
      return;
    }

    if (event.key === 'Tab') this.trapFocus(event, open);
  }

  /**
   * Keeps Tab inside the open dialog: focus leaving a modal is how keyboard
   * users end up typing into the page behind it.
   */
  private trapFocus(event: KeyboardEvent, which: 'event' | 'settle'): void {
    const container = (which === 'event' ? this.eventDialog : this.settleDialog)?.nativeElement;
    if (container === undefined) return;

    const focusables = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));

    const first = focusables.at(0);
    const last = focusables.at(-1);
    if (first === undefined || last === undefined) {
      event.preventDefault();
      container.focus();
      return;
    }

    const active = document.activeElement;
    const inside = active !== null && container.contains(active);

    if (event.shiftKey) {
      if (!inside || active === first) {
        event.preventDefault();
        last.focus();
      }
      return;
    }

    if (!inside || active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  /** Remembers the trigger so closing the dialog returns focus where it was. */
  private rememberFocus(): void {
    const active = document.activeElement;
    this.lastFocusedElement = active instanceof HTMLElement ? active : null;
  }

  private restoreFocus(): void {
    const target = this.lastFocusedElement;
    this.lastFocusedElement = null;
    if (target?.isConnected === true) target.focus();
  }

  /**
   * Moves focus into the freshly opened dialog so Escape and Tab reach it.
   * The dialog is `tabindex="-1"`: focusable programmatically, not tabbable.
   */
  private focusDialog(which: 'event' | 'settle'): void {
    setTimeout(() => {
      const ref = which === 'event' ? this.eventDialog : this.settleDialog;
      ref?.nativeElement.focus();
    });
  }

  /**
   * Rejects a settlement whose dates do not describe a range inside the loaded
   * payroll: the request sends `year`/`month` derived from `periodStart`, so a
   * period crossing into another month would settle the wrong payroll.
   */
  private settlePeriodError(start: Date, end: Date): string | null {
    if (toIsoDate(end) < toIsoDate(start)) {
      return 'La fecha de fin del periodo no puede ser anterior a la de inicio.';
    }

    const year = this.periodYear();
    const month = this.periodMonth();
    const insideLoadedPeriod = (date: Date): boolean =>
      date.getFullYear() === year && date.getMonth() + 1 === month;

    if (!insideLoadedPeriod(start) || !insideLoadedPeriod(end)) {
      const label = `${String(month).padStart(2, '0')}/${String(year)}`;
      return `El periodo liquidado debe estar dentro de la nómina cargada (${label}).`;
    }

    return null;
  }

  /** Loads (or reloads) the three caches of the selected worker/period. */
  private loadPeriod(): void {
    const workerId = this.workerId();
    if (workerId === null) return;
    const year = this.periodYear();
    const month = this.periodMonth();

    this.payrollCache.worker(workerId).refresh();
    this.payrollCache.events(workerId, year, month).refresh();
    this.payrollCache.settlements(workerId, year, month).refresh();
  }

  /** Invalidates every payroll cache (events change bonuses, settlements change paid). */
  private afterMutation(detail: string): void {
    this.payrollCache.invalidateAll();
    this.loadPeriod();
    this.messages.add({
      severity: 'success',
      summary: 'Operación exitosa',
      detail,
      life: 4000,
    });
  }

  private notifyError(detail: string): void {
    this.messages.add({ severity: 'error', summary: 'Error', detail, life: 5000 });
  }
}

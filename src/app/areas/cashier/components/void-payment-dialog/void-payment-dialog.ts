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

import type { PaymentResponse } from '@app/shared/models/dto/payments/payment-response';
import { Money } from '@app/shared/pipes/money/money';
import { RmsButton } from '@app/shared/ui/button/button';
import { RmsDialog } from '@app/shared/ui/dialog/dialog';
import { RmsInput } from '@app/shared/ui/input/input';

/**
 * Void confirmation dialog.
 *
 * Feature: a full, reason-mandatory void of a payment charged in the open
 * shift.
 *
 * Contract:
 *  - the reason is required (trimmed) before the destructive button enables;
 *  - the dialog explains that the void is total, irreversible and returns the
 *    order to pending;
 *  - the parent performs the HTTP call and reports the ProblemDetail here; no
 *    local state changes until the server confirms (rollback is "do nothing").
 */
@Component({
  selector: 'app-cashier-void-dialog',
  templateUrl: './void-payment-dialog.html',
  styleUrl: './void-payment-dialog.css',
  imports: [FormsModule, Money, RmsButton, RmsDialog, RmsInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CashierVoidDialog implements OnChanges {
  @Input() visible = false;
  @Input() payment: PaymentResponse | null = null;
  @Input() busy = false;
  @Input() error: string | null = null;

  @Output() readonly visibleChange = new EventEmitter<boolean>();
  @Output() readonly confirmVoid = new EventEmitter<string>();

  readonly reason = signal('');
  readonly canConfirm = computed(
    () => !this.busy && this.reason().trim().length > 0 && this.payment !== null,
  );

  ngOnChanges(changes: SimpleChanges): void {
    const change = changes['visible'] as { currentValue: boolean } | undefined;
    if (change?.currentValue === true) {
      this.reason.set('');
    }
  }

  onReasonChange(value: string): void {
    this.reason.set(value);
  }

  cancel(): void {
    this.visibleChange.emit(false);
  }

  submit(): void {
    const reason = this.reason().trim();
    if (reason.length === 0 || this.busy) return;
    this.confirmVoid.emit(reason);
  }
}

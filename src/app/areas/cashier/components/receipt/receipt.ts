import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

import type { PaymentResponse } from '@app/shared/models/dto/payments/payment-response';
import {
  PAYMENT_METHOD_LABEL,
  type PaymentTenderMethod,
} from '@app/shared/models/dto/payments/payment-method';
import { toAmount } from '@app/shared/models/dto/common/money';
import type { OrderResponse } from '@app/shared/models/dto/orders/order-response';
import { formatInstant } from '@app/shared/lib/date-format/date-format';
import { Money } from '@app/shared/pipes/money/money';
import { RmsButton } from '@app/shared/ui/button/button';
import { RmsDialog } from '@app/shared/ui/dialog/dialog';
import { buildReceiptDocument } from '../../lib/receipt-document';
import { groupOrderLines, type OrderLineView } from '../../lib/order-lines';

/**
 * Receipt / ticket dialog.
 *
 * Feature: the printable proof of a charge — order, tenders, tip, discount,
 * change, cashier and timestamp.
 *
 * Contract:
 *  - all money in the receipt comes from the server payment, never from the
 *    client preview (`subtotal`, `discount`, `tip`, `total`, `tendered`,
 *    `change` are the persisted snapshot);
 *  - lines are display-only and may be missing on a reprint, in which case the
 *    receipt says so instead of inventing a detail;
 *  - a voided payment is labelled ANULADA with the reason and timestamp;
 *  - printing uses an isolated iframe document so the app shell never prints.
 */
@Component({
  selector: 'app-cashier-receipt',
  templateUrl: './receipt.html',
  styleUrl: './receipt.css',
  imports: [Money, RmsButton, RmsDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CashierReceipt {
  @Input() visible = false;
  @Input() payment: PaymentResponse | null = null;
  /** Full order detail when available; `null` on a fresh reprint. */
  @Input() order: OrderResponse | null = null;
  @Input() tableNumber: number | null = null;
  @Input() cashierName = '';
  /** True only when the owning shift is open and the payment is completed. */
  @Input() canVoid = false;

  @Output() readonly visibleChange = new EventEmitter<boolean>();
  @Output() readonly voidRequested = new EventEmitter<PaymentResponse>();
  @Output() readonly newCharge = new EventEmitter<void>();

  get lines(): OrderLineView[] {
    return this.order === null ? [] : groupOrderLines(this.order.details);
  }

  get isVoided(): boolean {
    return this.payment?.status === 'VOIDED';
  }

  get canVoidNow(): boolean {
    return this.canVoid && this.payment?.status === 'COMPLETED';
  }

  get hasDiscount(): boolean {
    return toAmount(this.payment?.discount ?? null) > 0;
  }

  get hasTip(): boolean {
    return toAmount(this.payment?.tip ?? null) > 0;
  }

  get hasChange(): boolean {
    return toAmount(this.payment?.change ?? null) > 0;
  }

  voidedAt(): string {
    return formatInstant(this.payment?.voidedAt ?? null);
  }

  completedAt(): string {
    return formatInstant(this.payment?.completedAt ?? this.payment?.createdAt ?? null);
  }

  cashierLabel(): string {
    if (this.cashierName.trim().length > 0) return this.cashierName.trim();
    const id = this.payment?.cashierId;
    return id === null || id === undefined ? 'Cajero' : `Cajero #${String(id)}`;
  }

  methodLabel(method: PaymentTenderMethod): string {
    return PAYMENT_METHOD_LABEL[method];
  }

  close(): void {
    this.visibleChange.emit(false);
  }

  requestVoid(): void {
    if (this.payment !== null) this.voidRequested.emit(this.payment);
  }

  requestNewCharge(): void {
    this.newCharge.emit();
  }

  /** Prints the rendered ticket from an isolated, monochrome iframe. */
  printReceipt(): void {
    if (typeof document === 'undefined') return;

    const ticket = document.querySelector('.receipt-ticket');
    if (!(ticket instanceof HTMLElement)) return;

    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.setAttribute('title', 'Recibo para imprimir');
    frame.style.position = 'fixed';
    frame.style.top = '0';
    frame.style.left = '-10000px';
    frame.style.width = '800px';
    frame.style.height = '600px';
    frame.style.border = '0';
    document.body.appendChild(frame);

    const frameDocument = frame.contentDocument;
    const frameWindow = frame.contentWindow;
    if (frameDocument === null || frameWindow === null) {
      frame.remove();
      return;
    }

    frameDocument.open();
    // `document.write` is the only synchronous way to seed about:blank before
    // calling print(); the iframe is throw-away and never navigates.
    // eslint-disable-next-line typescript/no-deprecated
    frameDocument.write(buildReceiptDocument(ticket.outerHTML));
    frameDocument.close();

    const removeFrame = (): void => {
      frame.remove();
    };
    frameWindow.addEventListener('afterprint', removeFrame, { once: true });

    try {
      frameWindow.focus();
      frameWindow.print();
    } catch {
      // Printing is a browser capability (blocked in tests / headless shells).
    }
    // Fallback for browsers that never fire `afterprint` on the iframe.
    window.setTimeout(removeFrame, 60_000);
  }
}

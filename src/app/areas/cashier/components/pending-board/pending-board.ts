import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { RmsBadge } from '@app/shared/ui/badge/badge';
import { RmsButton } from '@app/shared/ui/button/button';
import { RmsEmptyState } from '@app/shared/ui/empty-state/empty-state';
import { RmsField } from '@app/shared/ui/field/field';
import { RmsIconButton } from '@app/shared/ui/icon-button/icon-button';
import { RmsInput } from '@app/shared/ui/input/input';
import { RmsSection } from '@app/shared/ui/section/section';
import { RmsSkeleton } from '@app/shared/ui/skeleton/skeleton';
import { Money } from '@app/shared/pipes/money/money';
import { formatInstant } from '@app/shared/lib/date-format/date-format';
import type { PendingOrderResponse } from '@app/shared/models/dto/payments/pending-order-response';

/**
 * Cashier pending board.
 *
 * Feature: today's delivered orders that still owe money, with a date filter,
 * an exact order/table search and bounded paging.
 *
 * Contract:
 *  - presentational only: the parent owns the HTTP calls and the paging state;
 *  - every row is a real button with an accessible name (table, order, time,
 *    total), so the board is fully keyboardable;
 *  - loading, error, empty and paged states are explicit and never render a
 *    blank list;
 *  - a previously voided order is labelled "Anulada" with text, not colour
 *    alone, and stays chargeable (the backend allows a re-charge).
 */
@Component({
  selector: 'app-cashier-pending-board',
  templateUrl: './pending-board.html',
  styleUrl: './pending-board.css',
  imports: [
    DatePipe,
    FormsModule,
    Money,
    RmsBadge,
    RmsButton,
    RmsEmptyState,
    RmsField,
    RmsIconButton,
    RmsInput,
    RmsSection,
    RmsSkeleton,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CashierPendingBoard {
  @Input() orders: PendingOrderResponse[] = [];
  @Input() loading = false;
  @Input() refreshing = false;
  @Input() error: string | null = null;
  @Input() selectedOrderId: number | null = null;
  @Input() search = '';
  /** `YYYY-MM-DD` the parent filters by. */
  @Input() date = '';
  @Input() page = 0;
  @Input() totalPages = 0;
  @Input() total = 0;
  @Input() lastUpdated: Date | null = null;

  @Output() readonly selectOrder = new EventEmitter<PendingOrderResponse>();
  @Output() readonly searchChange = new EventEmitter<string>();
  @Output() readonly dateChange = new EventEmitter<string>();
  @Output() readonly refresh = new EventEmitter<void>();
  @Output() readonly pageChange = new EventEmitter<number>();

  /** Local editable copy of the search box; emitted on Enter or button. */
  searchValue = '';

  /** Applies the typed search and returns to the first page. */
  submitSearch(): void {
    this.searchChange.emit(this.searchValue.trim());
  }

  /** Clears the search and reloads. */
  clearSearch(): void {
    this.searchValue = '';
    this.searchChange.emit('');
  }

  onDateInput(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) {
      this.dateChange.emit(target.value);
    }
  }

  tableLabel(order: PendingOrderResponse): string {
    return order.tableNumber === null ? 'Sin mesa' : `Mesa ${String(order.tableNumber)}`;
  }

  timeLabel(order: PendingOrderResponse): string {
    return formatInstant(order.deliveredAt);
  }

  partyLabel(order: PendingOrderResponse): string {
    return order.partySize === null ? '' : `${String(order.partySize)} pers.`;
  }

  isSelected(order: PendingOrderResponse): boolean {
    return order.orderId === this.selectedOrderId;
  }

  totalLabel(): string {
    return this.total === 1 ? '1 cuenta' : `${String(this.total)} cuentas`;
  }

  previousPage(): void {
    if (this.page > 0) this.pageChange.emit(this.page - 1);
  }

  nextPage(): void {
    if (this.page + 1 < this.totalPages) this.pageChange.emit(this.page + 1);
  }
}

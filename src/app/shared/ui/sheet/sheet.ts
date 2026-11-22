import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  ViewChild,
} from '@angular/core';

import { RmsIconButton } from '../icon-button/icon-button';

/**
 * `app-rms-sheet` — simple overlay on the native `<dialog>` element (D-012).
 *
 * Used for mobile sheets and simple side panels. `showModal()` gives the top
 * layer, inert background, Escape, a focus trap and focus restore without a
 * library. Bottom sheet under 640px, end panel above it.
 *
 * Consumers own the trigger; this component owns open/close state:
 *
 *   <app-rms-sheet [(open)]="open" title="Filtros">
 *     …content…
 *     <div rmsSheetFooter>…actions…</div>
 *   </app-rms-sheet>
 */
@Component({
  selector: 'app-rms-sheet',
  templateUrl: './sheet.html',
  styleUrl: './sheet.css',
  imports: [RmsIconButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RmsSheet implements AfterViewInit, OnChanges {
  private static nextId = 0;

  @Input() open = false;
  @Output() openChange = new EventEmitter<boolean>();
  @Input({ required: true }) title!: string;
  @Input() side: 'bottom' | 'end' = 'bottom';
  /** When false, Escape and the close button do not dismiss (consent flows). */
  @Input() dismissible = true;

  @ViewChild('dlg') private dialog?: ElementRef<HTMLDialogElement>;

  readonly titleId = `rms-sheet-${String(RmsSheet.nextId++)}`;

  ngAfterViewInit(): void {
    this.syncOpenState();
  }

  ngOnChanges(): void {
    if (this.dialog) this.syncOpenState();
  }

  close(): void {
    const element = this.dialog?.nativeElement;
    if (element?.open && typeof element.close === 'function') {
      element.close();
      return;
    }
    element?.removeAttribute('open');
    this.open = false;
    this.openChange.emit(false);
  }

  onCancel(event: Event): void {
    if (!this.dismissible) {
      event.preventDefault();
      return;
    }
    this.open = false;
    this.openChange.emit(false);
  }

  onNativeClose(): void {
    this.open = false;
    this.openChange.emit(false);
  }

  private syncOpenState(): void {
    const element = this.dialog?.nativeElement;
    if (!element) return;

    if (this.open && !element.open) {
      if (typeof element.showModal === 'function') element.showModal();
      else element.setAttribute('open', '');
    } else if (!this.open && element.open) {
      if (typeof element.close === 'function') element.close();
      else element.removeAttribute('open');
    }
  }
}

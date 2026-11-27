import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { DialogModule } from 'primeng/dialog';

/**
 * `app-rms-dialog` — modal dialog for complex flows (D-012).
 *
 * Thin wrapper over PrimeNG Dialog: focus trap, `aria-modal`, Escape and focus
 * restore come from PrimeNG. This primitive adds the design-system contract:
 * a required header (the accessible name), a viewport-clamped width
 * (`min(<width>, 92vw)` fixes the 460px dialog that hung off a 390px phone),
 * no drag/resize, and projected footer actions.
 *
 *   <app-rms-dialog [(visible)]="open" header="Nuevo producto">
 *     …form…
 *     <div rmsDialogFooter>…actions…</div>
 *   </app-rms-dialog>
 */
@Component({
  selector: 'app-rms-dialog',
  templateUrl: './dialog.html',
  styleUrl: './dialog.css',
  imports: [DialogModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RmsDialog {
  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  /** Dialog title. Required: it is the accessible name. */
  @Input({ required: true }) header!: string;
  /** Preferred width; always clamped to 92vw. */
  @Input() width = '560px';
  @Input() closeOnEscape = true;
  @Input() dismissableMask = false;
  /** Edge-to-edge surface for immersive editors. */
  @Input() fullscreen = false;
  /** Optional explicit dialog height, useful for canvas/editor content. */
  @Input() height = '';
  /** Makes the content body fill the dialog instead of sizing to its content. */
  @Input() fill = false;
  /** Shows the dialog header (title + close button). */
  @Input() showHeader = true;
  /** Shows the PrimeNG close button. Disable when the content owns the close flow. */
  @Input() closable = true;

  get dialogStyle(): { width: string; maxHeight: string; height?: string; margin?: string } {
    if (this.fullscreen) {
      return {
        width: '100vw',
        height: '100dvh',
        maxHeight: '100dvh',
        margin: '0',
      };
    }
    return {
      width: `min(${this.width}, 92vw)`,
      height: this.height || undefined,
      maxHeight: this.height || '92dvh',
    };
  }

  get styleClass(): string {
    const classes = ['rms-dialog'];
    if (this.fullscreen) classes.push('rms-dialog--fullscreen');
    if (this.fill) classes.push('rms-dialog--fill');
    return classes.join(' ');
  }
}

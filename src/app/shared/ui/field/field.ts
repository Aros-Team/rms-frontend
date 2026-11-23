import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

/**
 * `app-rms-field` — label + control + hint + error wrapper.
 *
 * The wrapper owns the label/for relationship and generates the hint/error
 * ids. It exposes `describedBy` so a wrapped control can bind
 * `[attr.aria-describedby]="field.describedBy"`. For native inputs and
 * textareas use `app-rms-input` / `app-rms-textarea`, which already do this.
 */
@Component({
  selector: 'app-rms-field',
  templateUrl: './field.html',
  styleUrl: './field.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RmsField {
  private static nextId = 0;
  private readonly instanceId = RmsField.nextId++;

  /** Visible label. Required: placeholder-only fields are not allowed. */
  @Input({ required: true }) label!: string;
  /** Id of the control the label points at (`for`). */
  @Input() controlId = '';
  @Input() hint = '';
  @Input() error = '';
  /** Paint the invalid state before a message exists (e.g. touched + invalid). */
  @Input() invalid = false;
  @Input() required = false;
  /** Rendered as "Opcional"; do not combine with `required`. */
  @Input() optionalLabel = '';
  /** Keeps the label for screen readers but hides it visually. */
  @Input() hideLabel = false;
  @Input() size: 'sm' | 'md' | 'lg' = 'md';

  get resolvedId(): string {
    return this.controlId || `rms-field-${String(this.instanceId)}`;
  }

  get hasError(): boolean {
    return this.invalid || this.error.length > 0;
  }

  get labelId(): string {
    return `${this.resolvedId}-label`;
  }

  get hintId(): string {
    return `${this.resolvedId}-hint`;
  }

  get errorId(): string {
    return `${this.resolvedId}-error`;
  }

  get describedBy(): string | null {
    const ids: string[] = [];
    if (this.hint) ids.push(this.hintId);
    if (this.error) ids.push(this.errorId);
    return ids.length > 0 ? ids.join(' ') : null;
  }

  get classes(): string {
    return `rms-field rms-field--${this.size}` + (this.hasError ? ' rms-field--invalid' : '');
  }
}

import { ChangeDetectionStrategy, Component, forwardRef, Input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

import { RmsField } from '../field/field';

export type RmsInputType = 'text' | 'email' | 'password' | 'search' | 'number' | 'tel' | 'url';

const NOOP = (): void => {
  // CVA placeholder before Angular registers the callbacks.
};

/**
 * `app-rms-input` — labelled text input.
 *
 * Owns label/hint/error, `aria-invalid`, `aria-describedby` and the error live
 * region. Implements ControlValueAccessor, so it works with `ngModel` and
 * reactive forms like a native input.
 *
 *   <app-rms-input formControlName="name" label="Nombre" [error]="nameError" />
 */
@Component({
  selector: 'app-rms-input',
  templateUrl: './input.html',
  styleUrl: './input.css',
  imports: [RmsField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => RmsInput),
      multi: true,
    },
  ],
})
export class RmsInput implements ControlValueAccessor {
  private static nextId = 0;
  private readonly instanceId = RmsInput.nextId++;

  @Input() id = '';
  @Input({ required: true }) label!: string;
  @Input() type: RmsInputType = 'text';
  @Input() placeholder = '';
  @Input() hint = '';
  @Input() error = '';
  /** Invalid state without a rendered message (touched but not submitted). */
  @Input() invalid = false;
  /**
   * Space-separated ids of messages rendered outside the primitive (for
   * example a shared `app-form-validation` block). They are merged into
   * `aria-describedby` without duplicating the hint/error handling.
   */
  @Input() describedByIds = '';
  @Input() required = false;
  @Input() optionalLabel = '';
  @Input() hideLabel = false;
  @Input() autocomplete = '';
  @Input() inputMode = '';
  @Input() maxLength: number | null = null;
  @Input() name = '';
  @Input() size: 'sm' | 'md' | 'lg' = 'md';
  @Input() disabled = false;
  @Input() readonly = false;

  readonly value = signal('');
  private readonly formDisabled = signal(false);
  private onChange: (value: string) => void = NOOP;
  private onTouched: () => void = NOOP;

  get isDisabled(): boolean {
    return this.disabled || this.formDisabled();
  }

  get inputId(): string {
    return this.id || `rms-input-${String(this.instanceId)}`;
  }

  get describedBy(): string | null {
    const ids: string[] = [];
    if (this.hint) ids.push(`${this.inputId}-hint`);
    if (this.error) ids.push(`${this.inputId}-error`);
    if (this.describedByIds) ids.push(this.describedByIds);
    return ids.length > 0 ? ids.join(' ') : null;
  }

  writeValue(value: string | null): void {
    this.value.set(value ?? '');
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.formDisabled.set(isDisabled);
  }

  onInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.value.set(target.value);
    this.onChange(target.value);
  }

  onBlur(): void {
    this.onTouched();
  }
}

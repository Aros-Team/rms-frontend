import {
  ChangeDetectionStrategy,
  Component,
  forwardRef,
  Input,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

import { RmsField } from '../field/field';

const NOOP = (): void => {
  // CVA placeholder before Angular registers the callbacks.
};

/**
 * `app-rms-textarea` — labelled multi-line input.
 *
 * Same contract as `app-rms-input` (label, hint, error, aria wiring, CVA) plus
 * an optional character counter. The counter is `aria-hidden` so it does not
 * interrupt screen readers on every keystroke.
 */
@Component({
  selector: 'app-rms-textarea',
  templateUrl: './textarea.html',
  styleUrl: './textarea.css',
  imports: [RmsField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => RmsTextarea),
      multi: true,
    },
  ],
})
export class RmsTextarea implements ControlValueAccessor {
  private static nextId = 0;
  private readonly instanceId = RmsTextarea.nextId++;

  @Input() id = '';
  @Input({ required: true }) label!: string;
  @Input() placeholder = '';
  @Input() hint = '';
  @Input() error = '';
  @Input() required = false;
  @Input() optionalLabel = '';
  @Input() hideLabel = false;
  @Input() rows = 3;
  @Input() maxLength: number | null = null;
  @Input() showCount = false;
  @Input() name = '';
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
    return this.id || `rms-textarea-${String(this.instanceId)}`;
  }

  get describedBy(): string | null {
    const ids: string[] = [];
    if (this.hint) ids.push(`${this.inputId}-hint`);
    if (this.error) ids.push(`${this.inputId}-error`);
    return ids.length > 0 ? ids.join(' ') : null;
  }

  get countLabel(): string {
    return `${String(this.value().length)}/${String(this.maxLength)}`;
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
    const target = event.target as HTMLTextAreaElement;
    this.value.set(target.value);
    this.onChange(target.value);
  }

  onBlur(): void {
    this.onTouched();
  }
}

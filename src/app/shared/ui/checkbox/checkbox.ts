import {
  ChangeDetectionStrategy,
  Component,
  forwardRef,
  Input,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

const NOOP = (): void => {
  // CVA placeholder before Angular registers the callbacks.
};

/**
 * `app-rms-checkbox` — native checkbox with a 20px control in a 44px hit area.
 *
 * Native input semantics (Space toggles, form participation) with a custom
 * visual box. The input stays in the accessibility tree and receives focus; the
 * focus ring is drawn on the visible box.
 */
@Component({
  selector: 'app-rms-checkbox',
  templateUrl: './checkbox.html',
  styleUrl: './checkbox.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => RmsCheckbox),
      multi: true,
    },
  ],
})
export class RmsCheckbox implements ControlValueAccessor {
  private static nextId = 0;
  private readonly instanceId = RmsCheckbox.nextId++;

  @Input() id = '';
  @Input({ required: true }) label!: string;
  @Input() description = '';
  @Input() disabled = false;
  @Input() required = false;

  readonly checked = signal(false);
  private readonly formDisabled = signal(false);
  private onChange: (value: boolean) => void = NOOP;
  private onTouched: () => void = NOOP;

  get isDisabled(): boolean {
    return this.disabled || this.formDisabled();
  }

  get inputId(): string {
    return this.id || `rms-checkbox-${String(this.instanceId)}`;
  }

  get descriptionId(): string {
    return `${this.inputId}-description`;
  }

  writeValue(value: boolean | null): void {
    this.checked.set(value === true);
  }

  registerOnChange(fn: (value: boolean) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.formDisabled.set(isDisabled);
  }

  onToggle(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.checked.set(target.checked);
    this.onChange(target.checked);
  }

  onBlur(): void {
    this.onTouched();
  }
}

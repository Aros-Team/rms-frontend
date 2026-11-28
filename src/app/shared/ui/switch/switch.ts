import { ChangeDetectionStrategy, Component, forwardRef, Input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

const NOOP = (): void => {
  // CVA placeholder before Angular registers the callbacks.
};

/**
 * `app-rms-switch` — on/off control with a visible state label.
 *
 * A `<button role="switch">` keeps native Space/Enter activation and exposes
 * `aria-checked`. The state word ("Activado"/"Desactivado") is visible, and
 * `aria-hidden` because `aria-checked` already carries the state.
 */
@Component({
  selector: 'app-rms-switch',
  templateUrl: './switch.html',
  styleUrl: './switch.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => RmsSwitch),
      multi: true,
    },
  ],
})
export class RmsSwitch implements ControlValueAccessor {
  private static nextId = 0;
  private readonly instanceId = RmsSwitch.nextId++;

  @Input() id = '';
  @Input({ required: true }) label!: string;
  @Input() onLabel = 'Activado';
  @Input() offLabel = 'Desactivado';
  /** The design requires a visible state label; hide only with a good reason. */
  @Input() showState = true;
  @Input() disabled = false;

  readonly checked = signal(false);
  private readonly formDisabled = signal(false);
  private onChange: (value: boolean) => void = NOOP;
  private onTouched: () => void = NOOP;

  get isDisabled(): boolean {
    return this.disabled || this.formDisabled();
  }

  get switchId(): string {
    return this.id || `rms-switch-${String(this.instanceId)}`;
  }

  get stateLabel(): string {
    return this.checked() ? this.onLabel : this.offLabel;
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

  toggle(): void {
    if (this.isDisabled) return;
    this.checked.set(!this.checked());
    this.onChange(this.checked());
    this.onTouched();
  }
}

import {
  ChangeDetectionStrategy,
  Component,
  forwardRef,
  Input,
  signal,
} from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import type { SelectPassThrough } from 'primeng/types/select';

import { RmsField } from '../field/field';

const NOOP = (): void => {
  // CVA placeholder before Angular registers the callbacks.
};

export interface RmsSelectOption {
  label: string;
  value: string | number;
  disabled?: boolean;
}

/**
 * `app-rms-select` — labelled select/combobox.
 *
 * Wraps PrimeNG Select so feature lanes inherit the theme, the label wiring
 * (`ariaLabelledBy` + `inputId`), the error state and the ES-CO empty message.
 * Filtering turns on automatically above 8 options (combobox behavior);
 * override with `[filter]` when the list is shorter but search matters.
 *
 *   <app-rms-select label="Área" [options]="areas" formControlName="areaId" />
 */
@Component({
  selector: 'app-rms-select',
  templateUrl: './select.html',
  styleUrl: './select.css',
  imports: [RmsField, SelectModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => RmsSelect),
      multi: true,
    },
  ],
})
export class RmsSelect implements ControlValueAccessor {
  private static nextId = 0;
  private readonly instanceId = RmsSelect.nextId++;

  @Input() id = '';
  @Input({ required: true }) label!: string;
  @Input() options: RmsSelectOption[] = [];
  @Input() placeholder = 'Selecciona una opción';
  @Input() hint = '';
  @Input() error = '';
  @Input() required = false;
  @Input() optionalLabel = '';
  @Input() hideLabel = false;
  @Input() showClear = false;
  @Input() filter: boolean | null = null;
  @Input() size: 'sm' | 'md' | 'lg' = 'md';
  @Input() disabled = false;

  readonly value = signal<string | number | null>(null);
  private readonly formDisabled = signal(false);
  private onChange: (value: string | number | null) => void = NOOP;
  private onTouched: () => void = NOOP;

  get isDisabled(): boolean {
    return this.disabled || this.formDisabled();
  }

  get selectId(): string {
    return this.id || `rms-select-${String(this.instanceId)}`;
  }

  get shouldFilter(): boolean {
    return this.filter ?? this.options.length > 8;
  }

  get describedBy(): string | null {
    const ids: string[] = [];
    if (this.hint) ids.push(`${this.selectId}-hint`);
    if (this.error) ids.push(`${this.selectId}-error`);
    return ids.length > 0 ? ids.join(' ') : null;
  }

  get primeSize(): 'small' | 'large' | undefined {
    if (this.size === 'sm') return 'small';
    if (this.size === 'lg') return 'large';
    return undefined;
  }

  /** The visible label's id is the accessible name; `<label for>` cannot point
   *  at PrimeNG's combobox span. */
  get labelledBy(): string {
    return `${this.selectId}-label`;
  }

  /** Pass-through attributes on the focusable combobox slot (PrimeNG has no
   *  inputs for `aria-describedby` / `aria-invalid`). */
  get pt(): SelectPassThrough {
    const attrs: Record<string, string> = {};
    const describedBy = this.describedBy;
    if (describedBy) attrs['aria-describedby'] = describedBy;
    if (this.error) attrs['aria-invalid'] = 'true';
    return { label: attrs } as SelectPassThrough;
  }

  writeValue(value: string | number | null): void {
    this.value.set(value ?? null);
  }

  registerOnChange(fn: (value: string | number | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.formDisabled.set(isDisabled);
  }

  onModelChange(value: string | number | null): void {
    this.value.set(value);
    this.onChange(value);
  }

  onBlur(): void {
    this.onTouched();
  }
}

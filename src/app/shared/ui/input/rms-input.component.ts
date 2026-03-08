import { ChangeDetectionStrategy, Component, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, ReactiveFormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { RmsInputInputs } from './rms-input.model';

@Component({
  selector: 'rms-input',
  standalone: true,
  imports: [ReactiveFormsModule, InputTextModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './rms-input.component.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => RmsInputComponent),
      multi: true,
    },
  ],
  styles: [`
    .rms-input-wrapper {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }

    .rms-input-label {
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--p-surface-700);
    }

    .rms-input-required {
      color: var(--p-danger-500);
      margin-left: 0.25rem;
    }

    .rms-input-field {
      width: 100%;
      padding: 0.75rem 1rem;
      border: 2px solid var(--p-surface-300);
      border-radius: 0.65rem;
      background: var(--p-surface-0);
      font-size: 0.95rem;
      color: var(--p-surface-900);
      box-sizing: border-box;
      transition: border-color 0.2s, box-shadow 0.2s;
    }

    .rms-input-field::placeholder {
      color: var(--p-surface-400);
    }

    .rms-input-field:focus {
      outline: none;
      border-color: var(--p-primary-500);
      box-shadow: 0 0 0 3px var(--p-primary-100);
    }

    .rms-input-field:disabled {
      background: var(--p-surface-100);
      color: var(--p-surface-500);
      cursor: not-allowed;
    }

    .rms-input-field.rms-input-error {
      border-color: var(--p-danger-500);
    }

    .rms-input-field.rms-input-error:focus {
      box-shadow: 0 0 0 3px var(--p-danger-100);
    }

    .rms-input-hint {
      font-size: 0.75rem;
      color: var(--p-surface-500);
    }

    .rms-input-error-msg {
      font-size: 0.75rem;
      color: var(--p-danger-500);
    }
  `],
})
export class RmsInputComponent implements ControlValueAccessor {
  readonly label = input<string>('');
  readonly placeholder = input<string>('');
  readonly type = input<RmsInputInputs['type']>('text');
  readonly disabled = input<boolean>(false);
  readonly readonly = input<boolean>(false);
  readonly required = input<boolean>(false);
  readonly errorMessage = input<string>('');
  readonly hint = input<string>('');
  readonly id = input<string>('');
  readonly hasError = input<boolean>(false);

  readonly value = signal('');
  
  private onChange: (value: string) => void = () => {};
  private onTouchedFn: () => void = () => {};

  readonly options = () => ({
    label: this.label(),
    placeholder: this.placeholder(),
    type: this.type(),
    disabled: this.disabled(),
    readonly: this.readonly(),
    required: this.required(),
    errorMessage: this.errorMessage(),
    hint: this.hint(),
    id: this.id(),
  });

  writeValue(value: string): void {
    this.value.set(value);
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouchedFn = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled();
  }

  onInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.value.set(value);
    this.onChange(value);
  }

  onBlur(): void {
    this.onTouchedFn();
  }
}

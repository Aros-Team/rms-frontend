import { ChangeDetectionStrategy, Component, forwardRef, input, output, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { RmsSelectInputs, RmsSelectOption } from './rms-select.model';

@Component({
  selector: 'rms-select',
  standalone: true,
  imports: [FormsModule, SelectModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './rms-select.component.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => RmsSelectComponent),
      multi: true,
    },
  ],
  styles: [`
    .rms-select-wrapper {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }

    .rms-select-label {
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--p-surface-700);
    }

    .rms-select-required {
      color: var(--p-danger-500);
      margin-left: 0.25rem;
    }

    :host ::ng-deep .rms-select-field {
      width: 100%;
    }

    :host ::ng-deep .rms-select-field .p-select {
      width: 100%;
      border: 2px solid var(--p-surface-300);
      border-radius: 0.65rem;
      background: var(--p-surface-0);
    }

    :host ::ng-deep .rms-select-field .p-select:not(.p-disabled):hover {
      border-color: var(--p-surface-400);
    }

    :host ::ng-deep .rms-select-field .p-select:not(.p-disabled).p-focus {
      border-color: var(--p-primary-500);
      box-shadow: 0 0 0 3px var(--p-primary-100);
    }

    :host ::ng-deep .rms-select-field .p-select-label {
      padding: 0.75rem 1rem;
      font-size: 0.95rem;
      color: var(--p-surface-900);
    }

    :host ::ng-deep .rms-select-field .p-select-placeholder {
      color: var(--p-surface-400);
    }

    :host ::ng-deep .rms-select-field .p-select-dropdown {
      color: var(--p-surface-500);
    }

    :host ::ng-deep .rms-select-field.p-invalid {
      border-color: var(--p-danger-500);
    }

    .rms-select-hint {
      font-size: 0.75rem;
      color: var(--p-surface-500);
    }

    .rms-select-error-msg {
      font-size: 0.75rem;
      color: var(--p-danger-500);
    }
  `],
})
export class RmsSelectComponent implements ControlValueAccessor {
  readonly label = input<string>('');
  readonly placeholder = input<string>('Selecciona una opción');
  readonly optionsList = input<RmsSelectOption[]>([]);
  readonly disabled = input<boolean>(false);
  readonly readonly = input<boolean>(false);
  readonly required = input<boolean>(false);
  readonly errorMessage = input<string>('');
  readonly hint = input<string>('');
  readonly id = input<string>('');
  readonly emptyMessage = input<string>('No se encontraron opciones');
  readonly hasError = input<boolean>(false);

  readonly selectedValue = signal<string | number | null>(null);
  
  // Output para que el componente padre pueda escuchar cambios
  readonly onChange = output<string | number | null>();

  private onChangeCallback: (value: string | number | null) => void = () => {};
  private onTouchedFn: () => void = () => {};

  readonly config = () => ({
    label: this.label(),
    placeholder: this.placeholder(),
    options: this.optionsList(),
    disabled: this.disabled(),
    readonly: this.readonly(),
    required: this.required(),
    errorMessage: this.errorMessage(),
    hint: this.hint(),
    id: this.id(),
    emptyMessage: this.emptyMessage(),
  });

  writeValue(value: string | number | null): void {
    this.selectedValue.set(value);
  }

  registerOnChange(fn: (value: string | number | null) => void): void {
    this.onChangeCallback = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouchedFn = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled();
  }

  onSelectionChange(event: { value: string | number | null }): void {
    this.selectedValue.set(event.value);
    this.onChangeCallback(event.value);
    this.onTouchedFn();
    // Emitir evento para que el padre pueda escuchar
    this.onChange.emit(event.value);
  }

  onBlur(): void {
    this.onTouchedFn();
  }
}

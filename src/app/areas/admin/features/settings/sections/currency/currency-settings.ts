import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  EventEmitter,
  inject,
  OnInit,
  Output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

import { MessageService } from 'primeng/api';

import { SettingsApi } from '@services/settings/settings-api';
import { problemMessage } from '@services/settings/problem-detail';
import type { CurrencySettings } from '@models/dto/settings/settings';
import { RmsButton } from '@shared/ui/button/button';
import { RmsEmptyState } from '@shared/ui/empty-state/empty-state';
import { RmsSection } from '@shared/ui/section/section';
import { RmsSelect, type RmsSelectOption } from '@shared/ui/select/select';
import { RmsSkeleton } from '@shared/ui/skeleton/skeleton';

import { previewCurrency, requiredValidator } from '../../settings-validation';

interface CurrencyForm {
  code: FormControl<string>;
}

/** Currencies offered by the picker; any ISO 4217 code is still accepted by the API. */
const CURRENCY_OPTIONS: readonly RmsSelectOption[] = [
  { label: 'Peso colombiano (COP)', value: 'COP' },
  { label: 'Dólar estadounidense (USD)', value: 'USD' },
  { label: 'Euro (EUR)', value: 'EUR' },
  { label: 'Peso mexicano (MXN)', value: 'MXN' },
  { label: 'Peso chileno (CLP)', value: 'CLP' },
  { label: 'Peso argentino (ARS)', value: 'ARS' },
  { label: 'Sol peruano (PEN)', value: 'PEN' },
  { label: 'Real brasileño (BRL)', value: 'BRL' },
  { label: 'Bolívar venezolano (VES)', value: 'VES' },
  { label: 'Peso uruguayo (UYU)', value: 'UYU' },
  { label: 'Guaraní paraguayo (PYG)', value: 'PYG' },
  { label: 'Boliviano (BOB)', value: 'BOB' },
  { label: 'Colón costarricense (CRC)', value: 'CRC' },
  { label: 'Quetzal guatemalteco (GTQ)', value: 'GTQ' },
  { label: 'Lempira hondureño (HNL)', value: 'HNL' },
  { label: 'Córdoba nicaragüense (NIO)', value: 'NIO' },
  { label: 'Balboa panameño (PAB)', value: 'PAB' },
  { label: 'Peso dominicano (DOP)', value: 'DOP' },
  { label: 'Dólar canadiense (CAD)', value: 'CAD' },
  { label: 'Libra esterlina (GBP)', value: 'GBP' },
];

/**
 * Currency section.
 *
 * Contract: `GET/PUT /v1/settings/currency`. The code drives every new money
 * value and every aggregate. Stored amounts are never converted, so the change
 * is presented as a configuration change with an explicit warning and a live
 * preview of name, symbol and fraction digits.
 */
@Component({
  selector: 'app-settings-currency',
  templateUrl: './currency-settings.html',
  imports: [ReactiveFormsModule, RmsSection, RmsSelect, RmsButton, RmsEmptyState, RmsSkeleton],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CurrencySettingsSection implements OnInit {
  private readonly api = inject(SettingsApi);
  private readonly fb = inject(FormBuilder);
  private readonly messages = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);

  @Output() readonly dirtyChange = new EventEmitter<boolean>();

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly loadError = signal('');
  readonly saveError = signal('');
  readonly current = signal<CurrencySettings | null>(null);

  readonly form: FormGroup<CurrencyForm> = this.fb.nonNullable.group({
    code: ['COP', [requiredValidator, Validators.pattern(/^[A-Za-z]{3}$/)]],
  });

  /** Mirrors the form control so the preview can be a computed signal. */
  private readonly codeValue = signal('COP');

  readonly preview = computed(() => previewCurrency(this.codeValue()));
  readonly dirty = computed(() => {
    const current = this.current();
    if (current === null) return false;
    return (this.preview()?.code ?? '') !== current.code;
  });

  readonly options = computed<RmsSelectOption[]>(() => {
    const currentCode = this.current()?.code;
    if (currentCode === undefined) return [...CURRENCY_OPTIONS];
    if (CURRENCY_OPTIONS.some((option) => option.value === currentCode)) {
      return [...CURRENCY_OPTIONS];
    }
    return [{ label: currentCode, value: currentCode }, ...CURRENCY_OPTIONS];
  });

  constructor() {
    this.form.controls.code.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((code) => {
        const normalized = code.trim().toUpperCase();
        this.codeValue.set(normalized);
        if (normalized !== code) {
          this.form.controls.code.setValue(normalized, { emitEvent: false });
        }
        this.dirtyChange.emit(this.dirty());
      });
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set('');
    this.api.getCurrency().subscribe({
      next: (settings) => {
        this.current.set(settings);
        this.form.reset({ code: settings.code });
        this.codeValue.set(settings.code);
        this.loading.set(false);
        this.dirtyChange.emit(false);
      },
      error: (error: unknown) => {
        this.loadError.set(problemMessage(error, 'No se pudo cargar la moneda activa.'));
        this.loading.set(false);
      },
    });
  }

  reset(): void {
    const current = this.current();
    if (current === null) return;
    this.form.reset({ code: current.code });
    this.codeValue.set(current.code);
    this.saveError.set('');
    this.dirtyChange.emit(false);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.saving()) return;

    const code = this.form.controls.code.value.trim().toUpperCase();
    this.saving.set(true);
    this.saveError.set('');
    this.api.updateCurrency(code).subscribe({
      next: (settings) => {
        this.current.set(settings);
        this.form.reset({ code: settings.code });
        this.codeValue.set(settings.code);
        this.saving.set(false);
        this.dirtyChange.emit(false);
        this.messages.add({
          severity: 'success',
          summary: 'Moneda actualizada',
          detail: `La moneda activa ahora es ${settings.code} (${settings.displayName}).`,
          life: 5000,
        });
      },
      error: (error: unknown) => {
        this.saveError.set(problemMessage(error, 'No se pudo cambiar la moneda.'));
        this.saving.set(false);
      },
    });
  }

  codeError(): string {
    const control = this.form.controls.code;
    if (!control.invalid || !control.touched) return '';
    if (control.hasError('required')) return 'Selecciona una moneda.';
    if (control.hasError('pattern')) return 'El código debe tener tres letras (ISO 4217).';
    return 'Revisa el código de la moneda.';
  }
}

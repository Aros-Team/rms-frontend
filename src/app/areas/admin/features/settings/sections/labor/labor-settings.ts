import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  EventEmitter,
  inject,
  OnInit,
  Output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
} from '@angular/forms';

import { MessageService } from 'primeng/api';

import { SettingsApi } from '@services/settings/settings-api';
import { problemMessage } from '@services/settings/problem-detail';
import type { LaborCostMode, LaborSettings } from '@models/dto/settings/settings';
import { RmsButton } from '@shared/ui/button/button';
import { RmsEmptyState } from '@shared/ui/empty-state/empty-state';
import { RmsInput } from '@shared/ui/input/input';
import { RmsSection } from '@shared/ui/section/section';
import { RmsSelect, type RmsSelectOption } from '@shared/ui/select/select';
import { RmsSkeleton } from '@shared/ui/skeleton/skeleton';

import { requiredValidator } from '../../settings-validation';

interface LaborForm {
  mode: FormControl<LaborCostMode>;
  standardHourlyRate: FormControl<string>;
  defaultExpectedHoursPerMonth: FormControl<string>;
}

const MODE_OPTIONS: RmsSelectOption[] = [
  { label: 'Automático: nómina real, luego tarifa estándar', value: 'AUTO' },
  { label: 'Real: solo nómina registrada', value: 'REAL' },
  { label: 'Estándar: promedio de salarios o tarifa fija', value: 'STANDARD' },
];

function nonNegativeNumberValidator(control: AbstractControl<string>): ValidationErrors | null {
  const value = control.value.trim();
  if (value.length === 0) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? null : { amount: true };
}

function hoursValidator(control: AbstractControl<string>): ValidationErrors | null {
  const value = control.value.trim();
  if (value.length === 0) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return { hours: true };
  return parsed >= 0 && parsed <= 744 ? null : { hours: true };
}

/**
 * Labor costing section.
 *
 * Contract: `GET/PUT /v1/settings/labor`. The mode is consumed by the costing
 * engine (`AreaLaborCostAdapter`), so the screen explains each strategy and its
 * fallback in place instead of relying on the admin's memory.
 */
@Component({
  selector: 'app-settings-labor',
  templateUrl: './labor-settings.html',
  imports: [
    ReactiveFormsModule,
    RmsSection,
    RmsSelect,
    RmsInput,
    RmsButton,
    RmsEmptyState,
    RmsSkeleton,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LaborSettingsSection implements OnInit {
  private readonly api = inject(SettingsApi);
  private readonly fb = inject(FormBuilder);
  private readonly messages = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);

  @Output() readonly dirtyChange = new EventEmitter<boolean>();

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly loadError = signal('');
  readonly saveError = signal('');
  readonly currency = signal('COP');
  readonly modeValue = signal<LaborCostMode>('AUTO');
  readonly dirty = signal(false);

  readonly modeOptions = MODE_OPTIONS;

  readonly form: FormGroup<LaborForm> = this.fb.nonNullable.group({
    mode: this.fb.nonNullable.control<LaborCostMode>('AUTO', [requiredValidator]),
    standardHourlyRate: this.fb.nonNullable.control('0.00', [
      requiredValidator,
      (control: AbstractControl<string>) => nonNegativeNumberValidator(control),
    ]),
    defaultExpectedHoursPerMonth: this.fb.nonNullable.control('160', [
      requiredValidator,
      (control: AbstractControl<string>) => hoursValidator(control),
    ]),
  });

  private snapshot = '';

  /** The three strategies, in the order the backend resolves them. */
  readonly modes: readonly { id: LaborCostMode; label: string; description: string }[] = [
    {
      id: 'AUTO',
      label: 'Automático',
      description:
        'Usa el costo real de nómina cuando hay horas registradas; si no, el promedio estándar; y si tampoco hay datos, la tarifa por hora configurada.',
    },
    {
      id: 'REAL',
      label: 'Solo nómina real',
      description:
        'Calcula con la nómina registrada (`net_amount / horas trabajadas`). Si un área no tiene horas, cae en la tarifa estándar.',
    },
    {
      id: 'STANDARD',
      label: 'Solo estándar',
      description:
        'Divide la suma de salarios entre las horas esperadas de cada trabajador. Los trabajadores sin horas usan las horas esperadas por defecto.',
    },
  ];

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.modeValue.set(this.form.controls.mode.value);
      this.emitDirty();
    });
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set('');
    this.api.getLabor().subscribe({
      next: (settings) => {
        this.patch(settings);
      },
      error: (error: unknown) => {
        this.loadError.set(problemMessage(error, 'No se pudo cargar la configuración de nómina.'));
        this.loading.set(false);
      },
    });
  }

  reset(): void {
    if (this.snapshot.length === 0) return;
    const settings = JSON.parse(this.snapshot) as LaborSettings;
    this.patch(settings);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.saving()) return;

    const raw = this.form.getRawValue();
    this.saving.set(true);
    this.saveError.set('');
    this.api
      .updateLabor({
        mode: raw.mode,
        standardHourlyRate: Number(raw.standardHourlyRate),
        defaultExpectedHoursPerMonth: Number(raw.defaultExpectedHoursPerMonth),
      })
      .subscribe({
        next: (settings) => {
          this.patch(settings);
          this.messages.add({
            severity: 'success',
            summary: 'Nómina actualizada',
            detail: 'El modo de costo y la tarifa estándar se guardaron.',
            life: 4000,
          });
        },
        error: (error: unknown) => {
          this.saveError.set(
            problemMessage(error, 'No se pudo guardar la configuración de nómina.'),
          );
          this.saving.set(false);
        },
      });
  }

  controlError(name: 'standardHourlyRate' | 'defaultExpectedHoursPerMonth'): string {
    const control = this.form.controls[name];
    if (!control.invalid || !control.touched) return '';
    if (control.hasError('required')) return 'Este campo es obligatorio.';
    if (control.hasError('amount')) return 'Escribe un importe mayor o igual a cero.';
    if (control.hasError('hours')) return 'Usa un número entero entre 0 y 744.';
    return 'Revisa este campo.';
  }

  private patch(settings: LaborSettings): void {
    this.form.reset({
      mode: settings.mode,
      standardHourlyRate: settings.standardHourlyRate.amount,
      defaultExpectedHoursPerMonth: String(settings.defaultExpectedHoursPerMonth),
    });
    this.currency.set(settings.standardHourlyRate.currency);
    this.modeValue.set(settings.mode);
    this.snapshot = JSON.stringify(settings);
    this.loading.set(false);
    this.saving.set(false);
    this.emitDirty();
  }

  private emitDirty(): void {
    if (this.snapshot.length === 0) return;
    const raw = this.form.getRawValue();
    const persisted = JSON.parse(this.snapshot) as LaborSettings;
    const dirty =
      raw.mode !== persisted.mode ||
      Number(raw.standardHourlyRate) !== Number(persisted.standardHourlyRate.amount) ||
      Number(raw.defaultExpectedHoursPerMonth) !== persisted.defaultExpectedHoursPerMonth;
    this.dirty.set(dirty);
    this.dirtyChange.emit(dirty);
  }
}

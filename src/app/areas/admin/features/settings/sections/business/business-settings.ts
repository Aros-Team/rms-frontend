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
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import type { AbstractControl } from '@angular/forms';

import { MessageService } from 'primeng/api';

import { SettingsApi } from '@services/settings/settings-api';
import { problemFieldError, problemMessage } from '@services/settings/problem-detail';
import type { BusinessProfile } from '@models/dto/settings/settings';
import { RmsButton } from '@shared/ui/button/button';
import { RmsEmptyState } from '@shared/ui/empty-state/empty-state';
import { RmsInput } from '@shared/ui/input/input';
import { RmsSection } from '@shared/ui/section/section';
import { RmsSkeleton } from '@shared/ui/skeleton/skeleton';

import {
  bcp47LocaleValidator,
  emailValidator,
  ianaTimezoneValidator,
  requiredValidator,
} from '../../settings-validation';

type BusinessField = keyof BusinessProfile;

type BusinessForm = FormGroup<{
  restaurantName: FormControl<string>;
  legalName: FormControl<string>;
  taxId: FormControl<string>;
  address: FormControl<string>;
  phone: FormControl<string>;
  email: FormControl<string>;
  timezone: FormControl<string>;
  locale: FormControl<string>;
}>;

/**
 * Business profile section.
 *
 * Contract: `GET/PUT /v1/settings/business`. The form validates the same rules
 * the backend enforces (IANA timezone, BCP 47 locale, e-mail, lengths), maps a
 * bean-validation `detail` back onto its field and reports any other problem in
 * a banner. Every edit marks the section dirty so the page can guard it.
 */
@Component({
  selector: 'app-settings-business',
  templateUrl: './business-settings.html',
  imports: [ReactiveFormsModule, RmsSection, RmsInput, RmsButton, RmsEmptyState, RmsSkeleton],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BusinessSettings implements OnInit {
  private readonly api = inject(SettingsApi);
  private readonly fb = inject(FormBuilder);
  private readonly messages = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);

  @Output() readonly dirtyChange = new EventEmitter<boolean>();

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly loadError = signal('');
  readonly saveError = signal('');
  readonly dirty = signal(false);
  readonly fieldErrors = signal<Partial<Record<BusinessField, string>>>({});

  readonly form: BusinessForm = this.fb.nonNullable.group({
    restaurantName: this.fb.nonNullable.control('', [
      requiredValidator,
      Validators.maxLength(120),
    ]),
    legalName: this.fb.nonNullable.control('', [Validators.maxLength(160)]),
    taxId: this.fb.nonNullable.control('', [Validators.maxLength(40)]),
    address: this.fb.nonNullable.control('', [Validators.maxLength(200)]),
    phone: this.fb.nonNullable.control('', [Validators.maxLength(30)]),
    email: this.fb.nonNullable.control('', [emailValidator, Validators.maxLength(120)]),
    timezone: this.fb.nonNullable.control('', [
      requiredValidator,
      Validators.maxLength(60),
      (control: AbstractControl<string>) => ianaTimezoneValidator(control),
    ]),
    locale: this.fb.nonNullable.control('', [
      requiredValidator,
      Validators.maxLength(20),
      (control: AbstractControl<string>) => bcp47LocaleValidator(control),
    ]),
  });

  private snapshot = '';

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.refreshDirty();
    });
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set('');
    this.api.getBusiness().subscribe({
      next: (profile) => {
        this.patch(profile);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loadError.set(
          problemMessage(error, 'No se pudo cargar la información del negocio.'),
        );
        this.loading.set(false);
      },
    });
  }

  /** Discards local edits and returns to the persisted snapshot. */
  reset(): void {
    this.patch(JSON.parse(this.snapshot) as BusinessProfile);
    this.saveError.set('');
    this.fieldErrors.set({});
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.saving()) return;

    this.saving.set(true);
    this.saveError.set('');
    this.fieldErrors.set({});

    this.api.updateBusiness(this.form.getRawValue()).subscribe({
      next: (profile) => {
        this.patch(profile);
        this.saving.set(false);
        this.messages.add({
          severity: 'success',
          summary: 'Datos guardados',
          detail: 'La información del negocio se actualizó.',
          life: 4000,
        });
      },
      error: (error: unknown) => {
        this.applyServerError(error);
        this.saving.set(false);
      },
    });
  }

  /** Message shown under a control (server field error first, then validation). */
  controlError(name: BusinessField): string {
    const serverError = this.fieldErrors()[name];
    if (serverError !== undefined) return serverError;

    const control = this.form.controls[name];
    if (!control.invalid || !control.touched) return '';

    if (control.hasError('required')) return 'Este campo es obligatorio.';
    if (control.hasError('email')) return 'Escribe un correo válido.';
    if (control.hasError('maxlength')) return 'El valor es demasiado largo.';
    if (control.hasError('timezone')) return 'Usa una zona IANA válida, por ejemplo America/Bogota.';
    if (control.hasError('locale')) return 'Usa una etiqueta regional válida, por ejemplo es-CO.';
    return 'Revisa este campo.';
  }

  private patch(profile: BusinessProfile): void {
    this.form.reset(profile);
    this.snapshot = JSON.stringify(this.form.getRawValue());
    this.refreshDirty();
  }

  private refreshDirty(): void {
    const next = JSON.stringify(this.form.getRawValue()) !== this.snapshot;
    if (next === this.dirty()) return;
    this.dirty.set(next);
    this.dirtyChange.emit(next);
  }

  private applyServerError(error: unknown): void {
    const fieldError = problemFieldError(error);
    if (fieldError !== null && fieldError.field in this.form.controls) {
      const field = fieldError.field as BusinessField;
      this.fieldErrors.set({ [field]: fieldError.message });
      this.form.controls[field].markAsTouched();
      return;
    }
    this.saveError.set(problemMessage(error, 'No se pudo guardar la información del negocio.'));
  }
}

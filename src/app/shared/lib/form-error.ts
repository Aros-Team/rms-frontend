import { FormGroup } from '@angular/forms';

/**
 * Resolves the single message a form control should show.
 *
 * Contract:
 *  - a backend message always wins, even before the control is touched;
 *  - otherwise a control only shows its validation message when it is
 *    `invalid` and `touched`;
 *  - priority is `required`, then `pattern` (with per-field copy for
 *    `document`, `phone` and `name`), then `email`;
 *  - any other error, or a valid/untouched control, returns `''`.
 *
 * The copy is the one historically rendered by `app-form-validation`; keep it
 * verbatim so screens that migrated to a primitive's `[error]` input read the
 * same as the remaining `app-form-validation` consumers.
 */
export function fieldError(
  form: FormGroup,
  field: string,
  backendError?: string,
): string {
  if (backendError) return backendError;

  const control = form.get(field);
  if (!control || !control.invalid || !control.touched) return '';

  if (control.hasError('required')) return 'Campo requerido';

  if (control.hasError('pattern')) {
    if (field === 'document') return 'El documento debe contener solo números';
    if (field === 'phone') return 'El teléfono debe tener 10 dígitos';
    if (field === 'name') return 'El nombre solo permite letras y espacios';
    return 'Formato inválido';
  }

  if (control.hasError('email')) return 'Ingrese un correo electrónico válido';

  return '';
}

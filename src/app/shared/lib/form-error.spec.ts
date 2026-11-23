/**
 * Tests for the shared field-error resolver.
 *
 * Feature: areas and categories used to duplicate `app-form-validation` markup
 * beside every primitive. The copy and the precedence now live in one pure
 * function, so these tests pin the contract both consumers rely on:
 *
 *  - a backend message wins, even when the control is valid or untouched;
 *  - validation copy only appears when the control is `invalid && touched`;
 *  - `required` beats `pattern`, `pattern` beats `email`;
 *  - `pattern` keeps the per-field copy for `document`, `phone` and `name` and
 *    falls back to "Formato inválido" for any other field;
 *  - unknown fields and unknown errors render nothing (`''`).
 *
 * Approach: build plain reactive-form groups with real Angular validators and
 * assert the exact strings. No TestBed, no template compilation.
 */
import { FormControl, FormGroup, ValidatorFn, Validators } from '@angular/forms';
import { describe, expect, it } from 'vitest';

import { fieldError } from './form-error';

// Wrappers keep the validator references out of the test body; the lint rule
// flags passing a `Validators.*` method reference unbound.
const required: ValidatorFn = (control) => Validators.required(control);
const email: ValidatorFn = (control) => Validators.email(control);
const pattern = (regex: RegExp): ValidatorFn => (control) =>
  Validators.pattern(regex)(control);

describe('fieldError', () => {
  it('returns the backend message first, even for a valid untouched control', () => {
    const form = new FormGroup({ name: new FormControl('Área') });
    expect(fieldError(form, 'name', 'Nombre duplicado')).toBe('Nombre duplicado');
  });

  it('ignores validation until the control is touched', () => {
    const form = new FormGroup({ name: new FormControl('', required) });
    expect(fieldError(form, 'name')).toBe('');
    form.get('name')?.markAsTouched();
    expect(fieldError(form, 'name')).toBe('Campo requerido');
  });

  it('returns nothing for a valid touched control', () => {
    const form = new FormGroup({ name: new FormControl('Cocina', required) });
    form.get('name')?.markAsTouched();
    expect(fieldError(form, 'name')).toBe('');
  });

  it('prefers required over pattern and email', () => {
    const form = new FormGroup({
      field: new FormControl('', [required, email, pattern(/^\d+$/)]),
    });
    form.get('field')?.markAsTouched();
    expect(fieldError(form, 'field')).toBe('Campo requerido');
  });

  it('renders the document copy for a pattern error', () => {
    const form = new FormGroup({ document: new FormControl('12a', pattern(/^\d+$/)) });
    form.get('document')?.markAsTouched();
    expect(fieldError(form, 'document')).toBe('El documento debe contener solo números');
  });

  it('renders the phone copy for a pattern error', () => {
    const form = new FormGroup({ phone: new FormControl('123', pattern(/^\d{10}$/)) });
    form.get('phone')?.markAsTouched();
    expect(fieldError(form, 'phone')).toBe('El teléfono debe tener 10 dígitos');
  });

  it('renders the name copy for a pattern error', () => {
    const form = new FormGroup({ name: new FormControl('Ana1', pattern(/^[a-zA-Z ]+$/)) });
    form.get('name')?.markAsTouched();
    expect(fieldError(form, 'name')).toBe('El nombre solo permite letras y espacios');
  });

  it('falls back to the generic pattern copy', () => {
    const form = new FormGroup({ code: new FormControl('a b', pattern(/^[a-z]+$/)) });
    form.get('code')?.markAsTouched();
    expect(fieldError(form, 'code')).toBe('Formato inválido');
  });

  it('renders the email copy for an email error', () => {
    const form = new FormGroup({ email: new FormControl('sin-arroba', email) });
    form.get('email')?.markAsTouched();
    expect(fieldError(form, 'email')).toBe('Ingrese un correo electrónico válido');
  });

  it('returns nothing for an unknown field', () => {
    const form = new FormGroup({ name: new FormControl('', required) });
    expect(fieldError(form, 'missing')).toBe('');
  });

  it('returns nothing for a touched control with an unmapped error', () => {
    const form = new FormGroup({ name: new FormControl('x', () => ({ custom: true })) });
    form.get('name')?.markAsTouched();
    expect(fieldError(form, 'name')).toBe('');
  });
});

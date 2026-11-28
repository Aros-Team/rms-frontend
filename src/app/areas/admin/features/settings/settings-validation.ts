import type { AbstractControl, ValidationErrors } from '@angular/forms';
import { Validators } from '@angular/forms';

/**
 * Validators shared by the settings forms.
 *
 * The backend validates the IANA timezone and the BCP 47 locale with the JDK;
 * these mirror that contract client-side so a bad value is caught before the
 * PUT and reported next to the field.
 */

/**
 * `Validators.required` wrapped in an arrow.
 *
 * Angular exposes its validators as unbound methods; passing `Validators.required`
 * directly loses `this` and trips `@typescript-eslint/unbound-method`.
 */
export const requiredValidator = (control: AbstractControl): ValidationErrors | null =>
  Validators.required(control);

/** `Validators.email` wrapped for the same reason as {@link requiredValidator}. */
export const emailValidator = (control: AbstractControl): ValidationErrors | null =>
  Validators.email(control);

/** Accepts an IANA zone id (`America/Bogota`). Empty stays valid for `required`. */
export function ianaTimezoneValidator(control: AbstractControl<string>): ValidationErrors | null {
  const value = control.value.trim();
  if (value.length === 0) return null;
  try {
    new Intl.DateTimeFormat('es-CO', { timeZone: value });
    return null;
  } catch {
    return { timezone: true };
  }
}

/** Accepts a canonical BCP 47 tag (`es-CO`, `en-US`). */
export function bcp47LocaleValidator(control: AbstractControl<string>): ValidationErrors | null {
  const value = control.value.trim();
  if (value.length === 0) return null;
  try {
    Intl.getCanonicalLocales(value);
    return null;
  } catch {
    return { locale: true };
  }
}

/** A three-letter, alphabetic ISO 4217 code. */
export function isCurrencyCode(value: string): boolean {
  return /^[A-Za-z]{3}$/.test(value.trim());
}

/** Currency metadata resolved locally for the live preview. */
export interface CurrencyPreview {
  code: string;
  displayName: string;
  symbol: string;
  fractionDigits: number;
}

/**
 * Resolves display name, symbol and fraction digits from `Intl`.
 *
 * Returns `null` for a code the runtime does not know, which is exactly the
 * case the backend would reject with a 400.
 */
export function previewCurrency(code: string): CurrencyPreview | null {
  const normalized = code.trim().toUpperCase();
  if (!isCurrencyCode(normalized)) return null;

  try {
    const formatter = new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: normalized,
    });
    const displayNames = new Intl.DisplayNames(['es-CO'], { type: 'currency' });
    const displayName = displayNames.of(normalized);
    // Intl accepts any three-letter code and echoes unknown ones verbatim.
    // The backend rejects them, so treat "name === code" as unknown.
    if (displayName === undefined || displayName === normalized) return null;
    const symbol =
      formatter
        .formatToParts(0)
        .find((part) => part.type === 'currency')
        ?.value.trim() ?? normalized;
    return {
      code: normalized,
      displayName,
      symbol,
      fractionDigits: formatter.resolvedOptions().maximumFractionDigits ?? 2,
    };
  } catch {
    return null;
  }
}

/** Formats an ISO timestamp for the admin UI; never renders a raw ISO string. */
export function formatSettingsTimestamp(iso: string | null | undefined): string {
  if (iso === null || iso === undefined || iso.length === 0) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

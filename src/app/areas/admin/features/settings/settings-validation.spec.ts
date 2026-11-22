/**
 * Tests for the settings validation helpers.
 *
 * Feature: client-side mirror of the backend's business-profile and currency
 * validation, plus safe timestamp formatting for the admin UI.
 * Contract:
 *  - an IANA zone is valid only when `Intl.DateTimeFormat` accepts it;
 *  - a BCP 47 tag is valid only when `Intl.getCanonicalLocales` accepts it;
 *  - empty optional values pass (the field is not `required`) and `null` is
 *    never returned for a valid value;
 *  - the currency preview resolves name/symbol/fraction digits and rejects
 *    anything that is not a three-letter code;
 *  - timestamps never render a raw ISO string.
 *
 * Approach: pure functions, no TestBed.
 */
import { FormControl } from '@angular/forms';

import {
  bcp47LocaleValidator,
  formatSettingsTimestamp,
  ianaTimezoneValidator,
  isCurrencyCode,
  previewCurrency,
} from './settings-validation';

describe('settings validation', () => {
  it('accepts a real IANA zone and rejects an invented one', () => {
    expect(ianaTimezoneValidator(new FormControl('America/Bogota'))).toBeNull();
    expect(ianaTimezoneValidator(new FormControl('Europe/Madrid'))).toBeNull();
    expect(ianaTimezoneValidator(new FormControl('Marte/Olympus'))).toEqual({ timezone: true });
  });

  it('lets an empty timezone pass so `required` owns the message', () => {
    expect(ianaTimezoneValidator(new FormControl(''))).toBeNull();
  });

  it('accepts a canonical locale and rejects a malformed tag', () => {
    expect(bcp47LocaleValidator(new FormControl('es-CO'))).toBeNull();
    expect(bcp47LocaleValidator(new FormControl('en-US'))).toBeNull();
    expect(bcp47LocaleValidator(new FormControl('es_CO'))).toEqual({ locale: true });
  });

  it('recognises only three-letter currency codes', () => {
    expect(isCurrencyCode('COP')).toBe(true);
    expect(isCurrencyCode(' usd ')).toBe(true);
    expect(isCurrencyCode('CO')).toBe(false);
    expect(isCurrencyCode('COPP')).toBe(false);
    expect(isCurrencyCode('')).toBe(false);
  });

  it('resolves a live currency preview from Intl', () => {
    const preview = previewCurrency('usd');

    expect(preview).not.toBeNull();
    expect(preview?.code).toBe('USD');
    expect(preview?.displayName.length).toBeGreaterThan(0);
    expect(preview?.symbol.length).toBeGreaterThan(0);
    expect(preview?.fractionDigits).toBe(2);
  });

  it('returns null for a code the runtime does not know', () => {
    expect(previewCurrency('ZZZ')).toBeNull();
    expect(previewCurrency('US')).toBeNull();
  });

  it('formats timestamps and never leaks an ISO string or an invalid date', () => {
    const formatted = formatSettingsTimestamp('2026-11-21T17:02:05Z');

    expect(formatted).not.toContain('T17');
    expect(formatted).not.toBe('—');
    expect(formatSettingsTimestamp(null)).toBe('—');
    expect(formatSettingsTimestamp('not-a-date')).toBe('—');
  });
});

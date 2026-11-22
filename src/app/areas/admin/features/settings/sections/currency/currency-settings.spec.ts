/**
 * Tests for the currency section.
 *
 * Feature: `/admin/settings` → Moneda.
 * Contract: the active ISO 4217 code is shown with its display name, symbol and
 * fraction digits; changing it warns that stored amounts are not converted; the
 * PUT sends only the code.
 *
 * Approach: mount with a stubbed API and assert the preview, the warning copy,
 * the dirty signal and the request.
 */
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MessageService } from 'primeng/api';

import { SettingsApi } from '@services/settings/settings-api';
import { resolveUiResources } from '@shared/ui/testing/ui-test-resources';

import { CurrencySettingsSection } from './currency-settings';
import currencyHtml from './currency-settings.html?raw';
import buttonHtml from '@shared/ui/button/button.html?raw';
import emptyStateHtml from '@shared/ui/empty-state/empty-state.html?raw';
import fieldHtml from '@shared/ui/field/field.html?raw';
import sectionHtml from '@shared/ui/section/section.html?raw';
import selectHtml from '@shared/ui/select/select.html?raw';
import skeletonHtml from '@shared/ui/skeleton/skeleton.html?raw';

const COP = {
  code: 'COP',
  displayName: 'Peso colombiano',
  symbol: '$',
  defaultFractionDigits: 2,
};

describe('CurrencySettingsSection', () => {
  let fixture: ComponentFixture<CurrencySettingsSection>;
  let component: CurrencySettingsSection;
  let api: {
    getCurrency: ReturnType<typeof vi.fn>;
    updateCurrency: ReturnType<typeof vi.fn>;
  };
  let messages: { add: ReturnType<typeof vi.fn> };

  beforeAll(async () => {
    await resolveUiResources({
      'currency-settings.html': currencyHtml as unknown as string,
      'button.html': buttonHtml as unknown as string,
      'empty-state.html': emptyStateHtml as unknown as string,
      'field.html': fieldHtml as unknown as string,
      'section.html': sectionHtml as unknown as string,
      'select.html': selectHtml as unknown as string,
      'skeleton.html': skeletonHtml as unknown as string,
    });
  });

  beforeEach(() => {
    TestBed.resetTestingModule();
    api = {
      getCurrency: vi.fn(() => of({ ...COP })),
      updateCurrency: vi.fn((code: string) => of({ ...COP, code })),
    };
    messages = { add: vi.fn() };

    TestBed.configureTestingModule({
      imports: [CurrencySettingsSection],
      providers: [
        { provide: SettingsApi, useValue: api },
        { provide: MessageService, useValue: messages },
      ],
    });

    fixture = TestBed.createComponent(CurrencySettingsSection);
    component = fixture.componentInstance;
    fixture.detectChanges();
    fixture.detectChanges();
  });

  it('shows the active currency and its metadata', () => {
    expect(component.loading()).toBe(false);
    expect(component.current()).toEqual(COP);
    expect(component.form.controls.code.value).toBe('COP');
    expect(component.dirty()).toBe(false);
  });

  it('warns that changing currency does not convert stored amounts', () => {
    const note = (fixture.nativeElement as HTMLElement).querySelector('[role="note"]');

    expect(note).not.toBeNull();
    expect(note?.textContent).toContain('no convierte los importes guardados');
  });

  it('previews the selected code and becomes dirty', () => {
    component.form.controls.code.setValue('USD');

    expect(component.preview()?.code).toBe('USD');
    expect(component.preview()?.fractionDigits).toBe(2);
    expect(component.dirty()).toBe(true);
  });

  it('saves only the ISO code', () => {
    component.form.controls.code.setValue('usd');

    component.save();

    expect(api.updateCurrency).toHaveBeenCalledWith('USD');
    expect(component.current()?.code).toBe('USD');
    expect(component.dirty()).toBe(false);
    expect(messages.add).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'success' }),
    );
  });

  it('does not submit a malformed code', () => {
    component.form.controls.code.setValue('US');

    component.save();

    expect(api.updateCurrency).not.toHaveBeenCalled();
    expect(component.form.controls.code.touched).toBe(true);
  });

  it('surfaces a rejected currency change', () => {
    api.updateCurrency.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 400,
            error: { detail: 'Currency code must be a three-letter ISO 4217 code' },
          }),
      ),
    );

    component.form.controls.code.setValue('ZZZ');
    component.save();
    fixture.detectChanges();

    expect(component.saveError()).toBe(
      'Currency code must be a three-letter ISO 4217 code',
    );
  });
});

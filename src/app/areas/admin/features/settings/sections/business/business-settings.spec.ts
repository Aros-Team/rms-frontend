/**
 * Tests for the business-profile section.
 *
 * Feature: `/admin/settings` → Negocio.
 * Contract: `GET/PUT /v1/settings/business`; the form mirrors the backend
 * validation, maps a bean-validation field error next to the control, reports
 * prose problems in a banner, and emits dirty state for the page guard.
 *
 * Approach: mount the real component with stubbed `SettingsApi` and
 * `MessageService`; drive the form and assert requests and signals.
 */
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MessageService } from 'primeng/api';

import { SettingsApi } from '@services/settings/settings-api';
import { resolveUiResources } from '@shared/ui/testing/ui-test-resources';

import { BusinessSettings } from './business-settings';
import businessHtml from './business-settings.html?raw';
import buttonHtml from '@shared/ui/button/button.html?raw';
import emptyStateHtml from '@shared/ui/empty-state/empty-state.html?raw';
import inputHtml from '@shared/ui/input/input.html?raw';
import fieldHtml from '@shared/ui/field/field.html?raw';
import sectionHtml from '@shared/ui/section/section.html?raw';
import skeletonHtml from '@shared/ui/skeleton/skeleton.html?raw';

const PROFILE = {
  restaurantName: 'Rincón del Sabor',
  legalName: 'Rincón del Sabor S.A.S.',
  taxId: '900123456-7',
  address: 'Calle 12 #34-56',
  phone: '+57 606 1234567',
  email: 'contacto@rincondelsabor.co',
  timezone: 'America/Bogota',
  locale: 'es-CO',
};

describe('BusinessSettings', () => {
  let fixture: ComponentFixture<BusinessSettings>;
  let component: BusinessSettings;
  let api: {
    getBusiness: ReturnType<typeof vi.fn>;
    updateBusiness: ReturnType<typeof vi.fn>;
  };
  let messages: { add: ReturnType<typeof vi.fn> };

  beforeAll(async () => {
    await resolveUiResources({
      'business-settings.html': businessHtml as unknown as string,
      'button.html': buttonHtml as unknown as string,
      'empty-state.html': emptyStateHtml as unknown as string,
      'input.html': inputHtml as unknown as string,
      'field.html': fieldHtml as unknown as string,
      'section.html': sectionHtml as unknown as string,
      'skeleton.html': skeletonHtml as unknown as string,
    });
  });

  beforeEach(() => {
    TestBed.resetTestingModule();
    api = {
      getBusiness: vi.fn(() => of({ ...PROFILE })),
      updateBusiness: vi.fn((body: unknown) => of(body)),
    };
    messages = { add: vi.fn() };

    TestBed.configureTestingModule({
      imports: [BusinessSettings],
      providers: [
        { provide: SettingsApi, useValue: api },
        { provide: MessageService, useValue: messages },
      ],
    });

    fixture = TestBed.createComponent(BusinessSettings);
    component = fixture.componentInstance;
    fixture.detectChanges();
    fixture.detectChanges();
  });

  it('loads the profile into the form and starts clean', () => {
    expect(component.loading()).toBe(false);
    expect(component.form.getRawValue()).toEqual(PROFILE);
    expect(component.dirty()).toBe(false);
  });

  it('marks the section dirty and emits the change', () => {
    const emitted: boolean[] = [];
    component.dirtyChange.subscribe((value) => emitted.push(value));

    component.form.controls.restaurantName.setValue('Otro nombre');

    expect(component.dirty()).toBe(true);
    expect(emitted.at(-1)).toBe(true);
  });

  it('does not call the API when the form is invalid', () => {
    component.form.controls.restaurantName.setValue('');

    component.save();

    expect(api.updateBusiness).not.toHaveBeenCalled();
    expect(component.form.controls.restaurantName.touched).toBe(true);
  });

  it('saves the profile, updates the snapshot and shows a toast', () => {
    component.form.controls.phone.setValue('3001234567');
    const emitted: boolean[] = [];
    component.dirtyChange.subscribe((value) => emitted.push(value));

    component.save();

    expect(api.updateBusiness).toHaveBeenCalledWith(
      expect.objectContaining({ phone: '3001234567', timezone: 'America/Bogota' }),
    );
    expect(component.dirty()).toBe(false);
    expect(emitted.at(-1)).toBe(false);
    expect(messages.add).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'success' }),
    );
  });

  it('maps a bean-validation problem onto its field', () => {
    api.updateBusiness.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 400,
            error: { detail: 'restaurantName: El nombre del restaurante es obligatorio' },
          }),
      ),
    );

    component.form.controls.restaurantName.setValue('X');
    component.save();
    fixture.detectChanges();

    expect(component.controlError('restaurantName')).toBe('El nombre del restaurante es obligatorio');
    expect(component.saveError()).toBe('');
  });

  it('reports a prose problem in the banner', () => {
    api.updateBusiness.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 400,
            error: { detail: 'La zona horaria no es válida' },
          }),
      ),
    );

    component.form.controls.phone.setValue('1');
    component.save();
    fixture.detectChanges();

    expect(component.saveError()).toBe('La zona horaria no es válida');
    expect(messages.add).not.toHaveBeenCalled();
  });

  it('shows a retry state when the profile cannot be loaded', () => {
    TestBed.resetTestingModule();
    api.getBusiness.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 500, error: {} })),
    );
    TestBed.configureTestingModule({
      imports: [BusinessSettings],
      providers: [
        { provide: SettingsApi, useValue: api },
        { provide: MessageService, useValue: messages },
      ],
    });

    const failing = TestBed.createComponent(BusinessSettings);
    failing.detectChanges();

    expect(failing.componentInstance.loadError()).not.toBe('');
    expect(failing.componentInstance.loading()).toBe(false);
  });

  it('restores the persisted values on discard', () => {
    component.form.controls.restaurantName.setValue('Cambio');
    component.form.controls.address.setValue('Otra dirección');

    component.reset();

    expect(component.form.controls.restaurantName.value).toBe(PROFILE.restaurantName);
    expect(component.form.controls.address.value).toBe(PROFILE.address);
    expect(component.dirty()).toBe(false);
  });
});

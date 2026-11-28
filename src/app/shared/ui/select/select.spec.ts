/**
 * Tests for the RmsSelect primitive.
 *
 * Feature: labelled PrimeNG select/combobox wrapper.
 * Contract:
 *  - the visible label is the accessible name (aria-labelledby on the combobox)
 *  - filtering is automatic above 8 options and can be forced
 *  - the error state reaches the combobox (aria-invalid + describedby)
 *  - externally rendered message ids merge into describedby
 *
 * Approach: TestBed render, query the PrimeNG combobox slot, assert ARIA wiring.
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';

import { RmsSelect, type RmsSelectOption } from './select';
import { resolveUiResources } from '../testing/ui-test-resources';
import selectHtml from './select.html?raw';
import fieldHtml from '../field/field.html?raw';

const THREE_OPTIONS: RmsSelectOption[] = [
  { label: 'Salón', value: 1 },
  { label: 'Cocina', value: 2 },
  { label: 'Barra', value: 3 },
];

const NINE_OPTIONS: RmsSelectOption[] = Array.from({ length: 9 }, (_, index) => ({
  label: `Opción ${String(index + 1)}`,
  value: index + 1,
}));

@Component({
  standalone: true,
  imports: [RmsSelect, ReactiveFormsModule],
  template: `
    <form [formGroup]="form">
      <app-rms-select label="Área" [options]="options" formControlName="area" />
    </form>
  `,
})
class SelectHost {
  readonly form = new FormGroup({ area: new FormControl<number | null>(null) });
  options = THREE_OPTIONS;
}

describe('RmsSelect', () => {
  let fixture: ComponentFixture<RmsSelect>;
  let select: RmsSelect;

  beforeAll(async () => {
    await resolveUiResources({
      'select.html': selectHtml as unknown as string,
      'field.html': fieldHtml as unknown as string,
    });
  });

  beforeEach(async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({ imports: [RmsSelect] }).compileComponents();
    fixture = TestBed.createComponent(RmsSelect);
    select = fixture.componentInstance;
    select.label = 'Área';
    select.options = THREE_OPTIONS;
    select.hint = 'Área donde trabaja';
    fixture.detectChanges();
  });

  it('uses the visible label as the combobox accessible name', () => {
    const label = (fixture.nativeElement as HTMLElement).querySelector('label');
    const combobox = (fixture.nativeElement as HTMLElement).querySelector('[role="combobox"]');

    expect(label?.textContent.trim()).toBe('Área');
    expect(combobox?.getAttribute('aria-labelledby')).toBe(label?.id);
  });

  it('does not filter when there are 8 options or fewer', () => {
    expect(select.shouldFilter).toBe(false);
  });

  it('filters automatically above 8 options', () => {
    fixture.destroy();
    fixture = TestBed.createComponent(RmsSelect);
    select = fixture.componentInstance;
    select.label = 'Área';
    select.options = NINE_OPTIONS;
    fixture.detectChanges();

    expect(select.shouldFilter).toBe(true);
  });

  it('describes and invalidates the combobox when there is an error', () => {
    fixture.destroy();
    fixture = TestBed.createComponent(RmsSelect);
    select = fixture.componentInstance;
    select.label = 'Área';
    select.options = THREE_OPTIONS;
    select.error = 'Selecciona un área';
    fixture.detectChanges();
    const combobox = (fixture.nativeElement as HTMLElement).querySelector('[role="combobox"]');

    expect(combobox?.getAttribute('aria-invalid')).toBe('true');
    expect(combobox?.getAttribute('aria-describedby')).toBe(`${select.selectId}-error`);
  });

  it('paints the invalid state before a message exists', () => {
    fixture.destroy();
    fixture = TestBed.createComponent(RmsSelect);
    select = fixture.componentInstance;
    select.label = 'Área';
    select.options = THREE_OPTIONS;
    select.invalid = true;
    fixture.detectChanges();
    const combobox = (fixture.nativeElement as HTMLElement).querySelector('[role="combobox"]');

    expect(combobox?.getAttribute('aria-invalid')).toBe('true');
    const field = (fixture.nativeElement as HTMLElement).querySelector('.rms-field');
    expect(field?.classList.contains('rms-field--invalid')).toBe(true);
  });

  it('merges externally rendered message ids into describedby', () => {
    fixture.destroy();
    fixture = TestBed.createComponent(RmsSelect);
    select = fixture.componentInstance;
    select.label = 'Área';
    select.options = THREE_OPTIONS;
    select.hint = 'Área donde trabaja';
    select.describedByIds = 'error-area error-area-backend';
    fixture.detectChanges();
    const combobox = (fixture.nativeElement as HTMLElement).querySelector('[role="combobox"]');

    expect(combobox?.getAttribute('aria-describedby')).toBe(
      `${select.selectId}-hint error-area error-area-backend`,
    );
  });

  it('registers as a form control without colliding with the ancestor form', async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({ imports: [SelectHost] }).compileComponents();
    const hostFixture = TestBed.createComponent(SelectHost);
    hostFixture.detectChanges();

    expect(hostFixture.componentInstance.form.controls.area.value).toBeNull();
    expect(
      (hostFixture.nativeElement as HTMLElement).querySelector('app-rms-select'),
    ).not.toBeNull();
  });
});

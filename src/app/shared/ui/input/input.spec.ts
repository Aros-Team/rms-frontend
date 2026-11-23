/**
 * Tests for the RmsInput primitive.
 *
 * Feature: labelled text input with hint/error wiring and CVA support.
 * Contract:
 *  - label points at the input id; hint and error ids are described
 *  - writeValue renders the form value; typing updates the form control
 *  - error sets aria-invalid and the describedby includes the error
 *  - disabling the form disables the native input
 *
 * Approach: reactive-forms host, real DOM events, assert form state and the
 * accessible attributes on the native input.
 */
import { Component } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RmsInput } from './input';
import { resolveUiResources } from '../testing/ui-test-resources';
import inputHtml from './input.html?raw';
import fieldHtml from '../field/field.html?raw';

@Component({
  standalone: true,
  imports: [RmsInput, ReactiveFormsModule],
  template: `
    <form [formGroup]="form">
      <app-rms-input
        formControlName="name"
        label="Nombre"
        hint="Como aparece en la carta"
        [error]="error"
        [invalid]="invalid"
        [describedByIds]="describedByIds"
      />
    </form>
  `,
})
class InputHost {
  readonly form = new FormGroup({ name: new FormControl('Producto inicial') });
  error = '';
  invalid = false;
  describedByIds = '';
}

describe('RmsInput', () => {
  let fixture: ComponentFixture<InputHost>;
  let host: InputHost;
  let input: HTMLInputElement;

  beforeAll(async () => {
    await resolveUiResources({
      'input.html': inputHtml as unknown as string,
      'field.html': fieldHtml as unknown as string,
    });
  });

  beforeEach(async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({ imports: [InputHost] }).compileComponents();
    fixture = TestBed.createComponent(InputHost);
    host = fixture.componentInstance;
    fixture.detectChanges();
    input = (fixture.nativeElement as HTMLElement).querySelector('input.rms-input');
  });

  it('associates the label and describes the control with the hint', () => {
    const label = (fixture.nativeElement as HTMLElement).querySelector('label');

    expect(label?.htmlFor).toBe(input.id);
    expect(input.getAttribute('aria-describedby')).toBe(`${input.id}-hint`);
  });

  it('renders the form value and writes typed text back to the control', () => {
    expect(input.value).toBe('Producto inicial');

    input.value = 'Café americano';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(host.form.controls.name.value).toBe('Café americano');
  });

  it('exposes the error as aria-invalid and adds its id to describedby', () => {
    fixture.destroy();
    fixture = TestBed.createComponent(InputHost);
    host = fixture.componentInstance;
    host.error = 'El nombre es obligatorio';
    fixture.detectChanges();
    input = (fixture.nativeElement as HTMLElement).querySelector('input.rms-input');

    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe(
      `${input.id}-hint ${input.id}-error`,
    );
  });

  it('paints the invalid state before a message exists', () => {
    fixture.destroy();
    fixture = TestBed.createComponent(InputHost);
    host = fixture.componentInstance;
    host.invalid = true;
    fixture.detectChanges();
    input = (fixture.nativeElement as HTMLElement).querySelector('input.rms-input');

    expect(input.getAttribute('aria-invalid')).toBe('true');
    const field = (fixture.nativeElement as HTMLElement).querySelector('.rms-field');
    expect(field?.classList.contains('rms-field--invalid')).toBe(true);
  });

  it('merges externally rendered message ids into describedby', () => {
    fixture.destroy();
    fixture = TestBed.createComponent(InputHost);
    host = fixture.componentInstance;
    host.describedByIds = 'error-name error-name-backend';
    fixture.detectChanges();
    input = (fixture.nativeElement as HTMLElement).querySelector('input.rms-input');

    expect(input.getAttribute('aria-describedby')).toBe(
      `${input.id}-hint error-name error-name-backend`,
    );
  });

  it('disables the native input when the form control is disabled', () => {
    host.form.controls.name.disable();
    fixture.detectChanges();

    expect(input.disabled).toBe(true);
  });
});

/**
 * Tests for the RmsField primitive.
 *
 * Feature: label + control + hint + error wrapper.
 * Contract:
 *  - the label points at the consumer control id
 *  - hint and error get stable ids and `describedBy()` returns both
 *  - the error message is a live `role="alert"`
 *  - required renders a decorative marker, optional renders "Opcional"
 *
 * Approach: mount a host template that projects a native input and read the
 * field instance through a template reference.
 */
import { Component, ViewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { resolveUiResources } from '../testing/ui-test-resources';
import { RmsField } from './field';
import fieldHtml from './field.html?raw';

@Component({
  standalone: true,
  imports: [RmsField],
  template: `
    <app-rms-field
      #field
      label="Nombre"
      controlId="product-name"
      hint="Como aparece en la carta"
      error="El nombre es obligatorio"
      [required]="true"
      optionalLabel=""
    >
      <input id="product-name" />
    </app-rms-field>
  `,
})
class FieldHost {
  @ViewChild('field') field!: RmsField;
}

describe('RmsField', () => {
  let fixture: ComponentFixture<FieldHost>;
  let host: FieldHost;
  let element: HTMLElement;

  beforeAll(async () => {
    await resolveUiResources({ 'field.html': fieldHtml as unknown as string });
  });

  beforeEach(async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({ imports: [FieldHost] }).compileComponents();
    fixture = TestBed.createComponent(FieldHost);
    host = fixture.componentInstance;
    fixture.detectChanges();
    element = (fixture.nativeElement as HTMLElement).querySelector('.rms-field');
  });

  it('associates the label with the projected control', () => {
    const label = element.querySelector('label');

    expect(label?.htmlFor).toBe('product-name');
    expect(element.querySelector('#product-name')).not.toBeNull();
  });

  it('describes the control with the hint and the error ids', () => {
    expect(host.field.describedBy).toBe('product-name-hint product-name-error');
    expect(element.querySelector('#product-name-hint')?.textContent.trim()).toBe(
      'Como aparece en la carta',
    );
  });

  it('announces the error message immediately', () => {
    const error = element.querySelector('.rms-field__error');

    expect(error?.getAttribute('role')).toBe('alert');
    expect(error?.textContent.trim()).toBe('El nombre es obligatorio');
  });

  it('marks the group invalid and the required marker as decorative', () => {
    expect(element.classList.contains('rms-field--invalid')).toBe(true);
    expect(element.querySelector('.rms-field__required')?.getAttribute('aria-hidden')).toBe('true');
  });
});

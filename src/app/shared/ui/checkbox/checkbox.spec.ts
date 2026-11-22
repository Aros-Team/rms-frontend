/**
 * Tests for the RmsCheckbox primitive.
 *
 * Feature: native checkbox with a 20px visual box and description support.
 * Contract:
 *  - the wrapping label names the native checkbox
 *  - clicking toggles the form control (CVA)
 *  - the description id is referenced by aria-describedby
 *  - the visual box is decorative
 *
 * Approach: reactive-forms host, native click activation, DOM assertions.
 */
import { Component } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RmsCheckbox } from './checkbox';
import { resolveUiResources } from '../testing/ui-test-resources';
import checkboxHtml from './checkbox.html?raw';

@Component({
  standalone: true,
  imports: [RmsCheckbox, ReactiveFormsModule],
  template: `
    <form [formGroup]="form">
      <app-rms-checkbox
        formControlName="accepted"
        label="Acepto los términos"
        description="Puedes cambiar esto después"
      />
    </form>
  `,
})
class CheckboxHost {
  readonly form = new FormGroup({ accepted: new FormControl(false) });
}

describe('RmsCheckbox', () => {
  let fixture: ComponentFixture<CheckboxHost>;
  let host: CheckboxHost;
  let input: HTMLInputElement;

  beforeAll(async () => {
    await resolveUiResources({ 'checkbox.html': checkboxHtml as unknown as string });
  });

  beforeEach(async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({ imports: [CheckboxHost] }).compileComponents();
    fixture = TestBed.createComponent(CheckboxHost);
    host = fixture.componentInstance;
    fixture.detectChanges();
    input = (fixture.nativeElement as HTMLElement).querySelector('input[type="checkbox"]');
  });

  it('uses the wrapping label as the accessible name', () => {
    const label = (fixture.nativeElement as HTMLElement).querySelector('label.rms-checkbox');
    const labelText = label?.querySelector('.rms-checkbox__label');

    expect(label?.contains(input)).toBe(true);
    expect(labelText?.textContent.trim()).toBe('Acepto los términos');
  });

  it('toggles the form control when clicked', () => {
    input.click();
    fixture.detectChanges();

    expect(host.form.controls.accepted.value).toBe(true);
    expect(input.checked).toBe(true);
  });

  it('describes the checkbox with its description and hides the box', () => {
    expect(input.getAttribute('aria-describedby')).toBe(`${input.id}-description`);
    const box = (fixture.nativeElement as HTMLElement).querySelector('.rms-checkbox__box');
    expect(box?.getAttribute('aria-hidden')).toBe('true');
  });
});

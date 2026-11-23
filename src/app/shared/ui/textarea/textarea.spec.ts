/**
 * Tests for the RmsTextarea primitive.
 *
 * Feature: labelled multi-line input with hint, error and counter.
 * Contract:
 *  - label points at the textarea; typing updates the form control
 *  - the counter shows "length/max" and is hidden from assistive technology
 *  - error wiring matches RmsInput (aria-invalid + describedby)
 *  - externally rendered message ids merge into describedby
 *
 * Approach: reactive-forms host with fixed maxLength; DOM events and assertions.
 */
import { Component } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RmsTextarea } from './textarea';
import { resolveUiResources } from '../testing/ui-test-resources';
import textareaHtml from './textarea.html?raw';
import fieldHtml from '../field/field.html?raw';

@Component({
  standalone: true,
  imports: [RmsTextarea, ReactiveFormsModule],
  template: `
    <form [formGroup]="form">
      <app-rms-textarea
        formControlName="notes"
        label="Notas"
        [maxLength]="30"
        [showCount]="true"
        [error]="error"
        [invalid]="invalid"
        [describedByIds]="describedByIds"
      />
    </form>
  `,
})
class TextareaHost {
  readonly form = new FormGroup({ notes: new FormControl('Sin cebolla') });
  error = '';
  invalid = false;
  describedByIds = '';
}

describe('RmsTextarea', () => {
  let fixture: ComponentFixture<TextareaHost>;
  let host: TextareaHost;
  let textarea: HTMLTextAreaElement;

  beforeAll(async () => {
    await resolveUiResources({
      'textarea.html': textareaHtml as unknown as string,
      'field.html': fieldHtml as unknown as string,
    });
  });

  beforeEach(async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({ imports: [TextareaHost] }).compileComponents();
    fixture = TestBed.createComponent(TextareaHost);
    host = fixture.componentInstance;
    fixture.detectChanges();
    textarea = (fixture.nativeElement as HTMLElement).querySelector('textarea.rms-textarea');
  });

  it('associates the label and renders the initial value', () => {
    const label = (fixture.nativeElement as HTMLElement).querySelector('label');

    expect(label?.htmlFor).toBe(textarea.id);
    expect(textarea.value).toBe('Sin cebolla');
  });

  it('updates the form control on input and refreshes the counter', () => {
    textarea.value = 'Sin cebolla ni tomate';
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(host.form.controls.notes.value).toBe('Sin cebolla ni tomate');
    const counter = (fixture.nativeElement as HTMLElement).querySelector('.rms-textarea__count');
    expect(counter?.textContent.trim()).toBe('21/30');
    expect(counter?.getAttribute('aria-hidden')).toBe('true');
  });

  it('marks the control invalid and describes the error', () => {
    fixture.destroy();
    fixture = TestBed.createComponent(TextareaHost);
    host = fixture.componentInstance;
    host.error = 'Máximo 30 caracteres';
    fixture.detectChanges();
    textarea = (fixture.nativeElement as HTMLElement).querySelector('textarea.rms-textarea');

    expect(textarea.getAttribute('aria-invalid')).toBe('true');
    expect(textarea.getAttribute('aria-describedby')).toBe(`${textarea.id}-error`);
  });

  it('paints the invalid state before a message exists', () => {
    fixture.destroy();
    fixture = TestBed.createComponent(TextareaHost);
    host = fixture.componentInstance;
    host.invalid = true;
    fixture.detectChanges();
    textarea = (fixture.nativeElement as HTMLElement).querySelector('textarea.rms-textarea');

    expect(textarea.getAttribute('aria-invalid')).toBe('true');
    const field = (fixture.nativeElement as HTMLElement).querySelector('.rms-field');
    expect(field?.classList.contains('rms-field--invalid')).toBe(true);
  });

  it('merges externally rendered message ids into describedby', () => {
    fixture.destroy();
    fixture = TestBed.createComponent(TextareaHost);
    host = fixture.componentInstance;
    host.error = 'Máximo 30 caracteres';
    host.describedByIds = 'error-notes error-notes-backend';
    fixture.detectChanges();
    textarea = (fixture.nativeElement as HTMLElement).querySelector('textarea.rms-textarea');

    expect(textarea.getAttribute('aria-describedby')).toBe(
      `${textarea.id}-error error-notes error-notes-backend`,
    );
  });
});

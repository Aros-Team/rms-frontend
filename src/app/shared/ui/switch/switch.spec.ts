/**
 * Tests for the RmsSwitch primitive.
 *
 * Feature: on/off control with role="switch" and a visible state label.
 * Contract:
 *  - role is "switch" and aria-checked mirrors the value
 *  - clicking toggles the form control
 *  - the visible state word follows the state but is aria-hidden
 *  - a disabled switch does not toggle
 *
 * Approach: reactive-forms host, click activation, attribute assertions.
 */
import { Component } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RmsSwitch } from './switch';
import { resolveUiResources } from '../testing/ui-test-resources';
import switchHtml from './switch.html?raw';

@Component({
  standalone: true,
  imports: [RmsSwitch, ReactiveFormsModule],
  template: `
    <form [formGroup]="form">
      <app-rms-switch formControlName="inactive" label="Mostrar inactivos" />
    </form>
  `,
})
class SwitchHost {
  readonly form = new FormGroup({ inactive: new FormControl(false) });
}

describe('RmsSwitch', () => {
  let fixture: ComponentFixture<SwitchHost>;
  let host: SwitchHost;
  let button: HTMLButtonElement;

  beforeAll(async () => {
    await resolveUiResources({ 'switch.html': switchHtml as unknown as string });
  });

  beforeEach(async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({ imports: [SwitchHost] }).compileComponents();
    fixture = TestBed.createComponent(SwitchHost);
    host = fixture.componentInstance;
    fixture.detectChanges();
    button = (fixture.nativeElement as HTMLElement).querySelector('button.rms-switch');
  });

  it('exposes switch semantics with the initial state', () => {
    expect(button.getAttribute('role')).toBe('switch');
    expect(button.getAttribute('aria-checked')).toBe('false');
    expect(button.querySelector('.rms-switch__state')?.textContent.trim()).toBe('Desactivado');
  });

  it('toggles the form control and the visible state label', () => {
    button.click();
    fixture.detectChanges();

    expect(host.form.controls.inactive.value).toBe(true);
    expect(button.getAttribute('aria-checked')).toBe('true');
    expect(button.querySelector('.rms-switch__state')?.textContent.trim()).toBe('Activado');
  });

  it('keeps the state word out of the accessible name', () => {
    const state = button.querySelector('.rms-switch__state');

    expect(state?.getAttribute('aria-hidden')).toBe('true');
  });

  it('does not toggle when disabled', () => {
    host.form.controls.inactive.disable();
    fixture.detectChanges();

    button.click();
    fixture.detectChanges();

    expect(host.form.controls.inactive.value).toBe(false);
  });
});

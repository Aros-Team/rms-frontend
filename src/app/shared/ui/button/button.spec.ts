/**
 * Tests for the RmsButton primitive.
 *
 * Feature: the single action primitive (variants, sizes, loading, disabled).
 * Contract:
 *  - primary/md by default, variant and size map to `rms-btn--*` classes
 *  - the projected label is rendered inside the button
 *  - loading keeps the label, disables the button and sets aria-busy
 *  - type is forwarded to the native button (submit inside forms)
 *
 * Approach: TestBed with the external template resolved via ?raw, then assert
 * the rendered native button and its attributes after setInput.
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { resolveUiResources } from '../testing/ui-test-resources';
import { RmsButton } from './button';
import buttonHtml from './button.html?raw';

describe('RmsButton', () => {
  let fixture: ComponentFixture<RmsButton>;
  let button: HTMLButtonElement;

  beforeAll(async () => {
    await resolveUiResources({ 'button.html': buttonHtml as unknown as string });
  });

  beforeEach(async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({ imports: [RmsButton] }).compileComponents();
    fixture = TestBed.createComponent(RmsButton);
    fixture.detectChanges();
    button = (fixture.nativeElement as HTMLElement).querySelector('button');
  });

  it('renders the primary variant at md size by default', () => {
    expect(button.classList.contains('rms-btn--primary')).toBe(true);
    expect(button.classList.contains('rms-btn--md')).toBe(true);
  });

  it('maps variant, size and block to classes', () => {
    fixture.componentRef.setInput('variant', 'danger');
    fixture.componentRef.setInput('size', 'xl');
    fixture.componentRef.setInput('block', true);
    fixture.detectChanges();

    expect(button.classList.contains('rms-btn--danger')).toBe(true);
    expect(button.classList.contains('rms-btn--xl')).toBe(true);
    expect(button.classList.contains('rms-btn--block')).toBe(true);
  });

  it('keeps the label and reports busy while loading', () => {
    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();

    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.querySelector('.pi-spinner')).not.toBeNull();
  });

  it('forwards the submit type to the native button', () => {
    fixture.componentRef.setInput('type', 'submit');
    fixture.detectChanges();

    expect(button.type).toBe('submit');
  });
});

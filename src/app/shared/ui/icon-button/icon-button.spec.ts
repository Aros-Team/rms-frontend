/**
 * Tests for the RmsIconButton primitive.
 *
 * Feature: icon-only action with a mandatory accessible name.
 * Contract:
 *  - the native button carries `aria-label` from the required input
 *  - the glyph is decorative (aria-hidden) so it never becomes the name
 *  - disabled is forwarded to the native button
 *
 * Approach: TestBed render, assert the native button attributes.
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { resolveUiResources } from '../testing/ui-test-resources';
import { RmsIconButton } from './icon-button';
import iconButtonHtml from './icon-button.html?raw';

describe('RmsIconButton', () => {
  let fixture: ComponentFixture<RmsIconButton>;
  let button: HTMLButtonElement;

  beforeAll(async () => {
    await resolveUiResources({ 'icon-button.html': iconButtonHtml as unknown as string });
  });

  beforeEach(async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({ imports: [RmsIconButton] }).compileComponents();
    fixture = TestBed.createComponent(RmsIconButton);
    fixture.componentRef.setInput('icon', 'pi pi-pencil');
    fixture.componentRef.setInput('ariaLabel', 'Editar área');
    fixture.detectChanges();
    button = (fixture.nativeElement as HTMLElement).querySelector('button');
  });

  it('exposes the required accessible name on the button', () => {
    expect(button.getAttribute('aria-label')).toBe('Editar área');
  });

  it('hides the decorative glyph from assistive technology', () => {
    const glyph = button.querySelector('i.pi');

    expect(glyph?.getAttribute('aria-hidden')).toBe('true');
    expect(glyph?.classList.contains('pi-pencil')).toBe(true);
  });

  it('forwards the disabled state', () => {
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();

    expect(button.disabled).toBe(true);
  });
});

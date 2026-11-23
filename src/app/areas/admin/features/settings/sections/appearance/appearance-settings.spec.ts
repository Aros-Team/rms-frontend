/**
 * Tests for the appearance section.
 *
 * Feature: `/admin/settings` → Apariencia.
 * Contract: theme, font size and contrast delegate to the existing `Theme` and
 * `Accessibility` services (persisted locally) and the density control is
 * documented as unsupported.
 *
 * Approach: mount with the real services, call the handlers and assert the DOM
 * attributes the global stylesheet reads.
 */
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { Accessibility } from '@services/accessibility/accessibility';
import { resolveUiResources } from '@shared/ui/testing/ui-test-resources';

import { AppearanceSettingsSection } from './appearance-settings';
import appearanceHtml from './appearance-settings.html?raw';
import sectionHtml from '@shared/ui/section/section.html?raw';

describe('AppearanceSettingsSection', () => {
  let fixture: ComponentFixture<AppearanceSettingsSection>;
  let component: AppearanceSettingsSection;
  let accessibility: Accessibility;

  beforeAll(async () => {
    await resolveUiResources({
      'appearance-settings.html': appearanceHtml as unknown as string,
      'section.html': sectionHtml as unknown as string,
    });
  });

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
    document.documentElement.removeAttribute('data-contrast');
    document.documentElement.removeAttribute('data-font-size');

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [AppearanceSettingsSection],
      providers: [provideRouter([])],
    });

    fixture = TestBed.createComponent(AppearanceSettingsSection);
    component = fixture.componentInstance;
    accessibility = TestBed.inject(Accessibility);
    fixture.detectChanges();
  });

  it('applies and persists the theme', () => {
    component.setTheme('dark');

    expect(component.theme()).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem('theme')).toBe('dark');
  });

  it('delegates the font size to the accessibility service', () => {
    component.setFontSize('large');
    fixture.detectChanges();

    expect(component.fontSize()).toBe('large');
    expect(accessibility.fontSize()).toBe('large');
    expect(document.documentElement.getAttribute('data-font-size')).toBe('large');
  });

  it('delegates high contrast to the accessibility service', () => {
    component.setContrast('high');
    fixture.detectChanges();

    expect(component.contrastMode()).toBe('high');
    expect(document.documentElement.getAttribute('data-contrast')).toBe('high');
  });

  it('documents density as not configurable', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent;

    expect(text).toContain('La densidad de tablas todavía no es una preferencia configurable');
    expect(text).not.toContain('Cuenta y contraseña');
  });
});

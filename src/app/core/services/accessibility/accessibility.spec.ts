/**
 * Tests for the Accessibility service.
 *
 * Feature: User-selected font size and contrast preferences.
 * Contract: preferences round-trip through localStorage, are applied to
 *           <html> as attributes, and `normal` never pins an absolute root
 *           font size (that would override the browser/OS text scale).
 * Approach: Inject via TestBed, drive the setters, assert the attributes and
 *           the serialized storage payload.
 */
import { TestBed } from '@angular/core/testing';

import { Accessibility } from './accessibility';

describe('Accessibility', () => {
  let service: Accessibility;

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-font-size');
    document.documentElement.removeAttribute('data-contrast');
    document.documentElement.style.removeProperty('font-size');

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    service = TestBed.inject(Accessibility);
  });

  it('should default to normal font size and normal contrast', () => {
    expect(service.fontSize()).toBe('normal');
    expect(service.contrastMode()).toBe('normal');
  });

  it('should not pin an absolute root font size on "normal"', () => {
    service.setFontSize('normal');
    TestBed.tick();

    expect(document.documentElement.style.fontSize).toBe('');
    expect(document.documentElement.getAttribute('data-font-size')).toBe('normal');
  });

  it('should scale the root font size relatively for larger sizes', () => {
    service.setFontSize('large');
    TestBed.tick();

    // A percentage keeps the user's own base size as the reference point.
    expect(document.documentElement.style.fontSize).toBe('112.5%');
  });

  it('should toggle the high contrast attribute', () => {
    service.setContrastMode('high');
    TestBed.tick();
    expect(document.documentElement.getAttribute('data-contrast')).toBe('high');

    service.setContrastMode('normal');
    TestBed.tick();
    expect(document.documentElement.hasAttribute('data-contrast')).toBe(false);
  });

  it('should honour the OS "increase contrast" preference when nothing is stored', () => {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) =>
      ({ matches: query.includes('prefers-contrast'), media: query, addEventListener: () => undefined, removeEventListener: () => undefined }) as unknown as MediaQueryList);

    try {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({});
      const fresh = TestBed.inject(Accessibility);

      expect(fresh.contrastMode()).toBe('high');
      expect(localStorage.getItem('accessibility_settings')).toBeNull();
    } finally {
      window.matchMedia = original;
    }
  });

  it('should let an explicit preference win over the OS setting', () => {
    localStorage.setItem(
      'accessibility_settings',
      JSON.stringify({ fontSize: 'normal', contrastMode: 'normal' }),
    );

    const original = window.matchMedia;
    window.matchMedia = ((query: string) =>
      ({ matches: query.includes('prefers-contrast'), media: query, addEventListener: () => undefined, removeEventListener: () => undefined }) as unknown as MediaQueryList);

    try {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({});
      const fresh = TestBed.inject(Accessibility);

      expect(fresh.contrastMode()).toBe('normal');
    } finally {
      window.matchMedia = original;
    }
  });

  it('should persist settings', () => {
    service.setFontSize('extra-large');
    service.setContrastMode('high');

    const stored = JSON.parse(localStorage.getItem('accessibility_settings') ?? '{}') as {
      fontSize?: string;
      contrastMode?: string;
    };

    expect(stored.fontSize).toBe('extra-large');
    expect(stored.contrastMode).toBe('high');
  });
});

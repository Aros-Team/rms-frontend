/**
 * Tests for the Theme service.
 *
 * Feature: Manages light/dark theme via localStorage, document classes and
 *          the <meta name="color-scheme"> element.
 * Contract: get() returns 'light' by default; set() applies the CSS class,
 *           persists the value and keeps <meta name="color-scheme"> in sync;
 *           toggle() flips between light and dark; isDark() reflects state;
 *           both theme-color metas follow the active theme so the browser
 *           chrome does not stay on the OS preference after a manual toggle.
 * Approach: Inject service via TestBed, call set/get/toggle, assert exact
 *           values, document class changes and the meta content (the meta is
 *           what themes native browser UI, so a mismatch is a visible bug).
 */
import { TestBed } from '@angular/core/testing';

import { Theme } from './theme';

describe('Theme', () => {
  let service: Theme;
  let meta: HTMLMetaElement;
  let lightChrome: HTMLMetaElement;
  let darkChrome: HTMLMetaElement;

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('light', 'dark');

    // The real document declares these metas; mirror them for the test.
    document.head.querySelector('meta[name="color-scheme"]')?.remove();
    meta = document.createElement('meta');
    meta.setAttribute('name', 'color-scheme');
    meta.setAttribute('content', 'light dark');
    document.head.appendChild(meta);

    document.head.querySelector('meta[id="theme-color-light"]')?.remove();
    document.head.querySelector('meta[id="theme-color-dark"]')?.remove();
    lightChrome = document.createElement('meta');
    lightChrome.id = 'theme-color-light';
    lightChrome.setAttribute('name', 'theme-color');
    lightChrome.setAttribute('content', '#FDEFC7');
    lightChrome.setAttribute('media', '(prefers-color-scheme: light)');
    document.head.appendChild(lightChrome);
    darkChrome = document.createElement('meta');
    darkChrome.id = 'theme-color-dark';
    darkChrome.setAttribute('name', 'theme-color');
    darkChrome.setAttribute('content', '#0f172a');
    darkChrome.setAttribute('media', '(prefers-color-scheme: dark)');
    document.head.appendChild(darkChrome);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    service = TestBed.inject(Theme);
  });

  afterEach(() => {
    meta.remove();
    lightChrome.remove();
    darkChrome.remove();
  });

  it('should default to light theme', () => {
    expect(service.get()).toBe('light');
  });

  it('should set and get theme', () => {
    service.set('dark');
    expect(service.get()).toBe('dark');
    expect(service.isDark()).toBe(true);
  });

  it('should apply the dark class on the root element', () => {
    service.set('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    service.set('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('should keep the color-scheme meta in sync with the theme', () => {
    service.set('dark');
    expect(meta.getAttribute('content')).toBe('dark');

    service.set('light');
    expect(meta.getAttribute('content')).toBe('light');
  });

  it('should follow the active theme in both theme-color metas', () => {
    service.set('dark');

    for (const chrome of [lightChrome, darkChrome]) {
      expect(chrome.getAttribute('content')).toBe('#0f172a');
      expect(chrome.hasAttribute('media')).toBe(false);
    }

    service.set('light');

    for (const chrome of [lightChrome, darkChrome]) {
      expect(chrome.getAttribute('content')).toBe('#FDEFC7');
      expect(chrome.hasAttribute('media')).toBe(false);
    }
  });

  it('should update the theme-color metas after a toggle', () => {
    service.set('light');
    service.toggle();

    expect(lightChrome.getAttribute('content')).toBe('#0f172a');
    expect(darkChrome.getAttribute('content')).toBe('#0f172a');

    service.toggle();

    expect(lightChrome.getAttribute('content')).toBe('#FDEFC7');
    expect(darkChrome.getAttribute('content')).toBe('#FDEFC7');
  });

  it('should toggle theme', () => {
    service.set('light');
    service.toggle();
    expect(service.get()).toBe('dark');
    service.toggle();
    expect(service.get()).toBe('light');
  });

  it('should normalise unknown stored values to light', () => {
    localStorage.setItem('theme', 'sepia');
    expect(service.get()).toBe('light');
  });

  it('should apply the system theme without pinning an override on first run', () => {
    service.setDefault();

    expect(localStorage.getItem('theme')).toBeNull();
  });

  it('should drop the override when toggling back to the system preference', () => {
    // jsdom reports no dark preference, so the system theme is "light".
    service.set('light');
    service.setDefault();
    service.set('dark');
    expect(localStorage.getItem('theme')).toBe('dark');

    service.toggle();
    expect(service.get()).toBe('light');
    expect(localStorage.getItem('theme')).toBeNull();
  });
});

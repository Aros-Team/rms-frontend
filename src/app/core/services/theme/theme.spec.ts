/**
 * Tests for the Theme service.
 *
 * Feature: Manages light/dark theme via localStorage and document classes.
 * Contract: get() returns 'light' by default; set() applies CSS class and persists;
 * toggle() flips between light and dark; isDark() reflects current state.
 * Approach: Inject service via TestBed, call set/get/toggle, assert exact values
 * and document class changes.
 */
import { TestBed } from '@angular/core/testing';

import { Theme } from './theme';

describe('Theme', () => {
  let service: Theme;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Theme);
  });

  it('should default to light theme', () => {
    expect(service.get()).toBe('light');
  });

  it('should set and get theme', () => {
    service.set('dark');
    expect(service.get()).toBe('dark');
    expect(service.isDark()).toBe(true);
  });

  it('should toggle theme', () => {
    service.set('light');
    service.toggle();
    expect(service.get()).toBe('dark');
    service.toggle();
    expect(service.get()).toBe('light');
  });
});

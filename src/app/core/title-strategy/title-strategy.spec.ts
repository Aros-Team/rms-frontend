/**
 * Tests for AppTitleStrategy.
 *
 * Feature: Per-route document titles.
 * Contract: the title resolved by the router becomes "<title> | RMS", and the
 *           bare app name is used when a route has no title.
 * Approach: Stub `buildTitle` (the router's own resolution, which reads a
 *           private Symbol off the route snapshot) and assert on the real
 *           Title service, which is the part this class owns.
 */
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot } from '@angular/router';
import { vi } from 'vitest';

import { AppTitleStrategy } from './title-strategy';

describe('AppTitleStrategy', () => {
  let strategy: AppTitleStrategy;
  let titleService: Title;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [AppTitleStrategy] });
    strategy = TestBed.inject(AppTitleStrategy);
    titleService = TestBed.inject(Title);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should suffix the route title with the app name', () => {
    vi.spyOn(strategy, 'buildTitle').mockReturnValue('Productos');

    strategy.updateTitle({} as RouterStateSnapshot);

    expect(titleService.getTitle()).toBe('Productos | RMS');
  });

  it('should fall back to the bare app name without a route title', () => {
    vi.spyOn(strategy, 'buildTitle').mockReturnValue(undefined);

    strategy.updateTitle({} as RouterStateSnapshot);

    expect(titleService.getTitle()).toBe('RMS');
  });
});

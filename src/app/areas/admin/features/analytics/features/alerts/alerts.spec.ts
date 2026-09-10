/**
 * Tests for the Alerts analytics page.
 *
 * Feature: Deprecated analytics page that displays a "no longer available" warning.
 * Contract: Renders a p-message warning with text "ya no está disponible".
 * Approach: Mount component via TestBed, locate the p-message element,
 * assert its rendered text attribute matches the expected warning.
 */
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ɵresolveComponentResources as resolveComponentResources } from '@angular/core';
import { beforeAll, describe, expect, it } from 'vitest';

import { Alerts } from './alerts';
import alertsHtml from './alerts.html?raw';

describe('Alerts', () => {
  beforeAll(async () => {
    await resolveComponentResources((url: string) => {
      if (url.endsWith('alerts.html')) return Promise.resolve(alertsHtml as unknown as string);
      return Promise.resolve('');
    });
  });

  async function setup(): Promise<ComponentFixture<Alerts>> {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [Alerts],
    }).compileComponents();
    const fixture = TestBed.createComponent(Alerts);
    fixture.detectChanges();
    return fixture;
  }

  function getRoot(fixture: ComponentFixture<Alerts>): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  it('renders the unavailable message in a p-message element', async () => {
    const fixture = await setup();
    const messageEl = getRoot(fixture).querySelector('p-message');
    expect(messageEl).not.toBeNull();
    expect(messageEl?.getAttribute('text')).toContain('ya no está disponible');
  });
});

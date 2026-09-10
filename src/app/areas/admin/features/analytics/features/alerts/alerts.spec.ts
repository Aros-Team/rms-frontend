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

  it('renders the unavailable message', async () => {
    const fixture = await setup();
    const text = getRoot(fixture).textContent;
    expect(text).toContain('ya no está disponible');
  });
});

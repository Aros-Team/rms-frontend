import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ɵresolveComponentResources as resolveComponentResources } from '@angular/core';
import { beforeAll, describe, expect, it } from 'vitest';

import { Cohort } from './cohort';
import cohortHtml from './cohort.html?raw';

describe('Cohort', () => {
  beforeAll(async () => {
    await resolveComponentResources((url: string) => {
      if (url.endsWith('cohort.html')) {
        return Promise.resolve(cohortHtml as unknown as string);
      }
      return Promise.resolve('');
    });
  });

  async function setup(): Promise<ComponentFixture<Cohort>> {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [Cohort],
    }).compileComponents();
    const fixture = TestBed.createComponent(Cohort);
    fixture.detectChanges();
    return fixture;
  }

  function getRoot(fixture: ComponentFixture<Cohort>): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  it('renders the unavailable message', async () => {
    const fixture = await setup();
    const text = getRoot(fixture).textContent;
    expect(text).toContain('ya no está disponible');
  });
});

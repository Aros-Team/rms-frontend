/**
 * Tests for the RmsPageHeader primitive.
 *
 * Feature: the single H1 of a route with subtitle and actions slots.
 * Contract:
 *  - exactly one H1 with the title
 *  - the subtitle is supporting prose
 *  - the back link emits `back` and appears only when labelled
 *
 * Approach: mount a host with projected actions, click the back button and
 * assert the heading structure.
 */
import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RmsPageHeader } from './page-header';
import { queryElement, resolveUiResources } from '../testing/ui-test-resources';
import pageHeaderHtml from './page-header.html?raw';
import buttonHtml from '../button/button.html?raw';

@Component({
  standalone: true,
  imports: [RmsPageHeader],
  template: `
    <app-rms-page-header
      title="Pedidos"
      subtitle="Pedidos del día"
      backLabel="Volver a pedidos"
      (back)="backClicks = backClicks + 1"
    />
  `,
})
class PageHeaderHost {
  backClicks = 0;
}

describe('RmsPageHeader', () => {
  let fixture: ComponentFixture<PageHeaderHost>;
  let host: PageHeaderHost;

  beforeAll(async () => {
    await resolveUiResources({
      'page-header.html': pageHeaderHtml as unknown as string,
      'button.html': buttonHtml as unknown as string,
    });
  });

  beforeEach(async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({ imports: [PageHeaderHost] }).compileComponents();
    fixture = TestBed.createComponent(PageHeaderHost);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders exactly one H1 with the page title', () => {
    const headings = (fixture.nativeElement as HTMLElement).querySelectorAll('h1');

    expect(headings).toHaveLength(1);
    expect(headings[0].textContent.trim()).toBe('Pedidos');
  });

  it('renders the subtitle', () => {
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.rms-page-header__subtitle')?.textContent.trim(),
    ).toBe('Pedidos del día');
  });

  it('emits back from the back link', () => {
    queryElement(
      fixture.nativeElement as HTMLElement,
      '.rms-page-header__back button',
    ).click();

    expect(host.backClicks).toBe(1);
  });
});

/**
 * Tests for the analytics navigation.
 *
 * Feature: five sections in one nav.
 * Contract: one labelled nav, five links in order, each with an icon and a name.
 * Approach: mount with a router and assert DOM.
 */
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AnalyticsNav } from './analytics-nav';
import navHtmlRaw from './analytics-nav.html?raw';
import { resolveTemplates } from '../../testing/analytics-testing';

const navHtml = navHtmlRaw as string;

describe('AnalyticsNav', () => {
  beforeAll(async () => {
    await resolveTemplates({ 'analytics-nav.html': navHtml });
  });

  let fixture: ComponentFixture<AnalyticsNav>;

  beforeEach(async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [AnalyticsNav],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(AnalyticsNav);
    fixture.detectChanges();
  });

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  it('labels the nav for assistive tech', () => {
    expect(root().querySelector('nav')?.getAttribute('aria-label')).toBe('Secciones de analítica');
  });

  it('renders five tabs in workspace order', () => {
    const labels = Array.from(root().querySelectorAll('nav a .nav-label')).map((el) =>
      el.textContent.trim(),
    );
    expect(labels).toEqual(['Rentabilidad', 'Tu carta', 'Operación', 'Cohortes', 'Alertas']);
  });

  it('links every tab to its route with an icon', () => {
    const links = Array.from(root().querySelectorAll<HTMLAnchorElement>('nav a'));
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/admin/analytics/prime-cost',
      '/admin/analytics/menu-engineering',
      '/admin/analytics/operations',
      '/admin/analytics/cohort',
      '/admin/analytics/alerts',
    ]);
    expect(links.every((link) => link.querySelector('i.pi') !== null)).toBe(true);
  });
});

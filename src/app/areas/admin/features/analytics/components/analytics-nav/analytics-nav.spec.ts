/**
 * Tests for the AnalyticsNav component.
 *
 * Feature: Renders a two-tab navigation bar for analytics sections (Rentabilidad, Tu carta).
 * Contract: Nav has aria-label, two links with correct labels, hrefs, and icons.
 * Approach: Mount component via TestBed with router, query nav elements,
 * assert exact text, hrefs, aria-labels, and icon classes.
 */
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ɵresolveComponentResources as resolveComponentResources } from '@angular/core';
import { provideRouter } from '@angular/router';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AnalyticsNav } from './analytics-nav';
import analyticsNavHtml from './analytics-nav.html?raw';

describe('AnalyticsNav', () => {
  beforeAll(async () => {
    await resolveComponentResources((url: string) => {
      if (url.endsWith('analytics-nav.html')) {
        return Promise.resolve(analyticsNavHtml as unknown as string);
      }
      return Promise.resolve('');
    });
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

  function getRoot(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  it('renders the navigation with the analytics sections aria label', () => {
    const nav = getRoot().querySelector('nav');
    expect(nav).not.toBeNull();
    expect(nav?.getAttribute('aria-label')).toBe('Secciones de estadísticas');
  });

  it('renders exactly two tab links', () => {
    const links = getRoot().querySelectorAll('nav a');
    expect(links).toHaveLength(2);
  });

  it('renders the two Spanish labels in order: Rentabilidad, Tu carta', () => {
    const labels = Array.from(getRoot().querySelectorAll('nav a .nav-label')).map(
      (el) => el.textContent.trim(),
    );
    expect(labels).toEqual(['Rentabilidad', 'Tu carta']);
  });

  it('points each tab to its /admin/analytics/<module> route via href', () => {
    const hrefs = Array.from(getRoot().querySelectorAll('nav a')).map((el) =>
      el.getAttribute('href'),
    );
    expect(hrefs).toEqual([
      '/admin/analytics/prime-cost',
      '/admin/analytics/menu-engineering',
    ]);
  });

  it('exposes the Spanish label on each link as aria-label', () => {
    const ariaLabels = Array.from(getRoot().querySelectorAll('nav a')).map((el) =>
      el.getAttribute('aria-label'),
    );
    expect(ariaLabels).toEqual(['Rentabilidad', 'Tu carta']);
  });

  it('renders the icon for each tab', () => {
    const icons = Array.from(getRoot().querySelectorAll('nav a > i'));
    const classes = icons.map((el) => el.getAttribute('class') ?? '');
    expect(classes).toEqual([
      'pi pi-chart-line',
      'pi pi-th-large',
    ]);
  });
});

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
    expect(nav).toBeTruthy();
    expect(nav?.getAttribute('aria-label')).toBe('Secciones de estadísticas');
  });

  it('renders exactly five tab links', () => {
    const links = getRoot().querySelectorAll('nav a');
    expect(links).toHaveLength(5);
  });

  it('renders the five Spanish labels in order: Costo primo, Carta, Operaciones, Cohorte, Alertas', () => {
    const labels = Array.from(getRoot().querySelectorAll('nav a .nav-label')).map(
      (el) => el.textContent.trim(),
    );
    expect(labels).toEqual(['Costo primo', 'Carta', 'Operaciones', 'Cohorte', 'Alertas']);
  });

  it('points each tab to its /admin/analytics/<module> route via href', () => {
    const hrefs = Array.from(getRoot().querySelectorAll('nav a')).map((el) =>
      el.getAttribute('href'),
    );
    expect(hrefs).toEqual([
      '/admin/analytics/prime-cost',
      '/admin/analytics/menu-engineering',
      '/admin/analytics/operations',
      '/admin/analytics/cohort',
      '/admin/analytics/alerts',
    ]);
  });

  it('exposes the Spanish label on each link as aria-label', () => {
    const ariaLabels = Array.from(getRoot().querySelectorAll('nav a')).map((el) =>
      el.getAttribute('aria-label'),
    );
    expect(ariaLabels).toEqual([
      'Costo primo',
      'Carta',
      'Operaciones',
      'Cohorte',
      'Alertas',
    ]);
  });

  it('renders the icon for each tab', () => {
    const icons = Array.from(getRoot().querySelectorAll('nav a > i'));
    const classes = icons.map((el) => el.getAttribute('class') ?? '');
    expect(classes).toEqual([
      'pi pi-chart-line',
      'pi pi-th-large',
      'pi pi-stopwatch',
      'pi pi-users',
      'pi pi-bell',
    ]);
  });
});
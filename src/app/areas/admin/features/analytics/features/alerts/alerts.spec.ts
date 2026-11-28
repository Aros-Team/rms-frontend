/**
 * Tests for the Alerts section.
 *
 * Feature: paged list, severity, filters and optimistic mark-read.
 * Contract: a failed mark-read rolls the row back to OPEN and shows an inline
 * error; filters reset to the first page; an empty page shows the empty state.
 * Approach: stub the Analytics service with observables, including a Subject to
 * hold the mark-read request open.
 */
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Subject, of, type Observable } from 'rxjs';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { Analytics } from '@app/core/services/analytics/analytics';
import { AnalyticsPeriodState } from '@app/core/services/analytics/analytics-period-state';
import type { AlertsPage, AlertsQuery } from '@app/shared/models/dto/analytics/system-alert';

import { Alerts } from './alerts';
import alertsHtmlRaw from './alerts.html?raw';
import { makeAlert, makeAlertsPage, resolveTemplates } from '../../testing/analytics-testing';

const alertsHtml = alertsHtmlRaw as string;

interface AlertsApiStub {
  getAlerts: (query?: AlertsQuery) => Observable<AlertsPage>;
  markAlertRead: (id: number) => Observable<null>;
}

describe('Alerts', () => {
  beforeAll(async () => {
    await resolveTemplates({ 'alerts.html': alertsHtml });
  });

  async function setup(api: AlertsApiStub): Promise<ComponentFixture<Alerts>> {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [Alerts],
      providers: [{ provide: Analytics, useValue: api }, AnalyticsPeriodState],
    }).compileComponents();
    const fixture = TestBed.createComponent(Alerts);
    fixture.detectChanges();
    return fixture;
  }

  it('loads the first page with the period filters and default paging', async () => {
    const getAlerts = vi.fn((_query?: AlertsQuery) => {
      void _query;
      return of(makeAlertsPage());
    });
    const fixture = await setup({ getAlerts, markAlertRead: () => of(null) });
    expect(getAlerts).toHaveBeenCalledTimes(1);
    const query = getAlerts.mock.calls[0]?.[0];
    expect(query?.limit).toBe(25);
    expect(query?.offset).toBe(0);
    expect(query?.status).toBeUndefined();
    expect(fixture.componentInstance.items()).toHaveLength(2);
  });

  it('renders the alert rows with Spanish copy and a message', async () => {
    const fixture = await setup({
      getAlerts: () => of(makeAlertsPage()),
      markAlertRead: () => of(null),
    });
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(root.textContent).toContain('El costo de alimentos está 6,8% por encima');
    expect(fixture.componentInstance.severityLabel('RED')).toBe('Roja');
  });

  it('resets paging and reloads when a filter changes', async () => {
    const getAlerts = vi.fn((_query?: AlertsQuery) => {
      void _query;
      return of(makeAlertsPage());
    });
    const fixture = await setup({ getAlerts, markAlertRead: () => of(null) });
    fixture.componentInstance.onStatusChange('OPEN');
    fixture.detectChanges();
    expect(fixture.componentInstance.offset()).toBe(0);
    expect(getAlerts).toHaveBeenCalledTimes(2);
    expect(getAlerts.mock.calls[1]?.[0]?.status).toBe('OPEN');
  });

  it('marks a row as read optimistically', async () => {
    const pending = new Subject<null>();
    const fixture = await setup({
      getAlerts: () => of(makeAlertsPage()),
      markAlertRead: () => pending.asObservable(),
    });
    const alert = fixture.componentInstance.items()[0];
    fixture.componentInstance.markRead(alert);
    expect(fixture.componentInstance.items()[0]?.status).toBe('READ');
    expect(fixture.componentInstance.marking()).toBe(alert.id);
  });

  it('rolls the optimistic update back when the request fails', async () => {
    const pending = new Subject<null>();
    const fixture = await setup({
      getAlerts: () => of(makeAlertsPage()),
      markAlertRead: () => pending.asObservable(),
    });
    const alert = makeAlert();
    fixture.componentInstance.markRead(alert);
    pending.error(new Error('network'));
    expect(fixture.componentInstance.items()[0]?.status).toBe('OPEN');
    expect(fixture.componentInstance.actionError()).toContain('restauró el estado');
    expect(fixture.componentInstance.marking()).toBeNull();
  });

  it('shows the empty state when the page has no alerts', async () => {
    const empty: AlertsPage = { items: [], page: { limit: 25, offset: 0, total: 0 } };
    const fixture = await setup({ getAlerts: () => of(empty), markAlertRead: () => of(null) });
    expect(fixture.componentInstance.isEmpty()).toBe(true);
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('app-rms-empty-state')).not.toBeNull();
  });

  it('advances the page only when there is a next page', async () => {
    const page = makeAlertsPage({ page: { limit: 25, offset: 0, total: 60 } });
    const getAlerts = vi.fn((_query?: AlertsQuery) => {
      void _query;
      return of(page);
    });
    const fixture = await setup({ getAlerts, markAlertRead: () => of(null) });
    fixture.componentInstance.nextPage();
    fixture.detectChanges();
    expect(fixture.componentInstance.offset()).toBe(25);
    expect(getAlerts.mock.calls[1]?.[0]?.offset).toBe(25);
  });

  it('exports the loaded page as CSV', async () => {
    const fixture = await setup({
      getAlerts: () => of(makeAlertsPage()),
      markAlertRead: () => of(null),
    });
    const csv = fixture.componentInstance.buildCsv();
    expect(csv).toContain('FOOD_COST_DEVIATION');
    expect(csv.split('\r\n')).toHaveLength(3);
  });

  it('shows the page title and exposes both header actions', async () => {
    const fixture = await setup({
      getAlerts: () => of(makeAlertsPage()),
      markAlertRead: () => of(null),
    });
    const root = fixture.nativeElement as HTMLElement;
    const heading = root.querySelector('h1');
    expect(heading?.textContent.trim()).toBe('Alertas de variación');
    expect(heading?.classList.contains('sr-only')).toBe(false);
    expect(root.textContent).toContain('Actualizar');
    expect(root.textContent).toContain('Exportar CSV');
  });
});

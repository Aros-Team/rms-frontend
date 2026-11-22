/**
 * Tests for the settings HTTP boundary.
 *
 * Feature: typed settings, legacy configuration groups and admin user access.
 * Contract:
 *  - every method hits the documented relative URL and HTTP verb;
 *  - `PUT /settings/currency` sends only the ISO code;
 *  - entry keys are URL-encoded (dot or slash never break the path);
 *  - the bulk upsert keeps the legacy `PUT /config` semantics;
 *  - role, areas and status use the dedicated PATCH sub-resources.
 *
 * Approach: HttpTestingController; assert method, URL and body for each call.
 */
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { SettingsApi } from './settings-api';

describe('SettingsApi', () => {
  let api: SettingsApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), SettingsApi],
    });
    api = TestBed.inject(SettingsApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('loads and replaces the business profile', () => {
    api.getBusiness().subscribe();
    http.expectOne({ method: 'GET', url: 'v1/settings/business' }).flush({});

    const profile = {
      restaurantName: 'RMS',
      legalName: '',
      taxId: '',
      address: '',
      phone: '',
      email: '',
      timezone: 'America/Bogota',
      locale: 'es-CO',
    };
    api.updateBusiness(profile).subscribe();
    const put = http.expectOne({ method: 'PUT', url: 'v1/settings/business' });
    expect(put.request.body).toEqual(profile);
    put.flush(profile);
  });

  it('changes the currency with the ISO code only', () => {
    api.updateCurrency('USD').subscribe();
    const request = http.expectOne({ method: 'PUT', url: 'v1/settings/currency' });

    expect(request.request.body).toEqual({ code: 'USD' });
    request.flush({ code: 'USD', displayName: 'US Dollar', symbol: '$', defaultFractionDigits: 2 });
  });

  it('loads and replaces labor settings', () => {
    api.getLabor().subscribe();
    http.expectOne({ method: 'GET', url: 'v1/settings/labor' }).flush({});

    api
      .updateLabor({
        mode: 'REAL',
        standardHourlyRate: 12000,
        defaultExpectedHoursPerMonth: 160,
      })
      .subscribe();
    const request = http.expectOne({ method: 'PUT', url: 'v1/settings/labor' });
    expect(request.request.body).toEqual({
      mode: 'REAL',
      standardHourlyRate: 12000,
      defaultExpectedHoursPerMonth: 160,
    });
    request.flush({});
  });

  it('loads and replaces notifications', () => {
    api.getNotifications().subscribe();
    http.expectOne({ method: 'GET', url: 'v1/settings/notifications' }).flush({});

    const settings = {
      kitchenSoundEnabled: true,
      kitchenHapticsEnabled: true,
      lowStockAlertsEnabled: false,
      orderAlertsEnabled: true,
      dailySummaryEnabled: false,
    };
    api.updateNotifications(settings).subscribe();
    const request = http.expectOne({ method: 'PUT', url: 'v1/settings/notifications' });
    expect(request.request.body).toEqual(settings);
    request.flush(settings);
  });

  it('lists configuration groups', () => {
    api.getConfigGroups().subscribe();
    const request = http.expectOne({ method: 'GET', url: 'v1/config' });

    expect(request.request.body).toBeNull();
    request.flush([]);
  });

  it('creates, renames and deletes configuration groups', () => {
    api.createGroup({ name: 'Nuevo', description: '', sortOrder: 4 }).subscribe();
    const post = http.expectOne({ method: 'POST', url: 'v1/config/groups' });
    expect(post.request.body).toEqual({ name: 'Nuevo', description: '', sortOrder: 4 });
    post.flush({ id: 9, name: 'Nuevo', description: '', sortOrder: 4, entries: [] });

    api.updateGroup(9, { name: 'Renombrado' }).subscribe();
    const put = http.expectOne({ method: 'PUT', url: 'v1/config/groups/9' });
    expect(put.request.body).toEqual({ name: 'Renombrado' });
    put.flush({ id: 9, name: 'Renombrado', description: '', sortOrder: 4, entries: [] });

    api.deleteGroup(9).subscribe();
    http.expectOne({ method: 'DELETE', url: 'v1/config/groups/9' }).flush(null);
  });

  it('encodes an entry key when patching and deleting', () => {
    api.updateEntry('labor.cost_mode', { value: 'REAL' }).subscribe();
    const patch = http.expectOne({ method: 'PATCH', url: 'v1/config/labor.cost_mode' });
    expect(patch.request.body).toEqual({ value: 'REAL' });
    patch.flush({});

    api.deleteEntry('labor/cost mode').subscribe();
    http.expectOne({ method: 'DELETE', url: 'v1/config/labor%2Fcost%20mode' }).flush(null);
  });

  it('keeps the legacy bulk upsert', () => {
    const entries = [{ key: 'new_key', value: '1', groupId: 1, sortOrder: 3 }];
    api.upsertEntries(entries).subscribe();
    const request = http.expectOne({ method: 'PUT', url: 'v1/config' });

    expect(request.request.body).toEqual(entries);
    request.flush([]);
  });

  it('lists users and patches role, areas and status separately', () => {
    api.listUsers().subscribe();
    http.expectOne({ method: 'GET', url: 'v1/users' }).flush([]);

    api.updateUserRole(1001, 'ADMIN').subscribe();
    const role = http.expectOne({ method: 'PATCH', url: 'v1/users/1001/role' });
    expect(role.request.body).toEqual({ role: 'ADMIN' });
    role.flush({});

    api.updateUserAreas(1001, [2, 3]).subscribe();
    const areas = http.expectOne({ method: 'PATCH', url: 'v1/users/1001/areas' });
    expect(areas.request.body).toEqual({ areaIds: [2, 3] });
    areas.flush({});

    api.updateUserStatus(1001, 'INACTIVE').subscribe();
    const status = http.expectOne({ method: 'PATCH', url: 'v1/users/1001/status' });
    expect(status.request.body).toEqual({ status: 'INACTIVE' });
    status.flush({});
  });
});

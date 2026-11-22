import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import type {
  BusinessProfile,
  ConfigEntry,
  ConfigEntryRequest,
  ConfigEntryUpdateRequest,
  ConfigGroup,
  ConfigGroupRequest,
  CurrencySettings,
  LaborSettings,
  LaborSettingsRequest,
  NotificationSettings,
  OpeningHours,
  UserSummary,
  UserRoleValue,
} from '@models/dto/settings/settings';

/**
 * HTTP boundary for the settings workspace.
 *
 * - typed settings: `/v1/settings/{business|currency|labor|notifications}`
 * - legacy configuration groups: `/v1/config` (list, group CRUD, entry
 *   patch/delete and the safe bulk upsert)
 * - admin user list and access changes: `/v1/users`
 *
 * URLs stay relative (`v1/...`) because `urlInterceptor` prefixes the API base.
 * The response envelope is unwrapped by `envelopeInterceptor`, so every method
 * receives the inner payload. Failures propagate as RFC 7807 problem responses.
 */
@Injectable({
  providedIn: 'root',
})
export class SettingsApi {
  private readonly http = inject(HttpClient);

  getBusiness(): Observable<BusinessProfile> {
    return this.http.get<BusinessProfile>('v1/settings/business');
  }

  updateBusiness(profile: BusinessProfile): Observable<BusinessProfile> {
    return this.http.put<BusinessProfile>('v1/settings/business', profile);
  }

  getCurrency(): Observable<CurrencySettings> {
    return this.http.get<CurrencySettings>('v1/settings/currency');
  }

  updateCurrency(code: string): Observable<CurrencySettings> {
    return this.http.put<CurrencySettings>('v1/settings/currency', { code });
  }

  getLabor(): Observable<LaborSettings> {
    return this.http.get<LaborSettings>('v1/settings/labor');
  }

  updateLabor(settings: LaborSettingsRequest): Observable<LaborSettings> {
    return this.http.put<LaborSettings>('v1/settings/labor', settings);
  }

  getOpeningHours(): Observable<OpeningHours> {
    return this.http.get<OpeningHours>('v1/settings/opening-hours');
  }

  updateOpeningHours(hours: OpeningHours): Observable<OpeningHours> {
    return this.http.put<OpeningHours>('v1/settings/opening-hours', hours);
  }

  getNotifications(): Observable<NotificationSettings> {
    return this.http.get<NotificationSettings>('v1/settings/notifications');
  }

  updateNotifications(settings: NotificationSettings): Observable<NotificationSettings> {
    return this.http.put<NotificationSettings>('v1/settings/notifications', settings);
  }

  /** Groups with their entries, sorted by `sortOrder`. */
  getConfigGroups(): Observable<ConfigGroup[]> {
    return this.http.get<ConfigGroup[]>('v1/config');
  }

  createGroup(group: ConfigGroupRequest): Observable<ConfigGroup> {
    return this.http.post<ConfigGroup>('v1/config/groups', group);
  }

  updateGroup(id: number, group: ConfigGroupRequest): Observable<ConfigGroup> {
    return this.http.put<ConfigGroup>(`v1/config/groups/${String(id)}`, group);
  }

  deleteGroup(id: number): Observable<unknown> {
    return this.http.delete<unknown>(`v1/config/groups/${String(id)}`);
  }

  /** Partial update of one entry; never creates it. */
  updateEntry(key: string, patch: ConfigEntryUpdateRequest): Observable<ConfigEntry> {
    return this.http.patch<ConfigEntry>(`v1/config/${encodeURIComponent(key)}`, patch);
  }

  deleteEntry(key: string): Observable<unknown> {
    return this.http.delete<unknown>(`v1/config/${encodeURIComponent(key)}`);
  }

  /**
   * Legacy bulk upsert. New keys are created, existing keys keep their group
   * and order when the request omits them.
   */
  upsertEntries(entries: ConfigEntryRequest[]): Observable<ConfigEntry[]> {
    return this.http.put<ConfigEntry[]>('v1/config', entries);
  }

  listUsers(): Observable<UserSummary[]> {
    return this.http.get<UserSummary[]>('v1/users');
  }

  updateUserRole(id: number, role: UserRoleValue): Observable<UserSummary> {
    return this.http.patch<UserSummary>(`v1/users/${String(id)}/role`, { role });
  }

  updateUserAreas(id: number, areaIds: number[]): Observable<UserSummary> {
    return this.http.patch<UserSummary>(`v1/users/${String(id)}/areas`, { areaIds });
  }

  updateUserStatus(id: number, status: 'ACTIVE' | 'INACTIVE'): Observable<UserSummary> {
    return this.http.patch<UserSummary>(`v1/users/${String(id)}/status`, { status });
  }
}

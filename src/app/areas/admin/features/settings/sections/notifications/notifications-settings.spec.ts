/**
 * Tests for the notification-preferences section.
 *
 * Feature: `/admin/settings` → Notificaciones.
 * Contract: the five global toggles load from `/v1/settings/notifications`,
 * persist together with a single PUT, and mark the section dirty on change.
 *
 * Approach: mount with a stubbed API, flip the switches through the form and
 * assert the request payload.
 */
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MessageService } from 'primeng/api';

import { SettingsApi } from '@services/settings/settings-api';
import { resolveUiResources } from '@shared/ui/testing/ui-test-resources';

import { NotificationsSettingsSection } from './notifications-settings';
import notificationsHtml from './notifications-settings.html?raw';
import buttonHtml from '@shared/ui/button/button.html?raw';
import emptyStateHtml from '@shared/ui/empty-state/empty-state.html?raw';
import sectionHtml from '@shared/ui/section/section.html?raw';
import skeletonHtml from '@shared/ui/skeleton/skeleton.html?raw';
import switchHtml from '@shared/ui/switch/switch.html?raw';

const SETTINGS = {
  kitchenSoundEnabled: true,
  kitchenHapticsEnabled: false,
  lowStockAlertsEnabled: true,
  orderAlertsEnabled: true,
  dailySummaryEnabled: false,
};

describe('NotificationsSettingsSection', () => {
  let fixture: ComponentFixture<NotificationsSettingsSection>;
  let component: NotificationsSettingsSection;
  let api: {
    getNotifications: ReturnType<typeof vi.fn>;
    updateNotifications: ReturnType<typeof vi.fn>;
  };
  let messages: { add: ReturnType<typeof vi.fn> };

  beforeAll(async () => {
    await resolveUiResources({
      'notifications-settings.html': notificationsHtml as unknown as string,
      'button.html': buttonHtml as unknown as string,
      'empty-state.html': emptyStateHtml as unknown as string,
      'section.html': sectionHtml as unknown as string,
      'skeleton.html': skeletonHtml as unknown as string,
      'switch.html': switchHtml as unknown as string,
    });
  });

  beforeEach(() => {
    TestBed.resetTestingModule();
    api = {
      getNotifications: vi.fn(() => of({ ...SETTINGS })),
      updateNotifications: vi.fn((body: unknown) => of(body)),
    };
    messages = { add: vi.fn() };

    TestBed.configureTestingModule({
      imports: [NotificationsSettingsSection],
      providers: [
        { provide: SettingsApi, useValue: api },
        { provide: MessageService, useValue: messages },
      ],
    });

    fixture = TestBed.createComponent(NotificationsSettingsSection);
    component = fixture.componentInstance;
    fixture.detectChanges();
    fixture.detectChanges();
  });

  it('loads every toggle and starts clean', () => {
    expect(component.loading()).toBe(false);
    expect(component.form.getRawValue()).toEqual(SETTINGS);
    expect(component.dirty()).toBe(false);
  });

  it('persists all five toggles in one request', () => {
    component.form.controls.kitchenHapticsEnabled.setValue(true);
    component.form.controls.dailySummaryEnabled.setValue(true);

    component.save();

    expect(api.updateNotifications).toHaveBeenCalledWith({
      ...SETTINGS,
      kitchenHapticsEnabled: true,
      dailySummaryEnabled: true,
    });
    expect(component.dirty()).toBe(false);
    expect(messages.add).toHaveBeenCalledWith(expect.objectContaining({ severity: 'success' }));
  });

  it('marks the section dirty on a toggle', () => {
    component.form.controls.lowStockAlertsEnabled.setValue(false);

    expect(component.dirty()).toBe(true);
  });

  it('restores the persisted toggles on discard', () => {
    component.form.controls.kitchenSoundEnabled.setValue(false);

    component.reset();

    expect(component.form.controls.kitchenSoundEnabled.value).toBe(true);
    expect(component.dirty()).toBe(false);
  });

  it('states that the preferences are global', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent;

    expect(text).toContain('globales para todo el restaurante');
  });
});

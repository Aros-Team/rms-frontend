/**
 * Tests for `Configuración → Cuenta`.
 *
 * Feature: Mi cuenta was absorbed by the settings workspace.
 * Contract:
 *  - profile, role and areas come from the Auth snapshot
 *  - privacy state is read from the same localStorage keys as the global notice
 *  - signing out clears the session and returns to /login
 *
 * Approach: instantiate with stubbed Auth/Router and assert the exposed state.
 */
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Auth } from '@app/core/services/auth/auth';
import { HabeasDataEvents } from '@shared/features/habeas-data/habeas-data-events';

import { AccountSettingsSection } from './account-settings';

describe('AccountSettingsSection', () => {
  const user = {
    id: 1,
    name: 'Ana Admin',
    document: '123',
    email: 'ana@rms.local',
    role: 'ADMIN' as const,
    areas: [
      { id: 1, name: 'Cocina' },
      { id: 2, name: 'Bar' },
    ],
  };
  const logout = vi.fn();
  const navigate = vi.fn();

  beforeEach(() => {
    localStorage.clear();
    logout.mockReset();
    navigate.mockReset();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: Auth, useValue: { getData: () => user, logout } },
        { provide: Router, useValue: { navigate } },
        HabeasDataEvents,
      ],
    });
  });

  function create(): AccountSettingsSection {
    return TestBed.runInInjectionContext(() => new AccountSettingsSection());
  }

  it('shows the signed-in profile and areas', () => {
    const component = create();

    expect(component.user?.name).toBe('Ana Admin');
    expect(component.roleLabel()).toBe('Administrador');
    expect(component.areaLabels()).toBe('Cocina, Bar');
  });

  it('reads the privacy acceptance from localStorage', () => {
    localStorage.setItem('habeas_data_accepted', 'true');
    localStorage.setItem('habeas_data_date', '22 de noviembre de 2026');
    const component = create();

    expect(component.privacyAccepted()).toBe(true);
    expect(component.privacyDate()).toBe('22 de noviembre de 2026');
  });

  it('logs out and returns to the login screen', () => {
    const component = create();
    component.confirmLogout();
    component.logout();

    expect(component.logoutVisible()).toBe(false);
    expect(logout).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });
});

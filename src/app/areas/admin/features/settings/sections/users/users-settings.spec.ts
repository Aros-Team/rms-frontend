/**
 * Tests for the users-and-roles section.
 *
 * Feature: `/admin/settings` → Usuarios y roles.
 * Contract:
 *  - the list joins area ids against `/v1/areas` and never exposes passwords;
 *  - search/role/status filters narrow the list without a request;
 *  - role, areas and status are patched only when they changed;
 *  - demoting an admin or deactivating an account asks for confirmation first;
 *  - a problem response is surfaced verbatim and the list refreshes;
 *  - the current admin's own role/status are read-only.
 *
 * Approach: mount with stubbed API/Area/Auth, drive the dialog state directly and
 * assert the PATCH calls.
 */
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MessageService } from 'primeng/api';

import { Area } from '@services/areas/area';
import { Auth } from '@services/auth/auth';
import { SettingsApi } from '@services/settings/settings-api';
import type { UserSummary } from '@models/dto/settings/settings';
import { resolveUiResources } from '@shared/ui/testing/ui-test-resources';

import { UsersSettingsSection } from './users-settings';
import usersHtml from './users-settings.html?raw';
import badgeHtml from '@shared/ui/badge/badge.html?raw';
import buttonHtml from '@shared/ui/button/button.html?raw';
import dialogHtml from '@shared/ui/dialog/dialog.html?raw';
import emptyStateHtml from '@shared/ui/empty-state/empty-state.html?raw';
import fieldHtml from '@shared/ui/field/field.html?raw';
import inputHtml from '@shared/ui/input/input.html?raw';
import sectionHtml from '@shared/ui/section/section.html?raw';
import selectHtml from '@shared/ui/select/select.html?raw';
import skeletonHtml from '@shared/ui/skeleton/skeleton.html?raw';
import statusPillHtml from '@shared/ui/status-pill/status-pill.html?raw';

function user(overrides: Partial<UserSummary> & Pick<UserSummary, 'id' | 'name'>): UserSummary {
  return {
    document: `DOC-${String(overrides.id)}`,
    email: `${String(overrides.id)}@rms.local`,
    phone: '',
    role: 'WORKER',
    status: 'ACTIVE',
    areaIds: [],
    ...overrides,
  };
}

const SELF = user({ id: 1007, name: 'Admin Uno', role: 'ADMIN' });
const ADMIN = user({ id: 1008, name: 'Admin Dos', role: 'ADMIN' });
const WAITER = user({ id: 1001, name: 'Mesero Uno', areaIds: [2] });
const COOK = user({ id: 1003, name: 'Cocinero Uno', areaIds: [1] });
const PENDING = user({ id: 1009, name: 'Pendiente', status: 'PENDING' });

describe('UsersSettingsSection', () => {
  let fixture: ComponentFixture<UsersSettingsSection>;
  let component: UsersSettingsSection;
  let api: {
    listUsers: ReturnType<typeof vi.fn>;
    updateUserRole: ReturnType<typeof vi.fn>;
    updateUserAreas: ReturnType<typeof vi.fn>;
    updateUserStatus: ReturnType<typeof vi.fn>;
  };
  let messages: { add: ReturnType<typeof vi.fn> };

  beforeAll(async () => {
    await resolveUiResources({
      'users-settings.html': usersHtml as unknown as string,
      'badge.html': badgeHtml as unknown as string,
      'button.html': buttonHtml as unknown as string,
      'dialog.html': dialogHtml as unknown as string,
      'empty-state.html': emptyStateHtml as unknown as string,
      'field.html': fieldHtml as unknown as string,
      'input.html': inputHtml as unknown as string,
      'section.html': sectionHtml as unknown as string,
      'select.html': selectHtml as unknown as string,
      'skeleton.html': skeletonHtml as unknown as string,
      'status-pill.html': statusPillHtml as unknown as string,
    });
  });

  beforeEach(() => {
    TestBed.resetTestingModule();
    api = {
      listUsers: vi.fn(() => of([SELF, ADMIN, WAITER, COOK, PENDING])),
      updateUserRole: vi.fn((id: number, role: string) =>
        of({ ...(id === ADMIN.id ? ADMIN : WAITER), role }),
      ),
      updateUserAreas: vi.fn((id: number, areaIds: number[]) => of({ ...WAITER, id, areaIds })),
      updateUserStatus: vi.fn((id: number, status: string) => of({ ...WAITER, id, status })),
    };
    messages = { add: vi.fn() };

    TestBed.configureTestingModule({
      imports: [UsersSettingsSection],
      providers: [
        { provide: SettingsApi, useValue: api },
        {
          provide: Area,
          useValue: {
            getAreas: vi.fn(() =>
              of([
                { id: 1, name: 'Cocina', type: 'KITCHEN', enabled: true },
                { id: 2, name: 'Servicio', type: 'SERVICE', enabled: true },
                { id: 3, name: 'Bar', type: 'BAR', enabled: true },
              ]),
            ),
          },
        },
        {
          provide: Auth,
          useValue: {
            getData: vi.fn(() => ({
              id: SELF.id,
              name: SELF.name,
              document: SELF.document,
              email: SELF.email,
              role: 'ADMIN',
              areas: [],
            })),
          },
        },
        { provide: MessageService, useValue: messages },
      ],
    });

    fixture = TestBed.createComponent(UsersSettingsSection);
    component = fixture.componentInstance;
    fixture.detectChanges();
    fixture.detectChanges();
  });

  it('lists users and resolves area names', () => {
    expect(component.users().length).toBe(5);
    expect(component.areas().length).toBe(3);
    expect(component.areaNames(WAITER)).toBe('Servicio');
    expect(component.areaNames(SELF)).toBe('Sin área');
  });

  it('filters locally by term, role and activity', () => {
    component.search.set('mesero');
    expect(component.filteredUsers().map((item) => item.id)).toEqual([WAITER.id]);

    component.clearFilters();
    component.roleFilter.set('ADMIN');
    expect(component.filteredUsers().map((item) => item.id)).toEqual([SELF.id, ADMIN.id]);

    component.clearFilters();
    component.statusFilter.set('INACTIVE');
    expect(component.filteredUsers().map((item) => item.id)).toEqual([PENDING.id]);
    expect(api.listUsers).toHaveBeenCalledTimes(1);
  });

  it('promotes a worker without a confirmation', () => {
    component.openEdit(WAITER);
    component.roleDraft.set('ADMIN');

    component.requestSave();

    expect(component.confirmVisible()).toBe(false);
    expect(api.updateUserRole).toHaveBeenCalledWith(WAITER.id, 'ADMIN');
    expect(api.updateUserAreas).not.toHaveBeenCalled();
    expect(api.updateUserStatus).not.toHaveBeenCalled();
  });

  it('confirms before demoting an administrator', () => {
    component.openEdit(ADMIN);
    component.roleDraft.set('WORKER');

    component.requestSave();
    expect(component.confirmVisible()).toBe(true);
    expect(api.updateUserRole).not.toHaveBeenCalled();

    component.confirmSave();
    expect(api.updateUserRole).toHaveBeenCalledWith(ADMIN.id, 'WORKER');
  });

  it('confirms before deactivating an account', () => {
    component.openEdit(WAITER);
    component.statusDraft.set('INACTIVE');

    component.requestSave();
    expect(component.confirmVisible()).toBe(true);
    expect(api.updateUserStatus).not.toHaveBeenCalled();

    component.confirmSave();
    expect(api.updateUserStatus).toHaveBeenCalledWith(WAITER.id, 'INACTIVE');
  });

  it('sends areas sorted and only when the set changed', () => {
    component.openEdit(WAITER);
    component.areaDraft.set([3, 1]);

    component.requestSave();

    expect(api.updateUserAreas).toHaveBeenCalledWith(WAITER.id, [1, 3]);
    expect(api.updateUserRole).not.toHaveBeenCalled();
  });

  it('promotes a PENDING account through the status patch', () => {
    component.openEdit(PENDING);
    expect(component.statusNeedsPromotion(PENDING)).toBe(true);
    expect(component.statusDraft()).toBe('ACTIVE');
    component.statusDraft.set('ACTIVE');

    component.requestSave();

    expect(api.updateUserStatus).toHaveBeenCalledWith(PENDING.id, 'ACTIVE');
  });

  it('keeps the current admin role/status read-only', () => {
    expect(component.isSelf(SELF)).toBe(true);
    expect(component.isSelf(WAITER)).toBe(false);
  });

  it('surfaces a server error and refreshes the list', () => {
    api.updateUserRole.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 400,
            error: { detail: 'Debe quedar al menos un administrador activo' },
          }),
      ),
    );

    component.openEdit(ADMIN);
    component.roleDraft.set('WORKER');
    component.requestSave();
    component.confirmSave();

    expect(component.dialogError()).toBe('Debe quedar al menos un administrador activo');
    expect(api.listUsers).toHaveBeenCalledTimes(2);
    expect(messages.add).not.toHaveBeenCalledWith(expect.objectContaining({ severity: 'success' }));
  });
});

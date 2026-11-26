/**
 * Tests for the advanced configuration section.
 *
 * Feature: `/admin/settings` → Configuración avanzada.
 * Contract:
 *  - groups and entries load from `/v1/config`;
 *  - a new entry uses the safe bulk upsert; an existing one uses PATCH;
 *  - deletes ask first and call DELETE only after confirmation;
 *  - a non-empty group is blocked locally and a server 409 is surfaced.
 *
 * Approach: mount with a stubbed API and drive the dialog state directly.
 */
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MessageService } from 'primeng/api';

import { SettingsApi } from '@services/settings/settings-api';
import type { ConfigEntry, ConfigGroup } from '@models/dto/settings/settings';
import { resolveUiResources } from '@shared/ui/testing/ui-test-resources';

import { AdvancedSettingsSection } from './advanced-settings';
import advancedHtml from './advanced-settings.html?raw';
import buttonHtml from '@shared/ui/button/button.html?raw';
import cardHtml from '@shared/ui/card/card.html?raw';
import dialogHtml from '@shared/ui/dialog/dialog.html?raw';
import emptyStateHtml from '@shared/ui/empty-state/empty-state.html?raw';
import fieldHtml from '@shared/ui/field/field.html?raw';
import inputHtml from '@shared/ui/input/input.html?raw';
import sectionHtml from '@shared/ui/section/section.html?raw';
import selectHtml from '@shared/ui/select/select.html?raw';
import skeletonHtml from '@shared/ui/skeleton/skeleton.html?raw';
import textareaHtml from '@shared/ui/textarea/textarea.html?raw';

const ENTRY: ConfigEntry = {
  id: 1,
  key: 'labor_cost_mode',
  value: 'AUTO',
  description: null,
  groupId: 1,
  sortOrder: 1,
  updatedAt: '2026-11-21T17:02:05Z',
};

const GROUPS: ConfigGroup[] = [
  {
    id: 1,
    name: 'General',
    description: 'Moneda y zona horaria',
    sortOrder: 1,
    entries: [ENTRY],
  },
  {
    id: 2,
    name: 'Nómina',
    description: 'Liquidaciones',
    sortOrder: 2,
    entries: [],
  },
];

describe('AdvancedSettingsSection', () => {
  let fixture: ComponentFixture<AdvancedSettingsSection>;
  let component: AdvancedSettingsSection;
  let api: {
    getConfigGroups: ReturnType<typeof vi.fn>;
    createGroup: ReturnType<typeof vi.fn>;
    updateGroup: ReturnType<typeof vi.fn>;
    deleteGroup: ReturnType<typeof vi.fn>;
    updateEntry: ReturnType<typeof vi.fn>;
    deleteEntry: ReturnType<typeof vi.fn>;
    upsertEntries: ReturnType<typeof vi.fn>;
  };
  let messages: { add: ReturnType<typeof vi.fn> };

  beforeAll(async () => {
    await resolveUiResources({
      'advanced-settings.html': advancedHtml as unknown as string,
      'button.html': buttonHtml as unknown as string,
      'card.html': cardHtml as unknown as string,
      'dialog.html': dialogHtml as unknown as string,
      'empty-state.html': emptyStateHtml as unknown as string,
      'field.html': fieldHtml as unknown as string,
      'input.html': inputHtml as unknown as string,
      'section.html': sectionHtml as unknown as string,
      'select.html': selectHtml as unknown as string,
      'skeleton.html': skeletonHtml as unknown as string,
      'textarea.html': textareaHtml as unknown as string,
    });
  });

  beforeEach(() => {
    TestBed.resetTestingModule();
    api = {
      getConfigGroups: vi.fn(() => of(GROUPS.map((group) => ({ ...group })))),
      createGroup: vi.fn((body: unknown) => of({ id: 3, entries: [], ...(body as object) })),
      updateGroup: vi.fn((id: number, body: unknown) => of({ id, entries: [], ...(body as object) })),
      deleteGroup: vi.fn(() => of(null)),
      updateEntry: vi.fn((key: string, patch: unknown) => of({ ...ENTRY, key, ...(patch as object) })),
      deleteEntry: vi.fn(() => of(null)),
      upsertEntries: vi.fn((entries: unknown[]) => of(entries)),
    };
    messages = { add: vi.fn() };

    TestBed.configureTestingModule({
      imports: [AdvancedSettingsSection],
      providers: [
        { provide: SettingsApi, useValue: api },
        { provide: MessageService, useValue: messages },
      ],
    });

    fixture = TestBed.createComponent(AdvancedSettingsSection);
    component = fixture.componentInstance;
    fixture.detectChanges();
    fixture.detectChanges();
  });

  it('loads groups and counts every entry', () => {
    expect(component.loading()).toBe(false);
    expect(component.groups().length).toBe(2);
    expect(component.entryCount()).toBe(1);
    expect(component.groupOptions()).toEqual([
      { label: 'General', value: '1' },
      { label: 'Nómina', value: '2' },
    ]);
  });

  it('creates a group with the safe payload', () => {
    component.openCreateGroup();
    component.groupForm.setValue({
      name: '  Nuevo grupo  ',
      description: ' Descripción ',
      sortOrder: '4',
    });

    component.submitGroup();

    expect(api.createGroup).toHaveBeenCalledWith({
      name: 'Nuevo grupo',
      description: 'Descripción',
      sortOrder: 4,
    });
    expect(api.getConfigGroups).toHaveBeenCalledTimes(2);
    expect(messages.add).toHaveBeenCalledWith(
      expect.objectContaining({ summary: 'Grupo creado' }),
    );
  });

  it('renames an existing group', () => {
    component.openRenameGroup(GROUPS[1]);
    component.groupForm.controls.name.setValue('Nómina mensual');

    component.submitGroup();

    expect(api.updateGroup).toHaveBeenCalledWith(2, {
      name: 'Nómina mensual',
      description: 'Liquidaciones',
      sortOrder: 2,
    });
    expect(api.createGroup).not.toHaveBeenCalled();
  });

  it('does not submit an unnamed group', () => {
    component.openCreateGroup();
    component.groupForm.controls.name.setValue('');

    component.submitGroup();

    expect(api.createGroup).not.toHaveBeenCalled();
  });

  it('patches an existing entry instead of upserting it', () => {
    component.openEditEntry(ENTRY);
    component.entryForm.controls.value.setValue('REAL');

    component.submitEntry();

    expect(api.updateEntry).toHaveBeenCalledWith('labor_cost_mode', {
      value: 'REAL',
      description: '',
      groupId: 1,
      sortOrder: 1,
    });
    expect(api.upsertEntries).not.toHaveBeenCalled();
  });

  it('creates a new entry with the bulk upsert', () => {
    component.openCreateEntry(GROUPS[1]);
    component.entryForm.controls.key.setValue('payroll_rounding');
    component.entryForm.controls.value.setValue('nearest');

    component.submitEntry();

    expect(api.upsertEntries).toHaveBeenCalledWith([
      {
        key: 'payroll_rounding',
        value: 'nearest',
        groupId: 2,
        sortOrder: 1,
      },
    ]);
  });

  it('asks before deleting an entry and then deletes it', () => {
    component.askDeleteEntry(ENTRY);
    expect(component.confirmDeleteEntry()).toEqual(ENTRY);
    expect(api.deleteEntry).not.toHaveBeenCalled();

    component.confirmEntryDeletion();

    expect(api.deleteEntry).toHaveBeenCalledWith('labor_cost_mode');
    expect(component.confirmDeleteEntry()).toBeNull();
  });

  it('asks before deleting an empty group', () => {
    component.askDeleteGroup(GROUPS[1]);
    expect(component.confirmDeleteGroup()).toEqual(GROUPS[1]);

    component.confirmGroupDeletion();

    expect(api.deleteGroup).toHaveBeenCalledWith(2);
  });

  it('surfaces the 409 when a group still has entries', () => {
    api.deleteGroup.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 409,
            error: { detail: 'El grupo de configuración todavía tiene entradas' },
          }),
      ),
    );

    component.askDeleteGroup(GROUPS[0]);
    component.confirmGroupDeletion();

    expect(component.actionError()).toBe('El grupo de configuración todavía tiene entradas');
    expect(messages.add).not.toHaveBeenCalledWith(
      expect.objectContaining({ summary: 'Grupo eliminado' }),
    );
  });
});

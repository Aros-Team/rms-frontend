/**
 * Tests for the opening-hours settings section.
 *
 * Feature: `Configuración → Horario de atención`.
 * Contract:
 *  - loads the seven windows and shows closed days as such
 *  - editing marks the form dirty; saving validates and persists
 *  - a close time before the opening is rejected before the request
 *
 * Approach: stub SettingsApi and drive the component signals.
 */
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SettingsApi } from '@services/settings/settings-api';
import type { OpeningHours } from '@models/dto/settings/settings';

import { OpeningHoursSettingsSection } from './opening-hours-settings';

const HOURS: OpeningHours = {
  days: [
    { dayOfWeek: 'MONDAY', closed: true, openTime: null, closeTime: null },
    { dayOfWeek: 'TUESDAY', closed: false, openTime: '08:00', closeTime: '22:00' },
    { dayOfWeek: 'WEDNESDAY', closed: false, openTime: '08:00', closeTime: '22:00' },
    { dayOfWeek: 'THURSDAY', closed: false, openTime: '08:00', closeTime: '22:00' },
    { dayOfWeek: 'FRIDAY', closed: false, openTime: '08:00', closeTime: '22:00' },
    { dayOfWeek: 'SATURDAY', closed: false, openTime: '08:00', closeTime: '17:00' },
    { dayOfWeek: 'SUNDAY', closed: false, openTime: '08:00', closeTime: '17:00' },
  ],
};

describe('OpeningHoursSettingsSection', () => {
  const update = vi.fn((hours: OpeningHours) => of(hours));

  beforeEach(() => {
    update.mockClear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: SettingsApi,
          useValue: { getOpeningHours: () => of(HOURS), updateOpeningHours: update },
        },
      ],
    });
  });

  function create(): OpeningHoursSettingsSection {
    return TestBed.runInInjectionContext(() => new OpeningHoursSettingsSection());
  }

  it('loads the week and maps Monday as closed', () => {
    const section = create();
    section.load();

    expect(section.days()).toHaveLength(7);
    expect(section.day('MONDAY').closed).toBe(true);
    expect(section.day('TUESDAY').openTime).toBe('08:00');
  });

  it('marks the form dirty when a window changes', () => {
    const section = create();
    section.load();
    const changes: boolean[] = [];
    section.dirtyChange.subscribe((value) => changes.push(value));

    section.setTime('SATURDAY', 'closeTime', '18:00');

    expect(section.dirty()).toBe(true);
    expect(changes.at(-1)).toBe(true);
  });

  it('rejects a closing time before the opening without calling the API', () => {
    const section = create();
    section.load();
    section.setTime('TUESDAY', 'openTime', '22:00');

    section.save();

    expect(section.saveError()).toContain('Martes');
    expect(update).not.toHaveBeenCalled();
  });

  it('saves a valid week and clears the dirty flag', () => {
    const section = create();
    section.load();
    section.setTime('SUNDAY', 'closeTime', '16:00');
    section.save();

    expect(update).toHaveBeenCalledOnce();
    expect(section.notice()).toBe('Horario de atención guardado.');
    expect(section.dirty()).toBe(false);
  });

  it('shows the API problem on a failed save', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: SettingsApi,
          useValue: {
            getOpeningHours: () => of(HOURS),
            updateOpeningHours: () =>
              throwError(
                () =>
                  new HttpErrorResponse({
                    status: 400,
                    error: { detail: 'Rango inválido' },
                  }),
              ),
          },
        },
      ],
    });
    const section = create();
    section.load();
    section.setTime('SUNDAY', 'closeTime', '16:00');
    section.save();

    expect(section.saveError()).toBe('Rango inválido');
  });
});

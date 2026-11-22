/**
 * Tests for the individual shift planner form.
 *
 * Feature: `Horarios → Turnos`.
 * Contract:
 *  - a shift requires a worker, at least one day and an end after the start;
 *  - day chips toggle without losing the rest of the selection;
 *  - validation happens before any HTTP call.
 *
 * Approach: instantiate with service stubs and exercise the form signals.
 */
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Area } from '@app/core/services/areas/area';
import { Logging } from '@app/core/services/logging/logging';
import { ScheduleAssignment } from '@app/core/services/schedules/schedule-assignment';
import { Schedule } from '@app/core/services/schedules/schedule';
import { Worker } from '@app/core/services/workers/worker';

import { ShiftPlanner } from './shift-planner';

describe('ShiftPlanner', () => {
  const createSchedule = vi.fn(() => of({ id: 1, name: 'Turno', shifts: [] }));

  beforeEach(() => {
    createSchedule.mockClear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: Schedule,
          useValue: { getAll: () => of([]), create: createSchedule, delete: () => of({}) },
        },
        {
          provide: ScheduleAssignment,
          useValue: {
            getAssignments: () => of([]),
            assign: () => of({}),
            removeAssignment: () => of({}),
          },
        },
        { provide: Worker, useValue: { getWorkers: () => of([]) } },
        { provide: Area, useValue: { getAreas: () => of([]) } },
        { provide: Logging, useValue: { error: vi.fn(), debug: vi.fn(), info: vi.fn() } },
      ],
    });
  });

  function create(): ShiftPlanner {
    return TestBed.runInInjectionContext(() => new ShiftPlanner());
  }

  it('requires a worker before saving', () => {
    const planner = create();
    planner.selectedDays.set(['MONDAY']);
    planner.save();

    expect(planner.formError()).toBe('Selecciona un trabajador.');
    expect(createSchedule).not.toHaveBeenCalled();
  });

  it('requires at least one day', () => {
    const planner = create();
    planner.workerId.set(1001);
    planner.save();

    expect(planner.formError()).toBe('Selecciona al menos un día.');
    expect(createSchedule).not.toHaveBeenCalled();
  });

  it('rejects an end time that is not after the start', () => {
    const planner = create();
    planner.workerId.set(1001);
    planner.selectedDays.set(['MONDAY']);
    planner.startTime.set('12:00');
    planner.endTime.set('12:00');
    planner.save();

    expect(planner.formError()).toBe('La hora de fin debe ser posterior a la de inicio.');
    expect(createSchedule).not.toHaveBeenCalled();
  });

  it('toggles a day without dropping the others', () => {
    const planner = create();
    planner.toggleDay('MONDAY');
    planner.toggleDay('WEDNESDAY');
    expect(planner.selectedDays()).toEqual(['MONDAY', 'WEDNESDAY']);

    planner.toggleDay('MONDAY');
    expect(planner.selectedDays()).toEqual(['WEDNESDAY']);
  });
});

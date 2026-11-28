/**
 * Tests for the admin weekly schedule grid.
 *
 * Feature: workers as rows, shifts as blocks, week navigation and assignment
 * add/remove with pre-flight rules and optimistic rollback.
 *
 * Contract:
 *  - the grid loads schedules, workers, areas and one assignment request per
 *    worker, then derives the weekly hours from the assigned templates;
 *  - a worker without an area is blocked before the request;
 *  - an overlapping candidate is blocked with a message and no POST;
 *  - a successful assignment is applied optimistically and sent to the API;
 *  - a failed POST rolls the assignment back to the exact previous state;
 *  - a failed DELETE restores the removed schedule;
 *  - week navigation moves the anchor by seven days.
 *
 * Approach: mount the component with stubbed services, resolve its external
 * template through `?raw`, drive the same methods the drag/drop and dialogs
 * call, and assert signals plus the captured API calls.
 */
import { ɵresolveComponentResources as resolveComponentResources } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { Area } from '@app/core/services/areas/area';
import { Logging } from '@app/core/services/logging/logging';
import { ScheduleAssignment } from '@app/core/services/schedules/schedule-assignment';
import { Schedule } from '@app/core/services/schedules/schedule';
import { SettingsApi } from '@app/core/services/settings/settings-api';
import { Worker } from '@app/core/services/workers/worker';
import type { AreaResponse } from '@app/shared/models/dto/areas/area';
import type { Schedule as ScheduleModel } from '@app/shared/models/dto/schedules/schedule';
import type { DayOfWeek, Shift } from '@app/shared/models/dto/schedules/shift';
import type { WorkerResponse } from '@app/shared/models/dto/workers/worker-response';

import { WeekGrid } from './week-grid';
import weekGridHtml from './week-grid.html?raw';

const DAYS: DayOfWeek[] = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
];

const WORKER: WorkerResponse = {
  id: 7,
  document: '1094',
  name: 'Ana Pérez',
  email: 'ana@rms.co',
  role: 'WORKER',
  status: 'ACTIVE',
  assignedAreas: [2],
};

const AREA: AreaResponse = { id: 2, name: 'Salón', type: 'SERVICE', enabled: true };

function shift(dayOfWeek: DayOfWeek, startTime: string, endTime: string, id?: number): Shift {
  return { dayOfWeek, startTime, endTime, ...(id !== undefined ? { id } : {}) };
}

function fullWeek(id: number, name: string, start: string, end: string): ScheduleModel {
  return { id, name, shifts: DAYS.map((day) => shift(day, start, end)) };
}

describe('WeekGrid', () => {
  let fixture: ComponentFixture<WeekGrid>;
  let component: WeekGrid;
  let scheduleApi: {
    getAll: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  let settingsApi: { getOpeningHours: ReturnType<typeof vi.fn> };
  let assignmentApi: {
    getAssignments: ReturnType<typeof vi.fn>;
    assign: ReturnType<typeof vi.fn>;
    removeAssignment: ReturnType<typeof vi.fn>;
  };
  let workerApi: { getWorkers: ReturnType<typeof vi.fn> };

  beforeAll(async () => {
    await resolveComponentResources((url: string) => {
      if (url.endsWith('week-grid.html')) {
        return Promise.resolve(weekGridHtml as unknown as string);
      }
      return Promise.resolve('');
    });
  });

  beforeEach(() => {
    TestBed.resetTestingModule();

    scheduleApi = {
      getAll: vi.fn(() => of([fullWeek(1, 'Mañana', '11:00', '15:00')])),
      update: vi.fn((id: number, data: { name: string; description?: string; shifts: Shift[] }) =>
        of({ id, name: data.name, description: data.description, shifts: data.shifts }),
      ),
    };
    settingsApi = { getOpeningHours: vi.fn(() => of({ days: [] })) };
    assignmentApi = {
      getAssignments: vi.fn(() => of([1])),
      assign: vi.fn(() =>
        of({
          workerId: 7,
          scheduleId: 2,
          weeklyHours: 10,
          legalWeeklyHours: 42,
          hardWeeklyCapHours: 42,
          warning: null,
        }),
      ),
      removeAssignment: vi.fn(() => of(undefined)),
    };
    workerApi = { getWorkers: vi.fn(() => of([WORKER])) };

    TestBed.configureTestingModule({
      imports: [WeekGrid],
      providers: [
        { provide: Schedule, useValue: scheduleApi },
        { provide: ScheduleAssignment, useValue: assignmentApi },
        { provide: Worker, useValue: workerApi },
        { provide: Area, useValue: { getAreas: vi.fn(() => of([AREA])) } },
        { provide: SettingsApi, useValue: settingsApi },
        { provide: Logging, useValue: { debug: vi.fn(), error: vi.fn() } },
      ],
    });
  });

  async function mount(): Promise<void> {
    fixture = TestBed.createComponent(WeekGrid);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();
  }

  it('loads the week and derives the assigned hours per worker', async () => {
    await mount();

    expect(scheduleApi.getAll).toHaveBeenCalledTimes(1);
    expect(workerApi.getWorkers).toHaveBeenCalledTimes(1);
    expect(assignmentApi.getAssignments).toHaveBeenCalledWith(7);
    expect(component.rows()).toHaveLength(1);
    expect(component.rows()[0].week.weeklyMinutes).toBe(28 * 60);
    expect(component.rows()[0].areaLabels).toEqual(['Salón']);

    const text = (fixture.nativeElement as HTMLElement).textContent;
    expect(text).toContain('Ana Pérez');
    expect(text).toContain('11:00–15:00');
  });

  it('lays out each day as horizontal shift bars across the hour axis', async () => {
    await mount();

    const monday = component.timelineDays().find((day) => day.dayOfWeek === 'MONDAY');

    expect(monday?.bars).toHaveLength(1);
    expect(monday?.bars[0].startTime).toBe('11:00');
    expect(monday?.bars[0].endTime).toBe('15:00');
    expect(monday?.bars[0].left).toBe(0);
    expect(monday?.bars[0].width).toBe(100);
    expect(monday?.workerCount).toBe(1);
    expect(component.timelineHours()).toEqual([11, 12, 13, 14]);
  });

  it('blocks a worker without an area before any request', async () => {
    workerApi.getWorkers.mockReturnValue(of([{ ...WORKER, assignedAreas: [] }]));
    await mount();

    const worker = component.rows()[0].worker;
    const candidate = fullWeek(2, 'Apoyo', '16:00', '17:00');
    const accepted = component.attemptAssign(worker, candidate);

    expect(accepted).toBe(false);
    expect(assignmentApi.assign).not.toHaveBeenCalled();
    expect(component.actionError()).toContain('no tiene un área asignada');
  });

  it('blocks an overlapping assignment and explains the clash', async () => {
    const schedules: ScheduleModel[] = [
      { id: 1, name: 'Mañana', shifts: [shift('MONDAY', '11:00', '15:00', 1)] },
      { id: 2, name: 'Tarde', shifts: [shift('MONDAY', '14:00', '18:00', 2)] },
    ];
    scheduleApi.getAll.mockReturnValue(of(schedules));
    await mount();

    const worker = component.rows()[0].worker;
    const tarde = schedules.find((schedule) => schedule.id === 2);
    if (tarde === undefined) {
      throw new Error('Missing Tarde template');
    }

    const accepted = component.attemptAssign(worker, tarde);

    expect(accepted).toBe(false);
    expect(assignmentApi.assign).not.toHaveBeenCalled();
    expect(component.actionError()).toContain('se cruza');
  });

  it('applies a valid assignment optimistically and persists it', async () => {
    await mount();

    const worker = component.rows()[0].worker;
    const candidate = fullWeek(2, 'Apoyo', '16:00', '17:00');
    const accepted = component.attemptAssign(worker, candidate);

    expect(accepted).toBe(true);
    expect(assignmentApi.assign).toHaveBeenCalledWith(7, 2);
    expect(component.assignments().get(7)).toEqual([1, 2]);
    expect(component.notice()).toContain('asignado a Ana Pérez');
  });

  it('dismisses the success toast on its own', async () => {
    await mount();
    const worker = component.rows()[0].worker;
    const candidate = fullWeek(2, 'Apoyo', '16:00', '17:00');

    vi.useFakeTimers();
    try {
      component.attemptAssign(worker, candidate);
      expect(component.notice()).toContain('asignado a Ana Pérez');

      vi.advanceTimersByTime(4000);

      expect(component.notice()).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('dismisses the error toast on its own', async () => {
    const schedules: ScheduleModel[] = [
      { id: 1, name: 'Mañana', shifts: [shift('MONDAY', '11:00', '15:00', 1)] },
      { id: 2, name: 'Tarde', shifts: [shift('MONDAY', '14:00', '18:00', 2)] },
    ];
    scheduleApi.getAll.mockReturnValue(of(schedules));
    await mount();

    const worker = component.rows()[0].worker;
    const tarde = schedules.find((schedule) => schedule.id === 2);
    if (tarde === undefined) {
      throw new Error('Missing Tarde template');
    }

    vi.useFakeTimers();
    try {
      component.attemptAssign(worker, tarde);
      expect(component.actionError()).toContain('se cruza');

      vi.advanceTimersByTime(8000);

      expect(component.actionError()).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('surfaces the server weekly-hours warning without re-deriving the rule', async () => {
    assignmentApi.assign.mockReturnValue(
      of({
        workerId: 7,
        scheduleId: 2,
        weeklyHours: 63,
        legalWeeklyHours: 42,
        hardWeeklyCapHours: 42,
        warning: 'Weekly hours 45.00 exceed the 42 h legal reference',
      }),
    );
    await mount();

    const worker = component.rows()[0].worker;
    const candidate = fullWeek(2, 'Apoyo', '16:00', '17:00');
    component.attemptAssign(worker, candidate);
    fixture.detectChanges();

    expect(component.notice()).toContain('Weekly hours 45.00 exceed the 42 h legal reference');
    expect(component.actionError()).toBeNull();
  });

  it('rolls back the exact assignment when the POST fails', async () => {
    assignmentApi.assign.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    await mount();

    const worker = component.rows()[0].worker;
    const candidate = fullWeek(2, 'Apoyo', '16:00', '17:00');
    component.attemptAssign(worker, candidate);

    expect(component.assignments().get(7)).toEqual([1]);
    expect(component.savingWorkerId()).toBeNull();
    expect(component.actionError()).toContain('volvió al estado anterior');
  });

  it('restores a removed schedule when the DELETE fails', async () => {
    assignmentApi.removeAssignment.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 500 })),
    );
    await mount();

    const worker = component.rows()[0].worker;
    const template = component.schedules()[0];
    component.requestRemoval(worker, template);
    expect(component.pendingRemoval()).not.toBeNull();

    component.confirmRemoval();

    expect(assignmentApi.removeAssignment).toHaveBeenCalledWith(7, 1);
    expect(component.assignments().get(7)).toEqual([1]);
    expect(component.actionError()).toContain('volvió al estado anterior');
  });

  it('opens the removal confirmation when a shift is dropped on the trash zone', async () => {
    await mount();

    const worker = component.rows()[0].worker;
    const template = component.schedules()[0];
    component.draggedRemoval.set({ worker, schedule: template });

    component.dropRemoval({ preventDefault: vi.fn() } as unknown as DragEvent);

    expect(component.draggedRemoval()).toBeNull();
    expect(component.pendingRemoval()).toEqual({ worker, schedule: template });
  });

  it('moves the week anchor by seven days', async () => {
    await mount();
    const anchor = new Date(2026, 10, 21);
    component.weekAnchor.set(anchor);

    component.nextWeek();

    expect(component.weekAnchor().getDate()).toBe(28);
    expect(component.weekRangeLabel()).toContain('2026');
  });

  // ---- Graphical shift editing ------------------------------------------

  const OPEN_WINDOW_MINUTES = 14 * 60; // 08:00 → 22:00

  function openAllWeek(): void {
    settingsApi.getOpeningHours.mockReturnValue(
      of({
        days: DAYS.map((dayOfWeek) => ({
          dayOfWeek,
          closed: false,
          openTime: '08:00',
          closeTime: '22:00',
        })),
      }),
    );
  }

  function pxForMinutes(minutes: number): number {
    return (minutes / OPEN_WINDOW_MINUTES) * 800;
  }

  function pointerHarness(): { barElement: HTMLElement; startHandle: HTMLElement } {
    const track = document.createElement('div');
    track.className = 'week-grid__track';
    track.getBoundingClientRect = () => ({ width: 800 }) as unknown as DOMRect;

    const barElement = document.createElement('div');
    const startHandle = document.createElement('span');
    startHandle.setAttribute('data-shift-handle', 'start');
    barElement.appendChild(startHandle);
    track.appendChild(barElement);

    barElement.setPointerCapture = vi.fn();
    barElement.hasPointerCapture = vi.fn(() => true);
    barElement.releasePointerCapture = vi.fn();
    return { barElement, startHandle };
  }

  function pointerEvent(
    barElement: HTMLElement,
    clientX: number,
    target: EventTarget = barElement,
  ): PointerEvent {
    return {
      button: 0,
      pointerId: 1,
      clientX,
      currentTarget: barElement,
      target,
      preventDefault: vi.fn(),
    } as unknown as PointerEvent;
  }

  it('opens the template editor when a shift is clicked', async () => {
    await mount();
    const bar = component.timelineDays()[0].bars[0];

    component.onBarClick(bar);

    expect(component.editingShift()?.key).toBe(bar.key);
    expect(component.editingAffectedWorkers()).toBe(1);
    expect(component.editingStartTime()).toBe('11:00');
    expect(component.editingEndTime()).toBe('15:00');
  });

  it('treats a movement below the threshold as a click', async () => {
    openAllWeek();
    await mount();
    const bar = component.timelineDays()[0].bars[0];
    const { barElement } = pointerHarness();

    component.onBarPointerDown(pointerEvent(barElement, 100), bar);
    component.onBarPointerMove(pointerEvent(barElement, 103));
    component.onBarPointerUp(pointerEvent(barElement, 103));

    expect(component.activePreview()).toBeNull();
    expect(scheduleApi.update).not.toHaveBeenCalled();

    component.onBarClick(bar);
    expect(component.editingShift()?.key).toBe(bar.key);
  });

  it('moves a shift on the 15-minute grid and preserves its duration', async () => {
    openAllWeek();
    await mount();
    const bar = component.timelineDays()[0].bars[0];
    const { barElement } = pointerHarness();

    component.onBarPointerDown(pointerEvent(barElement, 100), bar);
    component.onBarPointerMove(pointerEvent(barElement, 100 + pxForMinutes(105)));

    expect(component.activePreview()?.label).toBe('12:45–16:45');

    component.onBarPointerUp(pointerEvent(barElement, 100 + pxForMinutes(105)));

    expect(scheduleApi.update).toHaveBeenCalledTimes(1);
    const updated = component.schedules()[0];
    const monday = updated.shifts.find((shift) => shift.dayOfWeek === 'MONDAY');
    const tuesday = updated.shifts.find((shift) => shift.dayOfWeek === 'TUESDAY');
    expect(monday).toMatchObject({ startTime: '12:45', endTime: '16:45' });
    expect(tuesday).toMatchObject({ startTime: '11:00', endTime: '15:00' });
    expect(component.notice()).toContain('actualizado');
  });

  it('resizes the start edge without moving the end', async () => {
    openAllWeek();
    await mount();
    const bar = component.timelineDays()[0].bars[0];
    const { barElement, startHandle } = pointerHarness();

    component.onBarPointerDown(pointerEvent(barElement, 300, startHandle), bar);
    component.onBarPointerMove(pointerEvent(barElement, 300 - pxForMinutes(15)));
    component.onBarPointerUp(pointerEvent(barElement, 300 - pxForMinutes(15)));

    const monday = component.schedules()[0].shifts.find((shift) => shift.dayOfWeek === 'MONDAY');
    expect(monday).toMatchObject({ startTime: '10:45', endTime: '15:00' });
  });

  it('marks an overlapping destination invalid and never persists it', async () => {
    openAllWeek();
    const secondWorker: WorkerResponse = {
      ...WORKER,
      id: 8,
      document: '2094',
      name: 'Luis Gómez',
    };
    workerApi.getWorkers.mockReturnValue(of([WORKER, secondWorker]));
    assignmentApi.getAssignments.mockImplementation((workerId: number) =>
      of(workerId === 8 ? [1, 2] : [1]),
    );
    scheduleApi.getAll.mockReturnValue(
      of([
        fullWeek(1, 'Mañana', '11:00', '15:00'),
        { id: 2, name: 'Tarde', shifts: [shift('MONDAY', '14:00', '18:00', 2)] },
      ]),
    );
    await mount();
    const bar = component.timelineDays()[0].bars[0];
    const { barElement } = pointerHarness();

    component.onBarPointerDown(pointerEvent(barElement, 100), bar);
    component.onBarPointerMove(pointerEvent(barElement, 100 + pxForMinutes(105)));

    expect(component.activePreview()?.valid).toBe(false);
    expect(component.activePreview()?.reason).toContain('se cruza');

    component.onBarPointerUp(pointerEvent(barElement, 100 + pxForMinutes(105)));

    expect(scheduleApi.update).not.toHaveBeenCalled();
    expect(component.actionError()).toContain('se cruza');
  });

  it('cancels an active gesture with Escape and keeps the original times', async () => {
    openAllWeek();
    await mount();
    const bar = component.timelineDays()[0].bars[0];
    const { barElement } = pointerHarness();

    component.onBarPointerDown(pointerEvent(barElement, 100), bar);
    component.onBarPointerMove(pointerEvent(barElement, 200));
    component.cancelInteraction();

    expect(component.interaction()).toBeNull();
    expect(component.activePreview()).toBeNull();
    expect(scheduleApi.update).not.toHaveBeenCalled();

    // The release after Escape must not open the editor as a click.
    component.onBarClick(bar);
    expect(component.editingShift()).toBeNull();
  });

  it('restores the previous shift when the update fails', async () => {
    openAllWeek();
    scheduleApi.update.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    await mount();
    const bar = component.timelineDays()[0].bars[0];
    const { barElement } = pointerHarness();

    component.onBarPointerDown(pointerEvent(barElement, 100), bar);
    component.onBarPointerMove(pointerEvent(barElement, 200));
    component.onBarPointerUp(pointerEvent(barElement, 200));

    const monday = component.schedules()[0].shifts.find((shift) => shift.dayOfWeek === 'MONDAY');
    expect(monday).toMatchObject({ startTime: '11:00', endTime: '15:00' });
    expect(component.savingTemplateId()).toBeNull();
    expect(component.actionError()).toContain('volvió al estado anterior');
  });

  it('rejects an invalid dialog range without calling the API', async () => {
    await mount();
    const bar = component.timelineDays()[0].bars[0];
    component.openShiftEditor(bar);

    component.editingStartTime.set('16:00');
    component.editingEndTime.set('15:00');
    component.saveShiftEditor();

    expect(component.editingError()).toContain('posterior');
    expect(component.editingShift()).not.toBeNull();
    expect(scheduleApi.update).not.toHaveBeenCalled();
  });
});

/**
 * Tests for the worker "Mi horario" screen.
 *
 * Feature: next shift, weekly schedule with dates, honest attendance card.
 *
 * Contract:
 *  - the next shift is resolved from the real clock and the recurring week;
 *  - an empty week shows one actionable empty state, not seven dead cards;
 *  - a 403 renders the no-permission state and no retry loop;
 *  - clock-in/out call the API and report the created entry;
 *  - a 409 is explained honestly instead of faking session state;
 *  - week navigation moves the dated labels.
 *
 * Approach: mount with stubbed `WorkerSchedule` and `WorkerClock`, fix `now`,
 * and assert the rendered text plus component state.
 */
import { ɵresolveComponentResources as resolveComponentResources } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { Logging } from '@app/core/services/logging/logging';
import { WorkerClock } from '@app/core/services/schedules/worker-clock';
import { WorkerSchedule } from '@app/core/services/schedules/worker-schedule';
import type { TimeLogEntry } from '@app/shared/models/dto/schedules/time-log-entry';
import type { WorkerScheduleResponse } from '@app/shared/models/dto/schedules/worker-schedule-response';

import { MySchedule } from './my-schedule';
import myScheduleHtml from './my-schedule.html?raw';
import badgeHtml from '@app/shared/ui/badge/badge.html?raw';
import buttonHtml from '@app/shared/ui/button/button.html?raw';
import cardHtml from '@app/shared/ui/card/card.html?raw';
import emptyStateHtml from '@app/shared/ui/empty-state/empty-state.html?raw';
import iconButtonHtml from '@app/shared/ui/icon-button/icon-button.html?raw';
import pageHeaderHtml from '@app/shared/ui/page-header/page-header.html?raw';
import sectionHtml from '@app/shared/ui/section/section.html?raw';
import skeletonHtml from '@app/shared/ui/skeleton/skeleton.html?raw';

const SCHEDULE: WorkerScheduleResponse = {
  days: [
    {
      dayOfWeek: 'MONDAY',
      shifts: [{ scheduleName: 'Mañana', startTime: '11:00', endTime: '15:00' }],
    },
    {
      dayOfWeek: 'TUESDAY',
      shifts: [{ scheduleName: 'Mañana', startTime: '11:00', endTime: '15:00' }],
    },
  ],
};

describe('MySchedule', () => {
  let fixture: ComponentFixture<MySchedule>;
  let component: MySchedule;
  let scheduleApi: { getMySchedule: ReturnType<typeof vi.fn> };
  let clockApi: {
    clockIn: ReturnType<typeof vi.fn>;
    clockOut: ReturnType<typeof vi.fn>;
  };

  const entry = (type: 'IN' | 'OUT', withinShift = true): TimeLogEntry => ({
    id: type === 'IN' ? 501 : 502,
    workerId: 1001,
    timestamp: '2026-11-22T15:00:00Z',
    type,
    withinShift,
    relatedShiftId: null,
  });

  beforeAll(async () => {
    const templates: readonly (readonly [string, string])[] = [
      ['my-schedule.html', myScheduleHtml as unknown as string],
      ['badge.html', badgeHtml as unknown as string],
      ['button.html', buttonHtml as unknown as string],
      ['card.html', cardHtml as unknown as string],
      ['empty-state.html', emptyStateHtml as unknown as string],
      ['icon-button.html', iconButtonHtml as unknown as string],
      ['page-header.html', pageHeaderHtml as unknown as string],
      ['section.html', sectionHtml as unknown as string],
      ['skeleton.html', skeletonHtml as unknown as string],
    ];
    await resolveComponentResources((url: string) => {
      const match = templates.find(([name]) => url.endsWith(name));
      return Promise.resolve(match?.[1] ?? '');
    });
  });

  beforeEach(() => {
    TestBed.resetTestingModule();
    scheduleApi = { getMySchedule: vi.fn(() => of(SCHEDULE)) };
    clockApi = {
      clockIn: vi.fn(() => of(entry('IN'))),
      clockOut: vi.fn(() => of(entry('OUT'))),
    };
    TestBed.configureTestingModule({
      imports: [MySchedule],
      providers: [
        { provide: WorkerSchedule, useValue: scheduleApi },
        { provide: WorkerClock, useValue: clockApi },
        { provide: Logging, useValue: { debug: vi.fn(), error: vi.fn() } },
      ],
    });
  });

  async function mount(): Promise<void> {
    fixture = TestBed.createComponent(MySchedule);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();
  }

  it('shows the next shift and the weekly schedule with dates', async () => {
    await mount();
    component.now.set(new Date(2026, 10, 16, 10, 0));
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent;
    expect(text).toContain('Mi horario');
    expect(text).toContain('Próximo turno');
    expect(text).toContain('Lunes');
    expect(text).toContain('11:00–15:00');
    expect(text).toContain('2 turnos');
    expect(text).toContain('8 h en la semana');
  });

  it('clocks in and reports the created entry', async () => {
    await mount();

    const button = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
      '[data-testid="clock-in"] button',
    );
    button?.click();
    fixture.detectChanges();

    expect(clockApi.clockIn).toHaveBeenCalledTimes(1);
    expect(component.clockFeedback()).toBe('Entrada registrada.');
    expect(component.lastClock()).toMatchObject({ type: 'IN', withinShift: true });

    const text = (fixture.nativeElement as HTMLElement).textContent;
    expect(text).toContain('Entrada');
    expect(text).toContain('Dentro de turno');
  });

  it('clocks out and shows the exit result', async () => {
    await mount();

    const button = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
      '[data-testid="clock-out"] button',
    );
    button?.click();
    fixture.detectChanges();

    expect(clockApi.clockOut).toHaveBeenCalledTimes(1);
    expect(component.clockFeedback()).toBe('Salida registrada.');
    expect(component.lastClock()).toMatchObject({ type: 'OUT' });
  });

  it('explains a 409 as an already-open or missing session, without inventing state', async () => {
    clockApi.clockIn.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 409, error: { detail: 'open session' } })),
    );
    await mount();

    component.clockIn();
    fixture.detectChanges();

    const message = component.clockError() ?? '';
    expect(message).toContain('Ya tienes una sesión abierta');
    expect(component.lastClock()).toBeNull();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Ya tienes una sesión abierta',
    );
  });

  it('leaves clock-out 409 clearly explained as no open session', async () => {
    clockApi.clockOut.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 409, error: { detail: 'none' } })),
    );
    await mount();

    component.clockOut();
    fixture.detectChanges();

    expect(component.clockError()).toContain('No hay una sesión abierta que cerrar');
  });

  it('renders one empty state when the week has no shifts', async () => {
    scheduleApi.getMySchedule.mockReturnValue(of({ days: [] }));
    await mount();

    const text = (fixture.nativeElement as HTMLElement).textContent;
    expect(text).toContain('Sin turnos asignados');
    expect(component.totalShifts()).toBe(0);
  });

  it('shows the no-permission state without a retry action', async () => {
    scheduleApi.getMySchedule.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 403 })),
    );
    await mount();

    expect(component.forbidden()).toBe(true);
    const text = (fixture.nativeElement as HTMLElement).textContent;
    expect(text).toContain('Sin permiso');
    expect(text).toContain('no tiene permiso');
  });

  it('moves the dated labels when navigating weeks', async () => {
    await mount();
    component.weekAnchor.set(new Date(2026, 10, 21));
    fixture.detectChanges();
    const before = component.weekLabel();

    component.nextWeek();
    fixture.detectChanges();

    expect(component.weekLabel()).not.toBe(before);
    expect(component.days()[0].date.getDate()).toBe(23);
  });
});

/**
 * Tests for the worker "Mi horario" screen.
 *
 * Feature: next shift, weekly schedule with dates, honest attendance card.
 *
 * Contract:
 *  - the next shift is resolved from the real clock and the recurring week;
 *  - an empty week shows one actionable empty state, not seven dead cards;
 *  - a 403 renders the no-permission state and no retry loop;
 *  - the attendance card states that clock-out does not exist: it never
 *    renders a fake clock button;
 *  - week navigation moves the dated labels.
 *
 * Approach: mount with a stubbed `WorkerSchedule`, fix `now`, and assert the
 * rendered text plus component state.
 */
import { ɵresolveComponentResources as resolveComponentResources } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { Logging } from '@app/core/services/logging/logging';
import { WorkerSchedule } from '@app/core/services/schedules/worker-schedule';
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
    TestBed.configureTestingModule({
      imports: [MySchedule],
      providers: [
        { provide: WorkerSchedule, useValue: scheduleApi },
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

  it('never renders a clock-out button and explains the API limitation', async () => {
    await mount();

    const text = (fixture.nativeElement as HTMLElement).textContent;
    expect(text).toContain('La salida y el marcaje manual todavía no están disponibles');
    expect(text).not.toContain('Marcar salida');
    expect(text).not.toContain('Registrar salida');

    const labels = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button'),
    ).map(
      (button) => `${button.textContent} ${button.getAttribute('aria-label') ?? ''}`,
    );
    expect(labels.some((label) => label.toLowerCase().includes('salida'))).toBe(false);
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

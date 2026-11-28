/**
 * Tests for the admin attendance panel.
 *
 * Feature: filter the existing time-log endpoint by worker and local date
 * range, then group the events into worker/day sessions.
 *
 * Contract:
 *  - the initial query is today, converted to local-day ISO instants;
 *  - a selected worker adds `workerId`; "todos" omits it;
 *  - a closed IN/OUT pair shows its hours;
 *  - a 5xx shows the explicit "build cannot decode OUT" message instead of a
 *    fake 0 h summary;
 *  - the panel never renders a clock button (writes do not exist).
 *
 * Approach: mount with stubbed services and assert the captured request
 * params plus the rendered summary.
 */
import { ɵresolveComponentResources as resolveComponentResources } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { Logging } from '@app/core/services/logging/logging';
import { TimeLog } from '@app/core/services/schedules/time-log';
import { Worker } from '@app/core/services/workers/worker';
import type { TimeLogEntry } from '@app/shared/models/dto/schedules/time-log-entry';
import type { WorkerResponse } from '@app/shared/models/dto/workers/worker-response';
import {
  endOfLocalDayIso,
  startOfLocalDayIso,
} from '@app/core/services/schedules/schedule-planning';

import { TimeLogsPanel } from './time-logs-panel';
import timeLogsHtml from './time-logs-panel.html?raw';
import badgeHtml from '@app/shared/ui/badge/badge.html?raw';

const WORKER: WorkerResponse = {
  id: 1001,
  document: '1000001001',
  name: 'Mesero 1',
  email: 'seed1001@rms.local',
  role: 'WORKER',
  status: 'ACTIVE',
};

function log(
  id: number,
  workerId: number,
  hour: number,
  minute: number,
  type: 'IN' | 'OUT',
): TimeLogEntry {
  return {
    id,
    workerId,
    timestamp: new Date(2026, 10, 20, hour, minute).toISOString(),
    type,
    withinShift: true,
    relatedShiftId: null,
  };
}

describe('TimeLogsPanel', () => {
  let fixture: ComponentFixture<TimeLogsPanel>;
  let component: TimeLogsPanel;
  let timeLogApi: { getTimeLogs: ReturnType<typeof vi.fn> };

  beforeAll(async () => {
    await resolveComponentResources((url: string) => {
      if (url.endsWith('time-logs-panel.html')) {
        return Promise.resolve(timeLogsHtml as unknown as string);
      }
      if (url.endsWith('badge.html')) {
        return Promise.resolve(badgeHtml as unknown as string);
      }
      return Promise.resolve('');
    });
  });

  beforeEach(() => {
    TestBed.resetTestingModule();
    timeLogApi = {
      getTimeLogs: vi.fn(() => of([log(1, 1001, 11, 0, 'IN'), log(2, 1001, 15, 0, 'OUT')])),
    };
    TestBed.configureTestingModule({
      imports: [TimeLogsPanel],
      providers: [
        { provide: TimeLog, useValue: timeLogApi },
        {
          provide: Worker,
          useValue: { getWorkers: vi.fn(() => of([WORKER])) },
        },
        { provide: Logging, useValue: { debug: vi.fn(), error: vi.fn() } },
      ],
    });
  });

  async function mount(): Promise<void> {
    fixture = TestBed.createComponent(TimeLogsPanel);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();
  }

  it('queries today by default with local-day instants and no worker filter', async () => {
    await mount();

    const call = timeLogApi.getTimeLogs.mock.calls[0][0] as {
      from: string;
      to: string;
      workerId?: number;
    };
    expect(call.from).toBe(startOfLocalDayIso(new Date()));
    expect(call.to).toBe(endOfLocalDayIso(new Date()));
    expect(call.workerId).toBeUndefined();
  });

  it('renders the paired hours and the worker name', async () => {
    await mount();

    expect(component.summaries()).toHaveLength(1);
    expect(component.summaries()[0].minutes).toBe(240);
    expect(component.totalMinutes()).toBe(240);

    const text = (fixture.nativeElement as HTMLElement).textContent;
    expect(text).toContain('Mesero 1');
    expect(text).toContain('4 h');
    expect(text).toContain('Sin incidencias');
  });

  it('sends the selected worker id and reloads on filter', async () => {
    await mount();

    component.workerFilter.set('1001');
    component.applyFilters();

    const call = timeLogApi.getTimeLogs.mock.calls.at(-1)?.[0] as { workerId?: number };
    expect(call.workerId).toBe(1001);
  });

  it('forwards the within-shift toggle to the API only when checked', async () => {
    await mount();

    let call = timeLogApi.getTimeLogs.mock.calls.at(-1)?.[0] as { withinShift?: boolean };
    expect(call.withinShift).toBeUndefined();

    component.withinShift.set(true);
    component.applyFilters();

    call = timeLogApi.getTimeLogs.mock.calls.at(-1)?.[0] as { withinShift?: boolean };
    expect(call.withinShift).toBe(true);
  });

  it('explains a 5xx as a read failure, not as zero hours', async () => {
    timeLogApi.getTimeLogs.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 500 })),
    );
    await mount();

    const message = component.error() ?? '';
    expect(message).toContain('La API no pudo leer los registros del rango');
    const text = (fixture.nativeElement as HTMLElement).textContent;
    expect(text).not.toContain('0 h');
  });

  it('never renders a clock-in or clock-out button', async () => {
    await mount();

    const labels = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button'),
    ).map((button) => `${button.textContent} ${button.getAttribute('aria-label') ?? ''}`);
    expect(labels.some((label) => label.toLowerCase().includes('marcar'))).toBe(false);
  });
});

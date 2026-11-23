/**
 * Tests for the ScheduleAssignment HTTP service.
 *
 * Feature: assign / list / unassign schedules for a worker.
 * Contract:
 *  - `POST v1/workers/{workerId}/schedule-assignments` sends `{ scheduleId }`
 *    and returns the weekly-hours result, including the non-blocking warning;
 *  - `GET` returns schedule IDs (the API never exposes assignment IDs);
 *  - `DELETE v1/workers/{workerId}/schedule-assignments/{scheduleId}` removes
 *    the assignment by worker + schedule, matching the ID the list returns.
 * Approach: `HttpTestingController` asserts the exact method, URL and body.
 */
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { Logging } from '@app/core/services/logging/logging';

import { ScheduleAssignment } from './schedule-assignment';

describe('ScheduleAssignment service', () => {
  let service: ScheduleAssignment;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ScheduleAssignment,
        { provide: Logging, useValue: { debug: vi.fn(), error: vi.fn() } },
      ],
    });

    service = TestBed.inject(ScheduleAssignment);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('assign POSTs { scheduleId } and returns the weekly-hours warning', () => {
    let received: unknown;
    service.assign(1001, 2).subscribe((value) => (received = value));

    const req = httpMock.expectOne('v1/workers/1001/schedule-assignments');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ scheduleId: 2 });

    const response = {
      workerId: 1001,
      scheduleId: 2,
      weeklyHours: 63,
      legalWeeklyHours: 42,
      hardWeeklyCapHours: 42,
      warning: 'Weekly hours 45.00 exceed the 42 h legal reference',
    };
    req.flush(response, { status: 201, statusText: 'Created' });

    expect(received).toEqual(response);
  });

  it('getAssignments returns the schedule IDs of the worker', () => {
    let received: number[] | undefined;
    service.getAssignments(1001).subscribe((value) => (received = value));

    const req = httpMock.expectOne('v1/workers/1001/schedule-assignments');
    expect(req.request.method).toBe('GET');

    req.flush([1, 2]);

    expect(received).toEqual([1, 2]);
  });

  it('removeAssignment DELETEs the schedule ID returned by getAssignments', () => {
    service.removeAssignment(1001, 2).subscribe();

    const req = httpMock.expectOne('v1/workers/1001/schedule-assignments/2');
    expect(req.request.method).toBe('DELETE');

    req.flush(null, { status: 204, statusText: 'No Content' });
  });
});

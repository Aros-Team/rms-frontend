/**
 * Tests for the worker clock HTTP service.
 *
 * Feature: the authenticated worker marks entry and exit.
 * Contract:
 *  - clock-in and clock-out POST to `v1/workers/me/*`, with no worker id;
 *  - the created time-log entry is returned unchanged;
 *  - a 409 is propagated, not swallowed, so the UI can explain it.
 *
 * Approach: `HttpTestingController` asserts method, URL and body; the error path
 * asserts the raw status reaches the caller.
 */
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { Logging } from '@app/core/services/logging/logging';
import type { TimeLogEntry } from '@app/shared/models/dto/schedules/time-log-entry';

import { WorkerClock } from './worker-clock';

const ENTRY: TimeLogEntry = {
  id: 501,
  workerId: 1001,
  timestamp: '2026-11-22T15:00:00Z',
  type: 'IN',
  withinShift: true,
  relatedShiftId: 10,
};

describe('WorkerClock service', () => {
  let service: WorkerClock;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        WorkerClock,
        { provide: Logging, useValue: { debug: vi.fn(), error: vi.fn() } },
      ],
    });
    service = TestBed.inject(WorkerClock);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('POSTs clock-in for the authenticated worker and returns the entry', () => {
    const next = vi.fn();
    service.clockIn().subscribe(next);

    const request = httpMock.expectOne('v1/workers/me/clock-in');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({});
    request.flush(ENTRY, { status: 201, statusText: 'Created' });

    expect(next).toHaveBeenCalledWith(ENTRY);
  });

  it('POSTs clock-out and propagates a 409', () => {
    const error = vi.fn<(err: HttpErrorResponse) => void>();
    service.clockOut().subscribe({ error });

    const request = httpMock.expectOne('v1/workers/me/clock-out');
    expect(request.request.method).toBe('POST');
    request.flush(
      { detail: 'No open clock-in session exists' },
      { status: 409, statusText: 'Conflict' },
    );

    expect(error).toHaveBeenCalledTimes(1);
    expect(error.mock.calls[0]?.[0].status).toBe(409);
  });
});

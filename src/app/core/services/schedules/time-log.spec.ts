/**
 * Tests for the TimeLog HTTP service.
 *
 * Feature: the admin attendance read with worker, instant range and
 * within-shift filters.
 *
 * Contract:
 *  - `GET v1/admin/time-logs` is the only endpoint;
 *  - `from`/`to` are sent verbatim (ISO-8601 instants, not LocalDate);
 *  - `withinShift` is only sent when it is true, so the default "all" query
 *    stays clean;
 *  - absent filters are omitted instead of sent as `undefined`.
 *
 * Approach: `HttpTestingController` asserts method, URL and each query param.
 */
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { Logging } from '@app/core/services/logging/logging';

import { TimeLog } from './time-log';

describe('TimeLog service', () => {
  let service: TimeLog;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        TimeLog,
        { provide: Logging, useValue: { debug: vi.fn(), error: vi.fn() } },
      ],
    });
    service = TestBed.inject(TimeLog);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('GETs the admin time-log endpoint without empty filters', () => {
    service.getTimeLogs().subscribe();

    const request = httpMock.expectOne('v1/admin/time-logs');
    expect(request.request.method).toBe('GET');
    expect(request.request.params.keys()).toEqual([]);

    request.flush([]);
  });

  it('sends worker, instant range and withinShift when provided', () => {
    service
      .getTimeLogs({
        workerId: 1001,
        from: '2026-11-21T05:00:00.000Z',
        to: '2026-11-22T04:59:59.999Z',
        withinShift: true,
      })
      .subscribe();

    const request = httpMock.expectOne((candidate) => candidate.url === 'v1/admin/time-logs');
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('workerId')).toBe('1001');
    expect(request.request.params.get('from')).toBe('2026-11-21T05:00:00.000Z');
    expect(request.request.params.get('to')).toBe('2026-11-22T04:59:59.999Z');
    expect(request.request.params.get('withinShift')).toBe('true');

    request.flush([]);
  });

  it('does not send withinShift when it is false', () => {
    service.getTimeLogs({ withinShift: false }).subscribe();

    const request = httpMock.expectOne('v1/admin/time-logs');
    expect(request.request.params.has('withinShift')).toBe(false);

    request.flush([]);
  });
});

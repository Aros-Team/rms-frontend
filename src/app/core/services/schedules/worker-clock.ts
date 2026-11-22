import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { Logging } from '@app/core/services/logging/logging';
import type { TimeLogEntry } from '@app/shared/models/dto/schedules/time-log-entry';

/**
 * Clock-in and clock-out for the authenticated worker.
 *
 * Contract:
 *  - `POST v1/workers/me/clock-in` and `clock-out` take no worker id; the API
 *    resolves the worker from the token, so one worker cannot clock for another;
 *  - both return `201` with the created time-log entry;
 *  - a duplicate clock-in or a clock-out without an open session returns `409`;
 *  - there is no current-session read endpoint, so callers must not invent an
 *    "is clocked in" state. Handle the `409` and show what the API returned.
 */
@Injectable({
  providedIn: 'root',
})
export class WorkerClock {
  private http = inject(HttpClient);
  private logger = inject(Logging);

  clockIn(): Observable<TimeLogEntry> {
    this.logger.debug('WorkerClock: POST clock-in');
    return this.http.post<TimeLogEntry>('v1/workers/me/clock-in', {}).pipe(
      tap((entry) => {
        this.logger.debug('WorkerClock: clock-in recorded', entry.id);
      }),
    );
  }

  clockOut(): Observable<TimeLogEntry> {
    this.logger.debug('WorkerClock: POST clock-out');
    return this.http.post<TimeLogEntry>('v1/workers/me/clock-out', {}).pipe(
      tap((entry) => {
        this.logger.debug('WorkerClock: clock-out recorded', entry.id);
      }),
    );
  }
}

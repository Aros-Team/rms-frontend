import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Logging } from '@app/core/services/logging/logging';
import type { ScheduleAssignmentResponse } from '@app/shared/models/dto/schedules/schedule-assignment-response';

@Injectable({ providedIn: 'root' })
export class ScheduleAssignment {
  private http = inject(HttpClient);
  private logger = inject(Logging);

  /**
   * Assigns a whole schedule and returns the server-computed weekly hours.
   *
   * `warning` carries the non-blocking 48 h notice; the client shows it instead
   * of re-implementing the hour rule. Overlaps, duplicates and the 66 h cap are
   * rejected server-side with 409.
   */
  assign(workerId: number, scheduleId: number): Observable<ScheduleAssignmentResponse> {
    const wid = String(workerId);
    const sid = String(scheduleId);
    this.logger.debug('ScheduleAssignment: Calling POST assign worker:', wid, 'schedule:', sid);
    return this.http.post<ScheduleAssignmentResponse>(
      `v1/workers/${wid}/schedule-assignments`,
      { scheduleId },
    );
  }

  getAssignments(workerId: number): Observable<number[]> {
    const wid = String(workerId);
    this.logger.debug('ScheduleAssignment: Calling GET assignments for worker:', wid);
    return this.http.get<number[]>(`v1/workers/${wid}/schedule-assignments`);
  }

  /**
   * Removes the assignment of `scheduleId` from `workerId`.
   *
   * The API lists assignments as schedule IDs and deletes by
   * `workerId` + `scheduleId`; assignment IDs are never exposed.
   */
  removeAssignment(workerId: number, scheduleId: number): Observable<unknown> {
    const wid = String(workerId);
    const sid = String(scheduleId);
    this.logger.debug('ScheduleAssignment: Calling DELETE schedule:', sid, 'for worker:', wid);
    return this.http.delete<unknown>(`v1/workers/${wid}/schedule-assignments/${sid}`);
  }
}

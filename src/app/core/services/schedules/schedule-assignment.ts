import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Logging } from '@app/core/services/logging/logging';

@Injectable({ providedIn: 'root' })
export class ScheduleAssignment {
  private http = inject(HttpClient);
  private logger = inject(Logging);

  assign(workerId: number, scheduleId: number): Observable<unknown> {
    const wid = String(workerId);
    const sid = String(scheduleId);
    this.logger.debug('ScheduleAssignment: Calling POST assign worker:', wid, 'schedule:', sid);
    return this.http.post<unknown>(`v1/workers/${wid}/schedule-assignments`, { scheduleId });
  }

  getAssignments(workerId: number): Observable<number[]> {
    const wid = String(workerId);
    this.logger.debug('ScheduleAssignment: Calling GET assignments for worker:', wid);
    return this.http.get<number[]>(`v1/workers/${wid}/schedule-assignments`);
  }

  removeAssignment(workerId: number, assignmentId: number): Observable<unknown> {
    const wid = String(workerId);
    const aid = String(assignmentId);
    this.logger.debug('ScheduleAssignment: Calling DELETE assignment:', aid, 'for worker:', wid);
    return this.http.delete<unknown>(`v1/workers/${wid}/schedule-assignments/${aid}`);
  }
}

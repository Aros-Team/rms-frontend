import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Logging } from '@app/core/services/logging/logging';
import { WorkerScheduleResponse } from '@app/shared/models/dto/schedules/worker-schedule-response.model';

@Injectable({ providedIn: 'root' })
export class WorkerSchedule {
  private http = inject(HttpClient);
  private logger = inject(Logging);

  getMySchedule(): Observable<WorkerScheduleResponse> {
    this.logger.debug('WorkerSchedule: Calling GET my schedule');
    return this.http.get<WorkerScheduleResponse>('v1/workers/me/schedule');
  }
}

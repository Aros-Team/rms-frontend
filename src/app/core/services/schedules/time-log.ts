import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Logging } from '@app/core/services/logging/logging';
import { TimeLogEntry } from '@app/shared/models/dto/schedules/time-log-entry.model';

export interface TimeLogFilterParams {
  workerId?: number;
  from?: string;
  to?: string;
}

@Injectable({ providedIn: 'root' })
export class TimeLog {
  private http = inject(HttpClient);
  private logger = inject(Logging);

  getTimeLogs(params?: TimeLogFilterParams): Observable<TimeLogEntry[]> {
    this.logger.debug('TimeLog: Calling GET time-logs');

    let httpParams = new HttpParams();
    if (params?.workerId !== undefined) {
      httpParams = httpParams.set('workerId', params.workerId.toString());
    }
    if (params?.from) {
      httpParams = httpParams.set('from', params.from);
    }
    if (params?.to) {
      httpParams = httpParams.set('to', params.to);
    }

    return this.http.get<TimeLogEntry[]>('v1/admin/time-logs', { params: httpParams });
  }
}

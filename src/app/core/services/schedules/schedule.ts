import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Logging } from '@app/core/services/logging/logging';
import { Schedule as ScheduleModel } from '@app/shared/models/dto/schedules/schedule.model';
import { CreateScheduleRequest } from '@app/shared/models/dto/schedules/create-schedule-request.model';

@Injectable({ providedIn: 'root' })
export class Schedule {
  private http = inject(HttpClient);
  private logger = inject(Logging);

  getAll(): Observable<ScheduleModel[]> {
    this.logger.debug('Schedule: Calling GET schedules');
    return this.http.get<ScheduleModel[]>('v1/schedules');
  }

  getById(id: number): Observable<ScheduleModel> {
    this.logger.debug('Schedule: Calling GET schedule by id:', id);
    return this.http.get<ScheduleModel>(`v1/schedules/${String(id)}`);
  }

  create(data: CreateScheduleRequest): Observable<ScheduleModel> {
    this.logger.debug('Schedule: Calling POST schedule');
    return this.http.post<ScheduleModel>('v1/schedules', data);
  }

  update(id: number, data: CreateScheduleRequest): Observable<ScheduleModel> {
    this.logger.debug('Schedule: Calling PUT schedule id:', id);
    return this.http.put<ScheduleModel>(`v1/schedules/${String(id)}`, data);
  }

  delete(id: number): Observable<unknown> {
    this.logger.debug('Schedule: Calling DELETE schedule id:', id);
    return this.http.delete<unknown>(`v1/schedules/${String(id)}`);
  }
}

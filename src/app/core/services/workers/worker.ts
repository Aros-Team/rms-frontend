import { HttpClient, HttpParams } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { CreateWorkerRequest } from "@app/shared/models/dto/workers/create-worker-request";
import { SalaryHistoryEntry } from "@app/shared/models/dto/workers/salary-history-entry";
import { UpdateWorkerRequest, WorkerResponse } from "@app/shared/models/dto/workers/worker-response";
import { UserRegisterResponse } from "@app/shared/models/dto/workers/user-register-response";
import { Observable } from "rxjs";
import { Logging } from '@app/core/services/logging/logging';


@Injectable({
  providedIn: 'root',
})
export class Worker {
  private http = inject(HttpClient);
  private logger = inject(Logging);

  public getWorkers(search?: string): Observable<WorkerResponse[]> {
    this.logger.debug('Worker: Calling GET workers');
    let params = new HttpParams();
    if (search && search.trim() !== '') {
      params = params.set('search', search.trim());
    }
    return this.http.get<WorkerResponse[]>('v1/workers', { params });
  }

  public createWorker(data: CreateWorkerRequest): Observable<UserRegisterResponse> {
    this.logger.debug('Worker: Calling POST workers with data:', data);
    return this.http.post<UserRegisterResponse>('v1/workers', data);
  }

  public updateAreaActivities(id: number, areaActivities: Record<string, string[]>): Observable<unknown> {
    return this.http.put<unknown>(`v1/workers/${String(id)}/area-activities`, { areaActivities });
  }

  public updateWorker(id: number, data: UpdateWorkerRequest): Observable<WorkerResponse> {
    this.logger.debug('Worker: Calling PUT workers with id:', id, 'data:', data);
    return this.http.put<WorkerResponse>(`v1/workers/${String(id)}`, data);
  }

  public getSalaryHistory(workerId: number): Observable<SalaryHistoryEntry[]> {
    this.logger.debug('Worker: Calling GET salary-history with id:', workerId);
    return this.http.get<SalaryHistoryEntry[]>(`v1/workers/${String(workerId)}/salary-history`);
  }

  public deleteWorker(id: number): Observable<unknown> {
    this.logger.debug('Worker: Calling DELETE workers with id:', id);
    return this.http.delete<unknown>(`v1/workers/${String(id)}`);
  }

  public retrySetupEmail(id: number): Observable<unknown> {
    this.logger.debug('Worker: Calling POST retry-setup-email with id:', id);
    return this.http.post<unknown>(`v1/workers/${String(id)}/retry-setup-email`, {});
  }
}

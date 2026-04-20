import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { CreateUserRequest } from "@app/shared/models/dto/users/create-user-request.model";
import { UpdateUserRequest, UserResponse } from "@app/shared/models/dto/users/user-response.model";
import { Observable } from "rxjs";
import { LoggingService } from '@app/core/services/logging/logging-service';


@Injectable({
  providedIn: 'root',
})
export class UserService {
  private http = inject(HttpClient);
  private loggingService = inject(LoggingService);

  public getUsers(): Observable<UserResponse[]> {
    this.loggingService.debug('UserService: Calling GET users');
    return this.http.get<UserResponse[]>('v1/users');
  }

  public createUser(data: CreateUserRequest): Observable<UserResponse> {
    this.loggingService.debug('UserService: Calling POST users with data:', data);
    return this.http.post<UserResponse>('v1/users', data);
  }

  public updateUser(id: number, data: UpdateUserRequest): Observable<UserResponse> {
    this.loggingService.debug('UserService: Calling PUT users with id:', id, 'data:', data);
    return this.http.put<UserResponse>(`v1/users/${id}`, data);
  }

  public deleteUser(id: number): Observable<void> {
    this.loggingService.debug('UserService: Calling DELETE users with id:', id);
    return this.http.delete<void>(`v1/users/${id}`);
  }

  public retryEmail(id: number): Observable<void> {
    this.loggingService.debug('UserService: Calling POST retry-email with id:', id);
    return this.http.post<void>(`v1/users/${id}/retry-email`, {});
  }
}

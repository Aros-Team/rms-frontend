import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { CreateUserRequest } from "@app/shared/models/dto/users/create-user-request.model";
import { UpdateUserRequest, UserResponse } from "@app/shared/models/dto/users/user-response.model";
import { Observable } from "rxjs";
import { Logging } from '@app/core/services/logging/logging';


@Injectable({
  providedIn: 'root',
})
export class User {
  private http = inject(HttpClient);
  private logger = inject(Logging);

  public getUsers(): Observable<UserResponse[]> {
    this.logger.debug('User: Calling GET users');
    return this.http.get<UserResponse[]>('v1/users');
  }

  public createUser(data: CreateUserRequest): Observable<UserResponse> {
    this.logger.debug('User: Calling POST users with data:', data);
    return this.http.post<UserResponse>('v1/users', data);
  }

  public updateUser(id: number, data: UpdateUserRequest): Observable<UserResponse> {
    this.logger.debug('User: Calling PUT users with id:', id, 'data:', data);
    return this.http.put<UserResponse>(`v1/users/${id}`, data);
  }

  public deleteUser(id: number): Observable<void> {
    this.logger.debug('User: Calling DELETE users with id:', id);
    return this.http.delete<void>(`v1/users/${id}`);
  }

  public retryEmail(id: number): Observable<void> {
    this.logger.debug('User: Calling POST retry-setup-email with id:', id);
    return this.http.post<void>(`v1/users/${id}/retry-setup-email`, {});
  }
}
import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { CreateUserRequest } from "@app/shared/models/dto/users/create-user-request.model";
import { UserResponse } from "@app/shared/models/dto/users/user-response.model";
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

  public createUser(data: CreateUserRequest): Observable<object> {
    this.loggingService.debug('UserService: Calling POST users with data:', data);
    return this.http.post('v1/users', data);
  }
}

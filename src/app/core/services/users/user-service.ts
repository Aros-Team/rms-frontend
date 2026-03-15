import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { CreateUserRequest } from "@app/shared/models/dto/users/create-user-request.model";
import { UserResponse } from "@app/shared/models/dto/users/user-response.model";
import { Observable } from "rxjs";


@Injectable({
  providedIn: 'root',
})
export class UserService {
  private http = inject(HttpClient);

  public getUsers(): Observable<UserResponse[]> {
    console.log('UserService: Calling GET users');
    return this.http.get<UserResponse[]>('users');
  }

  public createUser(data: CreateUserRequest): Observable<object> {
    console.log('UserService: Calling POST users with data:', data);
    return this.http.post('users', data);
  }

  public updateUser(data: CreateUserRequest): Observable<object> {
    return this.http.put(`users/${data.document}`, data);
  }

  public deleteUser(document: string): Observable<object> {
    return this.http.delete(`users/${document}`);
  }
}

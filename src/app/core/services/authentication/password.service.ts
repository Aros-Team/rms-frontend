import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class PasswordService {
  private http = inject(HttpClient);

  forgotPassword(email: string): Observable<void> {
    return this.http.post<void>('v1/auth/forgot-password', { username: email });
  }

  resetPassword(token: string, newPassword: string): Observable<void> {
    return this.http.post<void>('v1/auth/reset-password', { 
      token, 
      newPassword 
    });
  }

  changePassword(currentPassword: string, newPassword: string): Observable<void> {
    return this.http.put<void>('v1/users/me/password', {
      currentPassword,
      newPassword
    });
  }
}

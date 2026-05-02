import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class Password {
  private http = inject(HttpClient);

  forgotPassword(email: string): Observable<void> {
    return this.http.post<void>('auth/forgot-password', { email });
  }

  resetPassword(token: string, newPassword: string): Observable<void> {
    return this.http.post<void>('auth/reset-password', { 
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
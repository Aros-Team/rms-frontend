import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class Password {
  private http = inject(HttpClient);

  forgotPassword(email: string): Observable<unknown> {
    return this.http.post('auth/forgot-password', { email });
  }

  resetPassword(token: string, newPassword: string): Observable<unknown> {
    return this.http.post('auth/reset-password', {
      token,
      newPassword
    });
  }

  changePassword(currentPassword: string, newPassword: string): Observable<unknown> {
    return this.http.put('v1/users/me/password', {
      currentPassword,
      newPassword
    });
  }
}
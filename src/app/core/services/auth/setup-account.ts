import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { SetupAccountResponse } from '@models/dto/auth/setup-account-response.model';
import { SetupPasswordRequest } from '@models/dto/auth/setup-password-request.model';
import { Logging } from '@app/core/services/logging/logging';

@Injectable({
  providedIn: 'root',
})
export class SetupAccount {
  private http = inject(HttpClient);
  private logger = inject(Logging);

  validateToken(token: string): Observable<SetupAccountResponse> {
    this.logger.auth('Validating setup token');
    return this.http.get<SetupAccountResponse>(`auth/setup-account/validate?token=${token}`);
  }

  setupPassword(data: SetupPasswordRequest): Observable<unknown> {
    this.logger.auth('Setting up password for account');
    return this.http.post('auth/setup-password', data);
  }
}
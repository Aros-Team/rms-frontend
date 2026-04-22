import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { SetupAccountResponse } from '@models/dto/auth/setup-account-response.model';
import { SetupPasswordRequest } from '@models/dto/auth/setup-password-request.model';
import { LoggingService } from '@app/core/services/logging/logging-service';

@Injectable({
  providedIn: 'root',
})
export class SetupAccountService {
  private http = inject(HttpClient);
  private loggingService = inject(LoggingService);

  validateToken(token: string): Observable<SetupAccountResponse> {
    this.loggingService.auth('Validating setup token');
    return this.http.get<SetupAccountResponse>(`auth/setup-account/validate?token=${token}`);
  }

  setupPassword(data: SetupPasswordRequest): Observable<void> {
    this.loggingService.auth('Setting up password for account');
    return this.http.post<void>('auth/setup-password', data);
  }
}

import { Component, inject, signal } from '@angular/core';

import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { MessageService } from 'primeng/api';
import { AuthService } from '@services/authentication/auth-service';
import { LoggingService } from '@app/core/services/logging/logging-service';

@Component({
  selector: 'app-two-factor-verify',
  templateUrl: './two-factor-verify.component.html',
  imports: [
    ReactiveFormsModule,
    InputTextModule,
    ButtonModule,
    MessageModule
],
})
export class TwoFactorVerifyComponent {
  private authService = inject(AuthService);
  private router = inject(Router);
  private messageService = inject(MessageService);
  private loggingService = inject(LoggingService);

  form: FormGroup = new FormGroup({
    code: new FormControl('', [Validators.required, Validators.minLength(6), Validators.maxLength(6)]),
  });

  formStatus: 'Free' | 'Occuped' = 'Free';
  errorMessage: string | null = null;

  onSubmit() {
    this.loggingService.auth('TwoFactorVerify form submitted');
    this.formStatus = 'Occuped';
    this.errorMessage = null;

    const code = this.form.get('code')?.value;

    this.authService.verifyTwoFactor(code).subscribe({
      next: () => {
        this.loggingService.auth('2FA verification successful, redirecting based on user role');
        this.redirectBasedOnUserRole();
        this.formStatus = 'Free';
      },
      error: (err: { status?: number; error?: { message?: string } }) => {
        this.loggingService.error('2FA verification failed:', err);
        this.formStatus = 'Free';
        const backendMessage = err.error?.message;
        this.errorMessage = backendMessage || 'Código inválido o expirado. Por favor, intenta nuevamente.';

        if (err.status === 400) {
          this.errorMessage = backendMessage || 'Código inválido. Verifica el código enviado a tu correo.';
        } else if (err.status === 401) {
          this.errorMessage = backendMessage || 'Código expirado. Por favor, inicia sesión nuevamente.';
        }
      },
    });
  }

  isInvalid(value: string): boolean {
    return this.form.get(value)!.invalid && this.form.get(value)!.touched;
  }

  goBack(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  private redirectBasedOnUserRole(): void {
    const userData = this.authService.getData();
    this.loggingService.auth('redirectBasedOnUserRole called - user data:', userData);

    if (userData) {
      const isAdmin = userData.role === 'ADMIN';
      this.loggingService.auth('User role determined - isAdmin:', isAdmin);

      if (isAdmin) {
        this.loggingService.routing('Redirecting admin user to /admin');
        this.router.navigate(['/admin']);
      } else {
        this.loggingService.routing('Redirecting worker user to /worker');
        this.router.navigate(['/worker']);
      }
    } else {
      this.loggingService.debug('User data not available yet, retrying in 100ms');
      setTimeout(() => this.redirectBasedOnUserRole(), 100);
    }
  }
}
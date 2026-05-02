import { Component, inject } from '@angular/core';

import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { MessageService } from 'primeng/api';
import { Auth } from '@services/auth/auth';
import { Logging } from '@app/core/services/logging/logging';

@Component({
  selector: 'app-two-factor-verify',
  imports: [
    ReactiveFormsModule,
    InputTextModule,
    ButtonModule,
    MessageModule
  ],
  templateUrl: './two-factor-verify.html',
  styleUrl: './two-factor-verify.css',
})
export class TwoFactorVerify {
  private authService = inject(Auth);
  private router = inject(Router);
  private messageService = inject(MessageService);
  private logger = inject(Logging);

  form: FormGroup = new FormGroup({
    code: new FormControl('', [Validators.required, Validators.minLength(6), Validators.maxLength(6)]),
  });

  formStatus: 'Free' | 'Occuped' = 'Free';
  errorMessage: string | null = null;

  onSubmit() {
    this.logger.auth('TwoFactorVerify form submitted');
    this.formStatus = 'Occuped';
    this.errorMessage = null;

    const code = this.form.get('code')?.value;

    this.authService.verifyTwoFactor(code).subscribe({
      next: () => {
        this.logger.auth('2FA verification successful, redirecting based on user role');
        this.redirectBasedOnUserRole();
        this.formStatus = 'Free';
      },
      error: (err: { status?: number; error?: { message?: string } }) => {
        this.logger.error('2FA verification failed:', err);
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
    this.logger.auth('redirectBasedOnUserRole called - user data:', userData);

    if (userData) {
      if (userData.role === 'ADMIN') {
        this.logger.routing('Redirecting admin user to /admin');
        this.router.navigate(['/admin']);
      } else {
        // Worker - check first area type
        const firstArea = userData.areas?.[0];

        if (firstArea?.type === 'KITCHEN') {
          this.logger.routing('Redirecting kitchen worker to /worker/kitchen');
          this.router.navigate(['/worker/kitchen']);
        } else {
          // WAITER or no area - default to waiter
          this.logger.routing('Redirecting waiter worker to /worker/waiter');
          this.router.navigate(['/worker/waiter']);
        }
      }
    } else {
      this.logger.debug('User data not available yet, retrying in 100ms');
      setTimeout(() => this.redirectBasedOnUserRole(), 100);
    }
  }
}
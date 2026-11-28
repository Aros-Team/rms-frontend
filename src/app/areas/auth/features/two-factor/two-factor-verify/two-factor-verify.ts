import { Component, inject, signal } from '@angular/core';

import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { Auth } from '@services/auth/auth';
import { Logging } from '@app/core/services/logging/logging';
import { UserInfo } from '@models/domain/user/user-info';
import { userActivities } from '@app/core/config/navigation/role-navigation';
import { extractProblemDetail } from '@app/shared/lib/problem-detail/problem-detail';
import { RmsButton } from '@shared/ui/button/button';
import { RmsInput } from '@shared/ui/input/input';

@Component({
  selector: 'app-two-factor-verify',
  imports: [ReactiveFormsModule, RmsButton, RmsInput],
  templateUrl: './two-factor-verify.html',
  styleUrl: './two-factor-verify.css',
})
export class TwoFactorVerify {
  private authService = inject(Auth);
  private router = inject(Router);
  private messageService = inject(MessageService);
  private logger = inject(Logging);

  /* eslint-disable typescript/unbound-method -- Validators.x are static, there is no `this` to bind */
  form: FormGroup = new FormGroup({
    code: new FormControl('', [
      Validators.required,
      Validators.minLength(6),
      Validators.maxLength(6),
    ]),
  });
  /* eslint-enable typescript/unbound-method */

  formStatus = signal<'Free' | 'Occuped'>('Free');
  errorMessage: string | null = null;

  onSubmit() {
    this.logger.auth('TwoFactorVerify form submitted');
    this.formStatus.set('Occuped');
    this.errorMessage = null;

    const code = (this.form.get('code')?.value as string | null | undefined) ?? '';

    this.authService.verifyTwoFactor(code).subscribe({
      next: (response: UserInfo | { type: string }) => {
        const userInfo = response as UserInfo;
        this.logger.auth('2FA verification successful, redirecting based on user role');
        this.redirectBasedOnUserRole(userInfo);
        this.formStatus.set('Free');
      },
      error: (err: { status?: number; error?: unknown }) => {
        this.logger.error('2FA verification failed:', err);
        this.formStatus.set('Free');
        // The API reports the reason in the RFC-7807 `detail`.
        const backendMessage = extractProblemDetail(err);
        this.errorMessage =
          backendMessage ?? 'Código inválido o expirado. Por favor, intenta nuevamente.';

        if (err.status === 400) {
          this.errorMessage =
            backendMessage ?? 'Código inválido. Verifica el código enviado a tu correo.';
        } else if (err.status === 401) {
          this.errorMessage =
            backendMessage ?? 'Código expirado. Por favor, inicia sesión nuevamente.';
        }
      },
    });
  }

  isInvalid(value: string): boolean {
    const control = this.form.get(value);
    return control !== null && control.invalid && control.touched;
  }

  get codeError(): string {
    if (!this.isInvalid('code')) {
      return '';
    }
    const errors = this.form.get('code')?.errors;
    if (errors?.['required']) {
      return 'Campo requerido';
    }
    if (errors?.['minlength'] || errors?.['maxlength']) {
      return 'Ingresa el código de 6 dígitos';
    }
    return 'Revisa este campo';
  }

  goBack(): void {
    this.authService.logout();
    void this.router.navigate(['/login']);
  }

  private redirectBasedOnUserRole(userData: UserInfo): void {
    this.logger.auth('redirectBasedOnUserRole - user data:', userData);
    if (userData.role === 'ADMIN') {
      this.logger.routing('Redirecting admin user to /admin');
      void this.router.navigate(['/admin']);
    } else {
      const activities = userActivities(userData);
      if (activities.includes('PREPARATION')) {
        void this.router.navigate(['/worker/kitchen']);
      } else if (activities.includes('CASH')) {
        void this.router.navigate(['/worker/cashier']);
      } else {
        void this.router.navigate(['/worker/waiter']);
      }
    }
  }
}

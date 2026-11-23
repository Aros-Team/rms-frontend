import { Component, inject, signal, OnInit } from '@angular/core';

import { FormControl, FormGroup, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { NgClass } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { PasswordModule } from 'primeng/password';
import { MessageModule } from 'primeng/message';
import { MessageService } from 'primeng/api';
import { Password } from '@app/core/services/auth/password';
import { Logging } from '@app/core/services/logging/logging';
import { extractProblemDetail } from '@app/shared/lib/problem-detail/problem-detail';
import { RmsButton } from '@shared/ui/button/button';
import {
  hasLowerCase,
  hasMinPasswordLength,
  hasNumber,
  hasSymbol,
  hasUpperCase,
} from '@app/shared/lib/password-policy/password-policy';

function passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
  const newPassword = control.get('newPassword')?.value as string;
  const confirmPassword = control.get('confirmPassword')?.value as string;
  return newPassword === confirmPassword ? null : { mismatch: true };
}

@Component({
  selector: 'app-reset-password',
  templateUrl: './reset-password.html',
  styleUrls: ['./reset-password.css'],
  imports: [
    ReactiveFormsModule,
    NgClass,
    PasswordModule,
    MessageModule,
    RmsButton,
  ],
})
export class ResetPassword implements OnInit {
  private passwordService = inject(Password);
  private messageService = inject(MessageService);
  private logger = inject(Logging);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  loading = signal(false);
  error = signal<string | null>(null);
  success = signal(false);

  token = signal<string | null>(null);

  form: FormGroup = new FormGroup({
    newPassword: new FormControl<string>('', [(control) => Validators.required(control)]),
    confirmPassword: new FormControl<string>('', [(control) => Validators.required(control)])
  }, { validators: (control) => passwordMatchValidator(control) });

  checkPasswordRequirement(requirement: string): boolean {
    const password = (this.form.get('newPassword')?.value as string | null | undefined) ?? '';
    switch (requirement) {
      case 'minLength': return hasMinPasswordLength(password);
      case 'upperCase': return hasUpperCase(password);
      case 'lowerCase': return hasLowerCase(password);
      case 'number': return hasNumber(password);
      case 'symbol': return hasSymbol(password);
      default: return false;
    }
  }

  isInvalid(field: string): boolean {
    const control = this.form.get(field);
    return control !== null && control.invalid && control.touched;
  }

  get newPasswordError(): string {
    if (!this.isInvalid('newPassword')) {
      return '';
    }
    return this.form.get('newPassword')?.errors?.['required']
      ? 'Campo requerido'
      : 'Revisa este campo';
  }

  get confirmPasswordError(): string {
    if (!this.isInvalid('confirmPassword')) {
      return '';
    }
    if (this.form.get('confirmPassword')?.errors?.['required']) {
      return 'Campo requerido';
    }
    if (this.form.errors?.['mismatch']) {
      return 'Las contraseñas no coinciden';
    }
    return 'Revisa este campo';
  }

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      const token = params['token'] as string | null;
      this.token.set(token);
    });
  }

  onSubmit(): void {
    const token = this.token();
    if (!token) {
      this.error.set('El enlace de recuperación es inválido. Por favor, solicita un nuevo código.');
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    const newPassword = this.form.get('newPassword')?.value as string;

    void this.passwordService.resetPassword(token, newPassword).subscribe({
      next: () => {
        this.loading.set(false);
        this.success.set(true);
        this.messageService.add({
          severity: 'success',
          summary: 'Éxito',
          detail: 'Tu contraseña ha sido restablecida'
        });
      },
      error: (err: { status?: number; error?: unknown }) => {
        this.loading.set(false);
        const problemDetail = extractProblemDetail(err);
        if (err.status === 400 || err.status === 422) {
          this.error.set(
            problemDetail ?? 'Token inválido o expirado. Por favor, solicita un nuevo código.',
          );
        } else {
          this.error.set(problemDetail ?? 'Ocurrió un error. Por favor, intenta más tarde.');
        }
        this.logger.error('Reset password failed', err);
      }
    });
  }

  goToLogin(): void {
    void this.router.navigate(['/login']);
  }
}
import { Component, inject, signal, OnInit } from '@angular/core';

import { FormControl, FormGroup, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { PasswordModule } from 'primeng/password';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { MessageService } from 'primeng/api';
import { PasswordService } from '@app/core/services/authentication/password.service';
import { LoggingService } from '@app/core/services/logging/logging-service';

function passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
  const newPassword = control.get('newPassword')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;
  return newPassword === confirmPassword ? null : { mismatch: true };
}

@Component({
  selector: 'app-reset-password',
  templateUrl: './reset-password.component.html',
  imports: [
    ReactiveFormsModule,
    PasswordModule,
    InputTextModule,
    ButtonModule,
    MessageModule
  ],
})
export class ResetPasswordComponent implements OnInit {
  private passwordService = inject(PasswordService);
  private messageService = inject(MessageService);
  private loggingService = inject(LoggingService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  loading = signal(false);
  error = signal<string | null>(null);
  success = signal(false);

  token = signal<string | null>(null);

  form: FormGroup = new FormGroup({
    newPassword: new FormControl('', [Validators.required, Validators.minLength(6)]),
    confirmPassword: new FormControl('', [Validators.required])
  }, { validators: passwordMatchValidator });

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      const token = params['token'];
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

    const newPassword = this.form.get('newPassword')?.value;

    this.passwordService.resetPassword(token, newPassword).subscribe({
      next: () => {
        this.loading.set(false);
        this.success.set(true);
        this.messageService.add({
          severity: 'success',
          summary: 'Éxito',
          detail: 'Tu contraseña ha sido restablecida'
        });
      },
      error: (err) => {
        this.loading.set(false);
        if (err.status === 400) {
          this.error.set('Token inválido o expirado. Por favor, solicita un nuevo código.');
        } else {
          this.error.set('Ocurrió un error. Por favor, intenta más tarde.');
        }
        this.loggingService.error('Reset password failed', err);
      }
    });
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }
}
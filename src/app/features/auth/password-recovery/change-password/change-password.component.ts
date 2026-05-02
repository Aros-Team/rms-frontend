import { Component, inject, signal } from '@angular/core';

import { FormControl, FormGroup, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { NgClass } from '@angular/common';
import { PasswordModule } from 'primeng/password';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { MessageService } from 'primeng/api';
import { PasswordService } from '@app/core/services/authentication/password.service';
import { AuthService } from '@app/core/services/authentication/auth-service';
import { LoggingService } from '@app/core/services/logging/logging-service';

function passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
  const newPassword = control.get('newPassword')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;
  return newPassword === confirmPassword ? null : { mismatch: true };
}

@Component({
  selector: 'app-change-password',
  templateUrl: './change-password.component.html',
  styleUrls: ['./change-password.component.css'],
  imports: [
    ReactiveFormsModule,
    NgClass,
    PasswordModule,
    InputTextModule,
    ButtonModule,
    MessageModule
  ],
})
export class ChangePasswordComponent {
  private passwordService = inject(PasswordService);
  private authService = inject(AuthService);
  private messageService = inject(MessageService);
  private loggingService = inject(LoggingService);

  loading = signal(false);
  error = signal<string | null>(null);
  success = signal(false);

  form: FormGroup = new FormGroup({
    currentPassword: new FormControl('', [Validators.required]),
    newPassword: new FormControl('', [Validators.required]),
    confirmPassword: new FormControl('', [Validators.required])
  }, { validators: passwordMatchValidator });

  checkPasswordRequirement(requirement: string): boolean {
    const password = this.form.get('newPassword')?.value || '';
    switch (requirement) {
      case 'minLength': return password.length >= 8;
      case 'upperCase': return /[A-Z]/.test(password);
      case 'lowerCase': return /[a-z]/.test(password);
      case 'number': return /\d/.test(password);
      case 'symbol': return /[@$!%*?&]/.test(password);
      default: return false;
    }
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.success.set(false);

    const currentPassword = this.form.get('currentPassword')?.value;
    const newPassword = this.form.get('newPassword')?.value;

    this.passwordService.changePassword(currentPassword, newPassword).subscribe({
      next: () => {
        this.loading.set(false);
        this.success.set(true);
        this.messageService.add({
          severity: 'success',
          summary: 'Éxito',
          detail: 'Tu contraseña ha sido actualizada'
        });
        this.form.reset();
      },
      error: (err) => {
        this.loading.set(false);
        if (err.status === 400) {
          this.error.set('La contraseña actual es incorrecta');
        } else {
          this.error.set('Ocurrió un error al cambiar la contraseña');
        }
        this.loggingService.error('Change password failed', err);
      }
    });
  }
}
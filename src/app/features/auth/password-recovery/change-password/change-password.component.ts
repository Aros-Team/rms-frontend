import { Component, inject, signal } from '@angular/core';

import { FormControl, FormGroup, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
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
  imports: [
    ReactiveFormsModule,
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
    newPassword: new FormControl('', [Validators.required, Validators.minLength(6)]),
    confirmPassword: new FormControl('', [Validators.required])
  }, { validators: passwordMatchValidator });

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
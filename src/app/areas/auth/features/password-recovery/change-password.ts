import { Component, inject, signal } from '@angular/core';

import { FormControl, FormGroup, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { NgClass } from '@angular/common';
import { PasswordModule } from 'primeng/password';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { MessageService } from 'primeng/api';
import { Password } from '@app/core/services/auth/password';
import { Auth } from '@app/core/services/auth/auth';
import { Logging } from '@app/core/services/logging/logging';

const passwordMatchValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const newPassword = String(control.get('newPassword')?.value ?? '');
  const confirmPassword = String(control.get('confirmPassword')?.value ?? '');
  return newPassword === confirmPassword ? null : { mismatch: true };
};

@Component({
  selector: 'app-change-password',
  templateUrl: './change-password.html',
  styleUrls: ['./change-password.css'],
  imports: [
    ReactiveFormsModule,
    NgClass,
    PasswordModule,
    InputTextModule,
    ButtonModule,
    MessageModule
  ],
})
export class ChangePassword {
  private passwordService = inject(Password);
  private authService = inject(Auth);
  private messageService = inject(MessageService);
  private logger = inject(Logging);

  loading = signal(false);
  error = signal<string | null>(null);
  success = signal(false);

  form: FormGroup = new FormGroup({
    currentPassword: new FormControl<string>('', [(control: AbstractControl) => Validators.required(control)]),
    newPassword: new FormControl<string>('', [(control: AbstractControl) => Validators.required(control)]),
    confirmPassword: new FormControl<string>('', [(control: AbstractControl) => Validators.required(control)])
  }, { validators: passwordMatchValidator });

  checkPasswordRequirement(requirement: string): boolean {
    const password = String(this.form.get('newPassword')?.value ?? '');
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

    const currentPassword = String(this.form.get('currentPassword')?.value ?? '');
    const newPassword = String(this.form.get('newPassword')?.value ?? '');

    void this.passwordService.changePassword(currentPassword, newPassword).subscribe({
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
      error: (err: unknown) => {
        this.loading.set(false);
        const status = typeof err === 'object' && err !== null && 'status' in err ? (err as { status: number }).status : 0;
        if (status === 400) {
          this.error.set('La contraseña actual es incorrecta');
        } else {
          this.error.set('Ocurrió un error al cambiar la contraseña');
        }
        this.logger.error('Change password failed', err);
      }
    });
  }
}

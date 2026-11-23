import { Component, inject, signal, Input, Output, EventEmitter } from '@angular/core';

import { FormControl, FormGroup, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { NgClass } from '@angular/common';
import { DialogModule } from 'primeng/dialog';
import { PasswordModule } from 'primeng/password';
import { MessageModule } from 'primeng/message';
import { MessageService } from 'primeng/api';
import { Password } from '@app/core/services/auth/password';
import { Auth } from '@app/core/services/auth/auth';
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

const passwordMatchValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const newPassword = String(control.get('newPassword')?.value ?? '');
  const confirmPassword = String(control.get('confirmPassword')?.value ?? '');
  return newPassword === confirmPassword ? null : { mismatch: true };
};

@Component({
  selector: 'app-change-password',
  templateUrl: './change-password.html',
  imports: [
    ReactiveFormsModule,
    NgClass,
    DialogModule,
    PasswordModule,
    MessageModule,
    RmsButton,
  ],
})
export class ChangePassword {
  private passwordService = inject(Password);
  private authService = inject(Auth);
  private messageService = inject(MessageService);
  private logger = inject(Logging);

  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() passwordChanged = new EventEmitter<void>();

  loading = signal(false);
  error = signal<string | null>(null);
  success = signal(false);

  form: FormGroup = new FormGroup({
    currentPassword: new FormControl<string>('', [(control: AbstractControl) => Validators.required(control)]),
    newPassword: new FormControl<string>('', [(control: AbstractControl) => Validators.required(control)]),
    confirmPassword: new FormControl<string>('', [(control: AbstractControl) => Validators.required(control)])
  }, { validators: passwordMatchValidator });

  closeDialog(): void {
    this.visible = false;
    this.visibleChange.emit(false);
  }

  onDialogHide(): void {
    this.closeDialog();
  }

  checkPasswordRequirement(requirement: string): boolean {
    const password = String(this.form.get('newPassword')?.value ?? '');
    switch (requirement) {
      case 'minLength': return hasMinPasswordLength(password);
      case 'upperCase': return hasUpperCase(password);
      case 'lowerCase': return hasLowerCase(password);
      case 'number': return hasNumber(password);
      case 'symbol': return hasSymbol(password);
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
        this.passwordChanged.emit();
      },
      error: (err: unknown) => {
        this.loading.set(false);
        const status = typeof err === 'object' && err !== null && 'status' in err ? (err as { status: number }).status : 0;
        const problemDetail = extractProblemDetail(err);
        if (status === 400 || status === 401 || status === 422) {
          this.error.set(problemDetail ?? 'La contraseña actual es incorrecta');
        } else {
          this.error.set(problemDetail ?? 'Ocurrió un error al cambiar la contraseña');
        }
        this.logger.error('Change password failed', err);
      }
    });
  }
}

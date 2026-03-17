import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
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
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    PasswordModule,
    InputTextModule,
    ButtonModule,
    MessageModule
  ],
  template: `
    <div class="bg-white dark:bg-surface-800 rounded-xl p-6 shadow-sm border border-surface-200 dark:border-surface-700">
      <h2 class="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-4">
        Cambiar Contraseña
      </h2>

      @if (success()) {
        <p-message severity="success" text="Contraseña actualizada correctamente"></p-message>
      }

      @if (error()) {
        <p-message severity="error" [text]="error()!" class="mb-4"></p-message>
      }

      <form [formGroup]="form" (ngSubmit)="onSubmit()">
        <div class="mb-4">
          <label for="currentPassword" class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
            Contraseña Actual
          </label>
          <p-password 
            id="currentPassword" 
            formControlName="currentPassword"
            [toggleMask]="true" 
            [feedback]="false"
            styleClass="w-full"
            inputStyleClass="w-full"
            placeholder="Ingresa tu contraseña actual"
          ></p-password>
        </div>

        <div class="mb-4">
          <label for="newPassword" class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
            Nueva Contraseña
          </label>
          <p-password 
            id="newPassword" 
            formControlName="newPassword"
            [toggleMask]="true"
            styleClass="w-full"
            inputStyleClass="w-full"
            placeholder="Ingresa la nueva contraseña"
          ></p-password>
          @if (form.get('newPassword')?.errors?.['minlength']) {
            <small class="text-red-500">La contraseña debe tener al menos 6 caracteres</small>
          }
        </div>

        <div class="mb-4">
          <label for="confirmPassword" class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
            Confirmar Nueva Contraseña
          </label>
          <p-password 
            id="confirmPassword" 
            formControlName="confirmPassword"
            [toggleMask]="true" 
            [feedback]="false"
            styleClass="w-full"
            inputStyleClass="w-full"
            placeholder="Confirma la nueva contraseña"
          ></p-password>
          @if (form.errors?.['mismatch'] && form.get('confirmPassword')?.touched) {
            <small class="text-red-500">Las contraseñas no coinciden</small>
          }
        </div>

        <div class="flex gap-3">
          <button 
            pButton 
            type="submit"
            label="Cambiar Contraseña"
            [loading]="loading()"
            [disabled]="form.invalid || loading()"
          ></button>
        </div>
      </form>
    </div>
  `
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

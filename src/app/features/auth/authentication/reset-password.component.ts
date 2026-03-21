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
  standalone: true,
  imports: [
    ReactiveFormsModule,
    PasswordModule,
    InputTextModule,
    ButtonModule,
    MessageModule
],
  template: `
    <div class="w-full max-w-md mx-auto p-6">
      <div class="text-center mb-6">
        <h1 class="text-2xl font-bold text-surface-900 dark:text-surface-100 mb-2">
          Restablecer Contraseña
        </h1>
        <p class="text-surface-600 dark:text-surface-400 text-sm">
          Ingresa tu nueva contraseña.
        </p>
      </div>

      @if (success()) {
        <div class="mb-4">
          <p-message severity="success" text="Tu contraseña ha sido restablecida correctamente."></p-message>
        </div>
        
        <button 
          pButton 
          label="Ir al Login" 
          class="w-full"
          (click)="goToLogin()">
        </button>
      } @else {
        @if (error()) {
          <div class="mb-4">
            <p-message severity="error" [text]="error()!"></p-message>
          </div>
        }

        <form [formGroup]="form" (ngSubmit)="onSubmit()">
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
              type="button"
              label="Cancelar" 
              class="p-button-outlined flex-1"
              (click)="goToLogin()">
            </button>
            <button 
              pButton 
              type="submit"
              label="Cambiar Contraseña" 
              class="flex-1"
              [loading]="loading()"
              [disabled]="form.invalid">
            </button>
          </div>
        </form>
      }
    </div>
  `
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

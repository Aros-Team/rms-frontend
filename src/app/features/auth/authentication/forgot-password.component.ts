import { Component, inject, signal } from '@angular/core';

import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { PasswordModule } from 'primeng/password';
import { MessageModule } from 'primeng/message';
import { PasswordService } from '@app/core/services/authentication/password.service';
import { FloatLabelModule } from 'primeng/floatlabel';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { MessageService } from 'primeng/api';

@Component({
  selector: 'app-forgot-password-form',
  imports: [
    ReactiveFormsModule,
    PasswordModule,
    MessageModule,
    FloatLabelModule,
    InputTextModule,
    ButtonModule
  ],
  template: `
    <div class="w-full max-w-md mx-auto p-6">
      <div class="text-center mb-6">
        <h1 class="text-2xl font-bold text-surface-900 dark:text-surface-100 mb-2">
          Recuperar Contraseña
        </h1>
        <p class="text-surface-600 dark:text-surface-400 text-sm">
          Ingresa tu correo electrónico y te enviaremos un enlace para recuperar tu contraseña.
        </p>
      </div>

      @if (success()) {
        <div class="mb-4">
          <p-message severity="success" text="Si el correo existe, recibirás un enlace de recuperación pronto."></p-message>
        </div>
        
        <button 
          pButton 
          label="Volver al Login" 
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
            <label for="email" class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
              Correo electrónico
            </label>
            <input 
              pInputText 
              id="email"
              type="email" 
              formControlName="email"
              placeholder="tu@email.com"
              class="w-full"
              [class.ng-invalid]="isInvalid('email')"
            />
            @if (isInvalid('email')) {
              <small class="text-red-500">Ingresa un correo electrónico válido</small>
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
              label="Enviar" 
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
export class ForgotPasswordComponent {
  private passwordService = inject(PasswordService);
  private messageService = inject(MessageService);
  private router = inject(Router);

  loading = signal(false);
  error = signal<string | null>(null);
  success = signal(false);

  form: FormGroup = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.email])
  });

  isInvalid(field: string): boolean {
    const control = this.form.get(field);
    return control ? control.invalid && control.touched : false;
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    const email = this.form.get('email')?.value;

    this.passwordService.forgotPassword(email).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(['/login'], { queryParams: { passwordResetSent: true } });
      },
      error: (err) => {
        this.loading.set(false);
        if (err.status === 404) {
          this.error.set('Si el correo existe, recibirás un enlace de recuperación.');
          this.success.set(true);
        } else {
          this.error.set('Ocurrió un error. Por favor, intenta más tarde.');
        }
      }
    });
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }
}

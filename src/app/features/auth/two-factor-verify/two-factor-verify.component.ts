import { Component, inject } from '@angular/core';

import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { MessageService } from 'primeng/api';
import { AuthService } from '@services/authentication/auth-service';
import { LoggingService } from '@app/core/services/logging/logging-service';

@Component({
  selector: 'app-two-factor-verify',
  imports: [
    ReactiveFormsModule,
    InputTextModule,
    ButtonModule,
    MessageModule
],
  template: `
    <main class="min-h-screen w-full flex items-center justify-center p-4 bg-surface-50 dark:bg-surface-900">
      <div class="w-full max-w-md">
        
        <!-- Logo/Brand -->
        <div class="text-center mb-8">
          <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-500 mb-4">
            <i class="pi pi-shield text-white text-2xl"></i>
          </div>
          <h1 class="text-2xl md:text-3xl font-bold text-surface-900 dark:text-surface-100 mb-2">
            Verificación en Dos Pasos
          </h1>
          <p class="text-surface-600 dark:text-surface-400 text-sm md:text-base">
            Ingresa el código de 6 dígitos enviado a tu correo electrónico
          </p>
        </div>

        <!-- Card -->
        <div class="bg-white dark:bg-surface-800 rounded-2xl shadow-lg border border-surface-200 dark:border-surface-700 p-6 md:p-8">
          
          @if (errorMessage) {
            <div class="mb-6 p-4 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-xl">
              <div class="flex items-center gap-3">
                <i class="pi pi-exclamation-circle text-red-500 text-xl"></i>
                <span class="text-red-700 dark:text-red-300 text-sm">{{ errorMessage }}</span>
              </div>
            </div>
          }

          <form [formGroup]="form" (ngSubmit)="onSubmit()">
            <div class="mb-6">
              <label for="code" class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                Código de Verificación
              </label>
              <input
                pInputText
                [invalid]="isInvalid('code')"
                id="code"
                type="text"
                formControlName="code"
                maxlength="6"
                placeholder="------"
                class="w-full text-center text-2xl md:text-3xl tracking-[0.5em] font-mono py-4"
                inputmode="numeric"
                autocomplete="one-time-code"
              />
              @if (form.get('code')?.invalid && form.get('code')?.touched) {
                <small class="text-red-500 block mt-2">
                  Ingresa el código de 6 dígitos
                </small>
              }
            </div>

            <button
              pButton
              type="submit"
              label="Verificar Código"
              aria-label="Verificar Código"
              class="w-full"
              [loading]="formStatus === 'Occuped'"
              [disabled]="formStatus === 'Occuped' || form.invalid"
            ></button>
          </form>

          <div class="mt-6 pt-6 border-t border-surface-200 dark:border-surface-700">
            <div class="text-center">
              <p class="text-surface-500 dark:text-surface-400 text-sm mb-3">
                ¿No recibiste el código?
              </p>
              <button
                pButton
                type="button"
                label="Volver al Login"
                aria-label="Volver al Login"
                class="p-button-text p-button-sm"
                (click)="goBack()"
              ></button>
            </div>
          </div>
        </div>

        <!-- Help Text -->
        <p class="text-center text-surface-400 text-xs mt-6">
          El código expira en 5 minutos
        </p>
      </div>
    </main>
  `,
})
export class TwoFactorVerifyComponent {
  private authService = inject(AuthService);
  private router = inject(Router);
  private messageService = inject(MessageService);
  private loggingService = inject(LoggingService);

  form: FormGroup = new FormGroup({
    code: new FormControl('', [Validators.required, Validators.minLength(6), Validators.maxLength(6)]),
  });

  formStatus: 'Free' | 'Occuped' = 'Free';
  errorMessage: string | null = null;

  onSubmit() {
    this.loggingService.auth('TwoFactorVerify form submitted');
    this.formStatus = 'Occuped';
    this.errorMessage = null;

    const code = this.form.get('code')?.value;

    this.authService.verifyTwoFactor(code).subscribe({
      next: () => {
        this.loggingService.auth('2FA verification successful, redirecting based on user role');
        this.redirectBasedOnUserRole();
        this.formStatus = 'Free';
      },
      error: (err: { status?: number; error?: { message?: string } }) => {
        this.loggingService.error('2FA verification failed:', err);
        this.formStatus = 'Free';
        const backendMessage = err.error?.message;
        this.errorMessage = backendMessage || 'Código inválido o expirado. Por favor, intenta nuevamente.';

        if (err.status === 400) {
          this.errorMessage = backendMessage || 'Código inválido. Verifica el código enviado a tu correo.';
        } else if (err.status === 401) {
          this.errorMessage = backendMessage || 'Código expirado. Por favor, inicia sesión nuevamente.';
        }
      },
    });
  }

  isInvalid(value: string): boolean {
    return this.form.get(value)!.invalid && this.form.get(value)!.touched;
  }

  goBack(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  private redirectBasedOnUserRole(): void {
    const userData = this.authService.getData();
    this.loggingService.auth('redirectBasedOnUserRole called - user data:', userData);

    if (userData) {
      const isAdmin = userData.role === 'ADMIN';
      this.loggingService.auth('User role determined - isAdmin:', isAdmin);

      if (isAdmin) {
        this.loggingService.routing('Redirecting admin user to /admin');
        this.router.navigate(['/admin']);
      } else {
        this.loggingService.routing('Redirecting worker user to /worker');
        this.router.navigate(['/worker']);
      }
    } else {
      this.loggingService.debug('User data not available yet, retrying in 100ms');
      setTimeout(() => this.redirectBasedOnUserRole(), 100);
    }
  }
}

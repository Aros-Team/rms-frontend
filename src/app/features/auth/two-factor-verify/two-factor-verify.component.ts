import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
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
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    InputTextModule,
    ButtonModule,
    MessageModule,
  ],
  template: `
    <div class="min-w-[300px] mx-auto my-8">
      <h1 class="text-xl font-bold mb-6 text-center text-surface">Verificación de dos factores</h1>
      <p class="text-center text-gray-600 mb-6">
        Se ha enviado un código de verificación a tu correo electrónico
      </p>
      
      <form [formGroup]="form" (ngSubmit)="onSubmit()" class="flex flex-col gap-8 mt-8">
        <div>
          <label for="code" class="text-sm">Código de verificación</label>
          <input
            pInputText
            [invalid]="isInvalid('code')"
            id="code"
            type="text"
            formControlName="code"
            maxlength="6"
            placeholder="Ingresa el código de 6 dígitos"
            fluid
            class="text-center text-lg tracking-widest"
          />
          @if (form.get('code')?.invalid && form.get('code')?.touched) {
            <div class="text-red-500 text-sm">
              Campo requerido*
            </div>
          }
        </div>

        @if (errorMessage) {
          <p-message severity="error" [text]="errorMessage"></p-message>
        }

        <p-button
          type="submit"
          class="mt-4 m-auto"
          [disabled]="formStatus === 'Occuped' || form.invalid"
        >
          @if (formStatus === 'Free') {
            <span>Verificar</span>
          }
          @if (formStatus === 'Occuped') {
            <span>Verificando...</span>
          }
        </p-button>
      </form>

      <div class="mt-6 text-center">
        <p-button 
          [text]="true" 
          (onClick)="goBack()" 
          severity="secondary"
        >
          Volver al login
        </p-button>
      </div>
    </div>
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
      error: (err: { status?: number }) => {
        this.loggingService.error('2FA verification failed:', err);
        this.formStatus = 'Free';
        this.errorMessage = 'Código inválido o expirado. Por favor, intenta nuevamente.';

        if (err.status === 400) {
          this.errorMessage = 'Código inválido. Verifica el código enviado a tu correo.';
        } else if (err.status === 401) {
          this.errorMessage = 'Código expirado. Por favor, inicia sesión nuevamente.';
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

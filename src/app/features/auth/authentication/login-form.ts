import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { PasswordModule } from 'primeng/password';
import { MessageModule } from 'primeng/message'
import { AuthService } from '@services/authentication/auth-service';
import { FloatLabelModule } from 'primeng/floatlabel';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button'
import { MessageService } from 'primeng/api';
import { LoggingService } from '@app/core/services/logging/logging-service';

@Component({
  selector: 'app-login-form',
  templateUrl: './login-form.html',
  imports: [ReactiveFormsModule,
    CommonModule,
    PasswordModule,
    MessageModule,
    FloatLabelModule,
    InputTextModule,
    ButtonModule],
})
export class LoginForm {
  private authService = inject(AuthService);
  private router = inject(Router);
  private messageService = inject(MessageService);
  private loggingService = inject(LoggingService);

  form: FormGroup = new FormGroup({
    username: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [Validators.required]),
  });

  formStatus: 'Free' | 'Occuped' = 'Free';

  onSubmit() {
    this.loggingService.auth('Login form submitted');
    this.formStatus = 'Occuped';

    this.authService
      .login({
        username: this.form.get('username')?.value,
        password: this.form.get('password')?.value,
      })
      .subscribe({
        next: (response) => {
          this.loggingService.auth('Login response type:', response.type);
          
          if (response.type === 'TFA_REQUIRED') {
            this.loggingService.auth('TFA required, navigating to verification');
            this.formStatus = 'Free';
            this.router.navigate(['/login/verify']);
          } else {
            this.loggingService.auth('Login successful, redirecting based on user role');
            this.redirectBasedOnUserRole();
            this.formStatus = 'Free';
          }
        },
        error: (err: any) => {
          this.loggingService.error('Login failed:', err);
          this.authService.logout();
          this.formStatus = 'Free';

          const errorMessage = err?.error?.message || err?.error?.error || '';
          const isInvalidCredentials = err.status === 401 || 
            errorMessage.toLowerCase().includes('invalid credentials') ||
            errorMessage.toLowerCase().includes('incorrectos');

          if (isInvalidCredentials) {
            this.loggingService.auth('Login failed: Invalid credentials');
            this.messageService.add({
              severity: 'error',
              summary: 'Error de autenticación',
              detail: 'Credenciales incorrectas. Verifique su correo y contraseña.',
              life: 5000
            });
          } else if (err.status === 0 || (err.status && err.status >= 500)) {
            this.loggingService.error('Login failed: Server error', err);
            this.messageService.add({
              severity: 'error',
              summary: 'Error del servidor',
              detail: 'Hay un problema con el servidor. Por favor, intente más tarde.',
              life: 5000
            });
          } else {
            this.loggingService.error('Login failed: Unexpected error', err);
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: 'Ha ocurrido un error inesperado. Por favor, intente nuevamente.',
              life: 5000
            });
          }
        },
      });
  }

  isInvalid(value: string): boolean {
    return this.form.get(value)!.invalid && this.form.get(value)!.touched;
  }

  hide = signal(true);
  clickEvent(event: MouseEvent) {
    this.hide.set(!this.hide());
    event.stopPropagation();
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

  goToForgotPassword(): void {
    this.router.navigate(['/login/forgot-password']);
  }
}

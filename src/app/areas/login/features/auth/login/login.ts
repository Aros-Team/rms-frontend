import { Component, inject, signal, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { PasswordModule } from 'primeng/password';
import { MessageModule } from 'primeng/message'
import { Auth } from '@services/auth/auth';
import { FloatLabelModule } from 'primeng/floatlabel';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button'
import { MessageService } from 'primeng/api';
import { Logging } from '@app/core/services/logging/logging';

@Component({
  selector: 'app-login-form',
  templateUrl: './login.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, PasswordModule, MessageModule, FloatLabelModule, InputTextModule, ButtonModule, RouterLink],
})
export class LoginForm implements OnInit {
  private authService = inject(Auth);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private messageService = inject(MessageService);
  private logger = inject(Logging);

  form: FormGroup = new FormGroup({
    username: new FormControl('', [(control: AbstractControl) => Validators.required(control), (control: AbstractControl) => Validators.email(control)]),
    password: new FormControl('', [(control: AbstractControl) => Validators.required(control)]),
  });

  formStatus: 'Free' | 'Occuped' = 'Free';

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      if (params['passwordResetSent']) {
        this.messageService.add({
          severity: 'success',
          summary: 'Correo enviado',
          detail: 'Se ha enviado un correo para restablecer tu contraseña.',
          life: 5000
        });
        void this.router.navigate([], { queryParams: { passwordResetSent: null }, queryParamsHandling: 'merge' });
      }
    });
  }

  onSubmit() {
    this.logger.auth('Login form submitted');
    this.formStatus = 'Occuped';

    const username = this.form.get('username')?.value as string | undefined;
    const password = this.form.get('password')?.value as string | undefined;

    if (!username || !password) {
      this.logger.error('Username or password is missing');
      this.formStatus = 'Free';
      return;
    }

    this.authService
      .login({
        username,
        password,
      })
      .subscribe({
        next: (response) => {
          this.logger.auth('Login response type:', response.type);
          
          if (response.type === 'TFA_REQUIRED') {
            this.logger.auth('TFA required, navigating to verification');
            this.formStatus = 'Free';
            void this.router.navigate(['/login/verify']);
          } else {
            this.logger.auth('Login successful, redirecting based on user role');
            this.redirectBasedOnUserRole();
            this.formStatus = 'Free';
          }
        },
        error: (err: HttpErrorResponse) => {
          this.logger.error('Login failed:', err);
          this.authService.logout();
          this.formStatus = 'Free';

          const errorMessage = (err.error as { message?: string; error?: string } | undefined)?.message ?? 
                               (err.error as { message?: string; error?: string } | undefined)?.error ?? '';
          const isInvalidCredentials = err.status === 401 || 
            errorMessage.toLowerCase().includes('invalid credentials') ||
            errorMessage.toLowerCase().includes('incorrectos');

          if (isInvalidCredentials) {
            this.logger.auth('Login failed: Invalid credentials');
            this.messageService.add({
              severity: 'error',
              summary: 'Error de autenticación',
              detail: 'Credenciales incorrectas. Verifique su correo y contraseña.',
              life: 5000
            });
          } else if (err.status === 0 || (err.status && err.status >= 500)) {
            this.logger.error('Login failed: Server error', err);
            this.messageService.add({
              severity: 'error',
              summary: 'Error del servidor',
              detail: 'Hay un problema con el servidor. Por favor, intente más tarde.',
              life: 5000
            });
          } else {
            this.logger.error('Login failed: Unexpected error', err);
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
    const control = this.form.get(value);
    return control ? control.invalid && control.touched : false;
  }

  hide = signal(true);
  clickEvent(event: MouseEvent) {
    this.hide.set(!this.hide());
    event.stopPropagation();
  }

  private redirectBasedOnUserRole(): void {
    const userData = this.authService.getData();
    this.logger.auth('redirectBasedOnUserRole called - user data:', userData);

    if (userData) {
      if (userData.role === 'ADMIN') {
        this.logger.routing('Redirecting admin user to /admin');
        void this.router.navigate(['/admin']);
      } else {
        // Worker - check first area type
        const firstArea = userData.areas[0];

        if (firstArea.type === 'KITCHEN') {
          this.logger.routing('Redirecting kitchen worker to /worker/kitchen');
          void this.router.navigate(['/worker/kitchen']);
        } else {
          // WAITER or no area - default to waiter
          this.logger.routing('Redirecting waiter worker to /worker/waiter');
          void this.router.navigate(['/worker/waiter']);
        }
      }
    } else {
      this.logger.debug('User data not available yet, retrying in 100ms');
      setTimeout(() => { this.redirectBasedOnUserRole(); }, 100);
    }
  }
}
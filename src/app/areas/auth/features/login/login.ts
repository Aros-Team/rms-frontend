import { Component, inject, OnInit, ChangeDetectionStrategy, OnDestroy, signal } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { PasswordModule } from 'primeng/password';
import { MessageModule } from 'primeng/message'
import { Auth } from '@services/auth/auth';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button'
import { MessageService } from 'primeng/api';
import { Logging } from '@app/core/services/logging/logging';
import { CheckboxModule } from 'primeng/checkbox';
import { HabeasDataService } from '@shared/features/habeas-data/habeas-data.service';
import { UserInfo } from '@models/domain/user/user-info.model';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-login-form',
  templateUrl: './login.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, PasswordModule, MessageModule, InputTextModule, ButtonModule, RouterLink, CheckboxModule],
})
export class LoginForm implements OnInit, OnDestroy {
  private authService = inject(Auth);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private messageService = inject(MessageService);
  private logger = inject(Logging);
  private habeasDataService = inject(HabeasDataService);
  private subs: Subscription[] = [];

  form: FormGroup = new FormGroup({
    username: new FormControl('', [(control: AbstractControl) => Validators.required(control), (control: AbstractControl) => Validators.email(control)]),
    password: new FormControl('', [(control: AbstractControl) => Validators.required(control)]),
    termsAccepted: new FormControl(false, [(control: AbstractControl) => Validators.requiredTrue(control)]),
  });

  formStatus = signal<'Free' | 'Occuped'>('Free');

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

    const accepted = localStorage.getItem('habeas_data_accepted') === 'true';
    this.form.get('termsAccepted')?.setValue(accepted);

    this.subs.push(
      this.habeasDataService.accepted.subscribe(() => {
        this.form.get('termsAccepted')?.setValue(true);
      }),
      this.habeasDataService.rejected.subscribe(() => {
        this.form.get('termsAccepted')?.setValue(false);
      })
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => { s.unsubscribe(); });
  }

  showHabeasData(): void {
    this.habeasDataService.showDialog.next();
  }

  onSubmit() {
    this.logger.auth('Login form submitted');
    this.formStatus.set('Occuped');

    const username = this.form.get('username')?.value as string | undefined;
    const password = this.form.get('password')?.value as string | undefined;

    if (!username || !password) {
      this.logger.error('Username or password is missing');
      this.formStatus.set('Free');
      return;
    }

    this.authService
      .login({
        username,
        password,
      })
      .subscribe({
        next: (response: UserInfo | { type: string }) => {
          if ('type' in response && response.type === 'TFA_REQUIRED') {
            this.logger.auth('TFA required, navigating to verification');
            this.formStatus.set('Free');
            void this.router.navigate(['/login/verify']);
          } else {
            const userInfo = response as UserInfo;
            this.logger.auth('Login successful, redirecting based on user role');
            this.redirectBasedOnUserRole(userInfo);
            this.formStatus.set('Free');
          }
        },
        error: (err: HttpErrorResponse) => {
          this.logger.error('Login failed:', err);
          this.authService.logout();
          this.formStatus.set('Free');

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

  private redirectBasedOnUserRole(userData: UserInfo): void {
    this.logger.auth('redirectBasedOnUserRole - user data:', userData);
    if (userData.role === 'ADMIN') {
      this.logger.routing('Redirecting admin user to /admin');
      void this.router.navigate(['/admin']);
    } else {
      const firstArea = userData.areas[0];
      if (firstArea.type === 'KITCHEN') {
        this.logger.routing('Redirecting kitchen worker to /worker/kitchen');
        void this.router.navigate(['/worker/kitchen']);
      } else {
        this.logger.routing('Redirecting waiter worker to /worker/waiter');
        void this.router.navigate(['/worker/waiter']);
      }
    }
  }
}
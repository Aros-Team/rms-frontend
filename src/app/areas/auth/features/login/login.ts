import {
  Component,
  inject,
  OnInit,
  ChangeDetectionStrategy,
  OnDestroy,
  signal,
} from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { PasswordModule } from 'primeng/password';
import { MessageService } from 'primeng/api';
import { Auth } from '@services/auth/auth';
import { Logging } from '@app/core/services/logging/logging';
import { HabeasDataEvents } from '@shared/features/habeas-data/habeas-data-events';
import { UserInfo } from '@models/domain/user/user-info';
import { userActivities } from '@app/core/config/navigation/role-navigation';
import { resolveReturnUrl } from '@shared/lib/auth-navigation/auth-navigation';
import { extractProblemDetail } from '@shared/lib/problem-detail/problem-detail';
import { RmsButton } from '@shared/ui/button/button';
import { RmsCheckbox } from '@shared/ui/checkbox/checkbox';
import { RmsInput } from '@shared/ui/input/input';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-login-form',
  templateUrl: './login.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, PasswordModule, RouterLink, RmsButton, RmsCheckbox, RmsInput],
})
export class LoginForm implements OnInit, OnDestroy {
  private authService = inject(Auth);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private messageService = inject(MessageService);
  private logger = inject(Logging);
  private habeasDataService = inject(HabeasDataEvents);
  private subs: Subscription[] = [];

  form: FormGroup = new FormGroup({
    username: new FormControl('', [
      (control: AbstractControl) => Validators.required(control),
      (control: AbstractControl) => Validators.email(control),
    ]),
    password: new FormControl('', [(control: AbstractControl) => Validators.required(control)]),
    termsAccepted: new FormControl(false, [
      (control: AbstractControl) => Validators.requiredTrue(control),
    ]),
  });

  formStatus = signal<'Free' | 'Occuped'>('Free');

  /** Where to go after a successful login (from a guard/interceptor redirect). */
  private returnUrl: string | null = null;

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      this.returnUrl = resolveReturnUrl(params['returnUrl'] as string | undefined);
      if (params['passwordResetSent']) {
        this.messageService.add({
          severity: 'success',
          summary: 'Correo enviado',
          detail: 'Se ha enviado un correo para restablecer tu contraseña.',
          life: 5000,
        });
        void this.router.navigate([], {
          queryParams: { passwordResetSent: null },
          queryParamsHandling: 'merge',
        });
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
      }),
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => {
      s.unsubscribe();
    });
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
            this.redirectAfterLogin(userInfo);
            this.formStatus.set('Free');
          }
        },
        error: (err: HttpErrorResponse) => {
          this.logger.error('Login failed:', err);
          this.authService.logout();
          this.formStatus.set('Free');

          // The server's RFC-7807 `detail` beats our generic copy whenever the
          // body carried one. A filter-level 401 is bodiless → `null` here.
          const problemDetail = extractProblemDetail(err);
          const isInvalidCredentials =
            err.status === 401 || (problemDetail?.toLowerCase().includes('credenciales') ?? false);

          if (isInvalidCredentials) {
            this.logger.auth('Login failed: Invalid credentials');
            this.messageService.add({
              severity: 'error',
              summary: 'Error de autenticación',
              detail:
                problemDetail ?? 'Credenciales incorrectas. Verifique su correo y contraseña.',
              life: 5000,
            });
          } else if (err.status === 0 || (err.status && err.status >= 500)) {
            this.logger.error('Login failed: Server error', err);
            this.messageService.add({
              severity: 'error',
              summary: 'Error del servidor',
              detail: 'Hay un problema con el servidor. Por favor, intente más tarde.',
              life: 5000,
            });
          } else {
            this.logger.error('Login failed: Unexpected error', err);
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail:
                problemDetail ?? 'Ha ocurrido un error inesperado. Por favor, intente nuevamente.',
              life: 5000,
            });
          }
        },
      });
  }

  isInvalid(value: string): boolean {
    const control = this.form.get(value);
    return control ? control.invalid && control.touched : false;
  }

  /**
   * Field copy that names the actual failure. A missing value and a malformed
   * address are not the same error, so the required check wins only when it is
   * the one that failed.
   */
  get usernameError(): string {
    if (!this.isInvalid('username')) {
      return '';
    }
    const errors = this.form.get('username')?.errors;
    if (errors?.['required']) {
      return 'Campo requerido';
    }
    if (errors?.['email']) {
      return 'Ingresa un correo válido';
    }
    return 'Revisa este campo';
  }

  get passwordError(): string {
    if (!this.isInvalid('password')) {
      return '';
    }
    const errors = this.form.get('password')?.errors;
    if (errors?.['required']) {
      return 'Campo requerido';
    }
    return 'Revisa este campo';
  }

  /**
   * Closes the returnUrl round-trip: when a guard/interceptor sent the user here
   * from an internal URL, that URL wins over the role-based default.
   */
  private redirectAfterLogin(userData: UserInfo): void {
    if (this.returnUrl) {
      this.logger.routing('Login successful, returning to the attempted URL:', this.returnUrl);
      void this.router.navigateByUrl(this.returnUrl);
      return;
    }
    this.redirectBasedOnUserRole(userData);
  }

  private redirectBasedOnUserRole(userData: UserInfo): void {
    this.logger.auth('redirectBasedOnUserRole - user data:', userData);
    if (userData.role === 'ADMIN') {
      this.logger.routing('Redirecting admin user to /admin');
      void this.router.navigate(['/admin']);
    } else {
      const activities = userActivities(userData);
      if (activities.includes('PREPARATION')) {
        void this.router.navigate(['/worker/kitchen']);
      } else if (activities.includes('CASH')) {
        void this.router.navigate(['/worker/cashier']);
      } else {
        void this.router.navigate(['/worker/waiter']);
      }
    }
  }
}

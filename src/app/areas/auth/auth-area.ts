import { Component, ChangeDetectionStrategy } from '@angular/core';
import { LoginForm } from '@areas/auth/features/login/login';

@Component({
  selector: 'app-auth',
  templateUrl: './auth.html',
  imports: [LoginForm],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Auth {
  readonly area = 'auth';
}

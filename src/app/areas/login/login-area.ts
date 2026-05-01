import { Component, ChangeDetectionStrategy } from '@angular/core';
import { LoginForm } from '@features/auth/login/login-form.component';

@Component({
  selector: 'app-login',
  templateUrl: './login.html',
  imports: [LoginForm],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Login {
  //
}

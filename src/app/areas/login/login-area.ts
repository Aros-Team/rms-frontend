import { Component, ChangeDetectionStrategy } from '@angular/core';
import { LoginForm } from '@areas/login/features/auth/login/login';

@Component({
  selector: 'app-login',
  templateUrl: './login.html',
  imports: [LoginForm],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Login {
  //
}

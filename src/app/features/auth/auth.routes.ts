import { Routes } from '@angular/router';
import { LoginPageComponent } from './pages/login/login.page';

export const AUTH_ROUTES: Routes = [
  {
    path: 'login',
    component: LoginPageComponent
  },
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  }
];

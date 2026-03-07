import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-auth-shell-page',
  standalone: true,
  imports: [RouterOutlet],
  template: `
    <main class="auth-shell">
      <router-outlet></router-outlet>
    </main>
  `,
  styles: [
    `
      .auth-shell {
        min-height: 100vh;
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
      }
    `,
  ],
})
export class AuthShellPageComponent {}

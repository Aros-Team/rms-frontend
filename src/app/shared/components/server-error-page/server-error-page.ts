import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { Auth } from '@services/auth/auth';
import { ServerStatus } from '@core/services/server-status/server-status';

@Component({
  selector: 'app-server-error-page',
  templateUrl: './server-error-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule],
})
export class ServerErrorPage {
  private authService = inject(Auth);
  private router = inject(Router);
  protected serverStatus = inject(ServerStatus);

  retry(): void {
    this.authService.loadUserInfo().subscribe({
      next: (userInfo) => {
        const url = userInfo.role === 'ADMIN' ? '/admin' : '/worker';
        void this.router.navigate([url]);
      },
      error: () => {
        this.serverStatus.check();
      }
    });
  }

  logout(): void {
    this.authService.logout();
    void this.router.navigate(['/login']);
  }
}
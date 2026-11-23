import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { RmsButton } from '@app/shared/ui/button/button';
import { Auth } from '@services/auth/auth';
import { ServerStatus } from '@core/services/server-status/server-status';
import { homeRouteFor } from '@app/core/config/navigation/role-navigation';

@Component({
  selector: 'app-server-error-page',
  templateUrl: './server-error-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RmsButton],
})
export class ServerErrorPage {
  private authService = inject(Auth);
  private router = inject(Router);
  protected serverStatus = inject(ServerStatus);

  retry(): void {
    this.authService.loadUserInfo().subscribe({
      next: (userInfo) => {
        void this.router.navigate([homeRouteFor(userInfo)]);
      },
      error: () => {
        this.serverStatus.check();
      },
    });
  }

  logout(): void {
    this.authService.logout();
    void this.router.navigate(['/login']);
  }
}
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { RmsButton } from '@app/shared/ui/button/button';
import { Auth } from '@services/auth/auth';
import { homeRouteFor } from '@app/core/config/navigation/role-navigation';

/**
 * 404 screen for unknown URLs.
 *
 * The wildcard route used to redirect to `/login`, so a typo in the address
 * bar looked like an authentication problem instead of a missing page.
 */
@Component({
  selector: 'app-not-found-page',
  templateUrl: './not-found-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RmsButton],
})
export class NotFoundPage {
  private authService = inject(Auth);
  private router = inject(Router);

  hasSession(): boolean {
    return this.authService.getData() !== undefined;
  }

  goHome(): void {
    void this.router.navigate([homeRouteFor(this.authService.getData())]);
  }

  logout(): void {
    this.authService.logout();
    void this.router.navigate(['/login']);
  }
}

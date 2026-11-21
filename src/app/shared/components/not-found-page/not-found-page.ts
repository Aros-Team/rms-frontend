import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { Auth } from '@services/auth/auth';

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
  imports: [ButtonModule],
})
export class NotFoundPage {
  private authService = inject(Auth);
  private router = inject(Router);

  hasSession(): boolean {
    return this.authService.getData() !== undefined;
  }

  goHome(): void {
    const userData = this.authService.getData();
    if (!userData) {
      void this.router.navigate(['/login']);
      return;
    }
    void this.router.navigate([userData.role === 'ADMIN' ? '/admin' : '/worker']);
  }

  logout(): void {
    this.authService.logout();
    void this.router.navigate(['/login']);
  }
}

import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { Auth } from '@services/auth/auth';
import { homeRouteFor } from '@app/core/config/navigation/role-navigation';

@Component({
  selector: 'app-forbidden-page',
  templateUrl: './forbidden-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule],
})
export class ForbiddenPage {
  private authService = inject(Auth);
  private router = inject(Router);

  goHome(): void {
    void this.router.navigate([homeRouteFor(this.authService.getData())]);
  }

  logout(): void {
    this.authService.logout();
    void this.router.navigate(['/login']);
  }
}

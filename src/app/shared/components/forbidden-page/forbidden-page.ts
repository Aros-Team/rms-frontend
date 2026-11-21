import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { Auth } from '@services/auth/auth';

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

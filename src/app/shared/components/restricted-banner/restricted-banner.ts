import { Component, inject } from '@angular/core';
import { Auth } from '@app/core/services/auth/auth';

@Component({
  selector: 'app-restricted-banner',
  templateUrl: './restricted-banner.html',
  styleUrl: './restricted-banner.css',
})
export class RestrictedBanner {
  private auth = inject(Auth);

  isRestricted(): boolean {
    return this.auth.isRestricted();
  }
}

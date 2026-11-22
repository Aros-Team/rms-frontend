import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Auth } from '@services/auth/auth';
import { Logging } from '@app/core/services/logging/logging';
import { workerHome } from '@app/core/config/navigation/role-navigation';

/**
 * Safety net for `/worker` when no child route is selected.
 *
 * The AreaGuard normally returns a RedirectCommand before this component is
 * activated. If it ever renders, it repeats the dispatch and shows a small
 * "redirecting" state instead of a blank screen.
 */
@Component({
  selector: 'app-worker-landing',
  templateUrl: './worker-landing.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkerLanding implements OnInit {
  private authService = inject(Auth);
  private router = inject(Router);
  private logger = inject(Logging);

  ngOnInit(): void {
    const home = workerHome(this.authService.getData());
    if (!home) {
      this.logger.warn('WorkerLanding: no recognized worker area, redirecting to /forbidden');
      void this.router.navigate(['/forbidden']);
      return;
    }
    void this.router.navigateByUrl(home);
  }
}

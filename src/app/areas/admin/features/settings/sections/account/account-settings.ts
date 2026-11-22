import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { ChangePassword } from '@areas/auth/features/password-recovery/change-password';
import { Auth } from '@app/core/services/auth/auth';
import { HabeasDataEvents } from '@shared/features/habeas-data/habeas-data-events';
import { RmsButton } from '@shared/ui/button/button';
import { RmsDialog } from '@shared/ui/dialog/dialog';
import { RmsSection } from '@shared/ui/section/section';

/** `Configuración → Cuenta`: profile, password, privacy and sign-out. */
@Component({
  selector: 'app-settings-account',
  templateUrl: './account-settings.html',
  imports: [ChangePassword, RmsButton, RmsDialog, RmsSection],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountSettingsSection {
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  private readonly habeasDataEvents = inject(HabeasDataEvents);

  readonly user = this.auth.getData();

  readonly roleLabel = computed(() => {
    const role = this.user?.role;
    if (role === 'ADMIN') return 'Administrador';
    if (role === 'WORKER') return 'Trabajador';
    return 'Sin rol';
  });

  readonly areaLabels = computed(() =>
    (this.user?.areas ?? []).map((area) => area.name).join(', ') || 'Todas las áreas',
  );

  readonly changePasswordVisible = signal(false);
  readonly logoutVisible = signal(false);
  readonly privacyAccepted = signal(localStorage.getItem('habeas_data_accepted') === 'true');
  readonly privacyDate = signal(localStorage.getItem('habeas_data_date') ?? '');

  openPrivacyNotice(): void {
    this.habeasDataEvents.showDialog.next();
    // The global dialog writes acceptance in localStorage; refresh on close is
    // not observable, so the status re-reads the next time the section mounts.
  }

  confirmLogout(): void {
    this.logoutVisible.set(true);
  }

  logout(): void {
    this.logoutVisible.set(false);
    this.auth.logout();
    void this.router.navigate(['/login']);
  }
}

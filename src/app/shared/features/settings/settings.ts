import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { ChangePassword } from '@areas/auth/features/password-recovery/change-password';
import { Schedules } from '@areas/admin/features/manage/features/schedules/schedules';
import { Auth } from '@app/core/services/auth/auth';
import { Worker } from '@app/core/services/workers/worker';
import { Accessibility, FontSize, ContrastMode } from '@app/core/services/accessibility/accessibility';
import { Theme, ThemeName } from '@app/core/services/theme/theme';
import { SalaryHistoryEntry } from '@app/shared/models/dto/workers/salary-history-entry';
import { tryToAmount, type MoneyLike } from '@app/shared/models/dto/common/money';
import { Money } from '@app/shared/pipes/money/money';

import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { SkeletonModule } from 'primeng/skeleton';

type TabId = 'accesibilidad' | 'horarios' | 'cuenta' | 'cerrar-session';

interface SettingsTab {
  id: TabId;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-settings',
  imports: [
    ChangePassword,
    Schedules,
    RouterLink,
    DialogModule,
    ButtonModule,
    TableModule,
    SkeletonModule,
  ],
  templateUrl: './settings.html',
})
export class Settings implements OnInit {
  private authService = inject(Auth);
  private workerService = inject(Worker);
  private accessibilityService = inject(Accessibility);
  private themeService = inject(Theme);
  private router = inject(Router);

  activeTab = signal<TabId>('accesibilidad');

  // User info
  userName = signal('');
  userEmail = signal('');
  userRole = signal('');

  // Change Password Dialog
  changePasswordVisible = signal(false);

  // Habeas Data
  showHabeasDialog = false;
  habeasDataAccepted = signal(false);
  habeasDataDate = signal('');

  // Logout
  showLogoutDialog = false;

  // Computed
  isAdmin = computed(() => this.authService.getData()?.role === 'ADMIN');

  /** Visible tabs, in order. Drives both the tablist and keyboard navigation. */
  tabs = computed<SettingsTab[]>(() => {
    const tabs: SettingsTab[] = [
      { id: 'accesibilidad', label: 'Accesibilidad', icon: 'pi pi-cog' },
    ];

    if (this.isAdmin()) {
      tabs.push({ id: 'horarios', label: 'Horarios', icon: 'pi pi-calendar' });
    }

    tabs.push(
      { id: 'cuenta', label: 'Cuenta', icon: 'pi pi-user' },
      { id: 'cerrar-session', label: 'Cerrar sesión', icon: 'pi pi-sign-out' },
    );

    return tabs;
  });

  // Theme
  currentTheme = signal<string>(this.themeService.get());

  // Accessibility delegates
  currentFontSize = computed(() => this.accessibilityService.fontSize());
  currentContrast = computed(() => this.accessibilityService.contrastMode());

  // Salary history (for WORKER role)
  salaryHistory = signal<SalaryHistoryEntry[] | undefined>(undefined);
  salaryHistoryLoading = computed(() => this.salaryHistory() === undefined);

  /** Shared money pipe; the backend sends `MoneyDto`, not a raw number. */
  private readonly moneyPipe = new Money();

  ngOnInit(): void {
    const userData = this.authService.getData();
    if (userData) {
      this.userName.set(userData.name || '');
      this.userEmail.set(userData.email || '');
      this.userRole.set(userData.role === 'ADMIN' ? 'Administrador' : 'Trabajador');

      // Load salary history for workers
      if (userData.role === 'WORKER' && userData.id) {
        this.loadSalaryHistory(userData.id);
      }
    }

    this.checkHabeasDataStatus();
  }

  loadSalaryHistory(userId: number): void {
    this.workerService.getSalaryHistory(userId).subscribe({
      next: (data) => { this.salaryHistory.set(data); },
      error: () => { this.salaryHistory.set([]); },
    });
  }

  /**
   * Renders a salary. The wire shape is `MoneyDto` (`{ amount, currency }`), so
   * `Intl.NumberFormat` on the raw value yields `$ NaN`; normalize with
   * `tryToAmount` and format through the shared `money` pipe. Missing → `-`.
   */
  formatSalary(value: MoneyLike): string {
    if (tryToAmount(value) === null) return '-';
    return this.moneyPipe.transform(value);
  }

  formatDateTime(iso: string): string {
    return new Intl.DateTimeFormat('es-CO', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(iso));
  }

  // ---- Tabs ----

  selectTab(id: TabId): void {
    this.activeTab.set(id);
  }

  /**
   * WAI-ARIA tabs keyboard pattern: arrows move the selection and the focus,
   * Home/End jump to the first/last tab.
   */
  onTabKeydown(event: KeyboardEvent, index: number): void {
    const tabs = this.tabs();
    let nextIndex: number;

    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        nextIndex = (index + 1) % tabs.length;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        nextIndex = (index - 1 + tabs.length) % tabs.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = tabs.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    const next = tabs[nextIndex];
    this.selectTab(next.id);
    document.getElementById(`tab-${next.id}`)?.focus();
  }

  // ---- Accesibilidad ----

  setFontSize(size: FontSize): void {
    this.accessibilityService.setFontSize(size);
  }

  setContrast(mode: ContrastMode): void {
    this.accessibilityService.setContrastMode(mode);
  }

  setTheme(theme: ThemeName): void {
    this.themeService.set(theme);
    this.currentTheme.set(theme);
  }

  // ---- Habeas Data ----

  private checkHabeasDataStatus(): void {
    const accepted = localStorage.getItem('habeas_data_accepted');
    this.habeasDataAccepted.set(accepted === 'true');

    if (accepted === 'true') {
      const date = localStorage.getItem('habeas_data_date');
      this.habeasDataDate.set(date ?? '');
    }
  }

  acceptHabeasData(): void {
    const now = new Date();
    const dateStr = now.toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    localStorage.setItem('habeas_data_accepted', 'true');
    localStorage.setItem('habeas_data_date', dateStr);
    this.habeasDataAccepted.set(true);
    this.habeasDataDate.set(dateStr);
    this.showHabeasDialog = false;
  }

  // ---- Logout ----

  confirmLogout(): void {
    this.showLogoutDialog = true;
  }

  logout(): void {
    this.showLogoutDialog = false;
    this.authService.logout();
    void this.router.navigate(['/login']);
  }
}

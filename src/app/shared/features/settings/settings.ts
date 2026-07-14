import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { Router } from '@angular/router';

import { ChangePassword } from '@areas/auth/features/password-recovery/change-password';
import { Schedules } from '@areas/admin/features/manage/features/schedules/schedules';
import { Auth } from '@app/core/services/auth/auth';
import { User } from '@app/core/services/users/user';
import { Accessibility, FontSize, ContrastMode } from '@app/core/services/accessibility/accessibility';
import { Theme } from '@app/core/services/theme/theme';
import { SalaryHistoryEntry } from '@app/shared/models/dto/users/salary-history-entry.model';

import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { SkeletonModule } from 'primeng/skeleton';

type TabId = 'accesibilidad' | 'horarios' | 'cuenta' | 'cerrar-session';

@Component({
  selector: 'app-settings',
  imports: [
    ChangePassword,
    Schedules,
    DialogModule,
    ButtonModule,
    TableModule,
    SkeletonModule,
  ],
  templateUrl: './settings.html',
})
export class Settings implements OnInit {
  private authService = inject(Auth);
  private userService = inject(User);
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

  // Theme
  currentTheme = signal<string>(this.themeService.get());

  // Accessibility delegates
  currentFontSize = computed(() => this.accessibilityService.fontSize());
  currentContrast = computed(() => this.accessibilityService.contrastMode());

  // Salary history (for WORKER role)
  salaryHistory = signal<SalaryHistoryEntry[] | undefined>(undefined);
  salaryHistoryLoading = computed(() => this.salaryHistory() === undefined);

  currencyFormat = Intl.NumberFormat('es-Co', { style: 'currency', currency: 'COP' });

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
    this.userService.getSalaryHistory(userId).subscribe({
      next: (data) => { this.salaryHistory.set(data); },
      error: () => { this.salaryHistory.set([]); },
    });
  }

  formatSalary(value: number | null): string {
    if (value === null) return '-';
    return this.currencyFormat.format(value);
  }

  formatDateTime(iso: string): string {
    return new Intl.DateTimeFormat('es-CO', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(iso));
  }

  // ---- Accesibilidad ----

  setFontSize(size: FontSize): void {
    this.accessibilityService.setFontSize(size);
  }

  setContrast(mode: ContrastMode): void {
    this.accessibilityService.setContrastMode(mode);
  }

  setTheme(theme: string): void {
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

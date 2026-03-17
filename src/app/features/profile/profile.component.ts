import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChangePasswordComponent } from '@features/auth/authentication/change-password.component';
import { AuthService } from '@app/core/services/authentication/auth-service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, ChangePasswordComponent],
  template: `
    <div class="p-6 max-w-2xl mx-auto">
      <h1 class="text-2xl font-bold text-surface-900 dark:text-surface-100 mb-6">
        Mi Perfil
      </h1>

      <!-- User Info -->
      <div class="bg-white dark:bg-surface-800 rounded-xl p-6 shadow-sm border border-surface-200 dark:border-surface-700 mb-6">
        <h2 class="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-4">
          Información del Usuario
        </h2>
        <div class="space-y-3">
          <div class="flex justify-between">
            <span class="text-surface-600 dark:text-surface-400">Nombre:</span>
            <span class="font-medium text-surface-900 dark:text-surface-100">{{ userName() }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-surface-600 dark:text-surface-400">Correo:</span>
            <span class="font-medium text-surface-900 dark:text-surface-100">{{ userEmail() }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-surface-600 dark:text-surface-400">Rol:</span>
            <span class="font-medium text-surface-900 dark:text-surface-100">{{ userRole() }}</span>
          </div>
        </div>
      </div>

      <!-- Change Password -->
      <app-change-password></app-change-password>
    </div>
  `
})
export class ProfileComponent implements OnInit {
  private authService = inject(AuthService);

  userName = signal('');
  userEmail = signal('');
  userRole = signal('');

  ngOnInit(): void {
    const userData = this.authService.getData();
    if (userData) {
      this.userName.set(userData.name || '');
      this.userEmail.set(userData.email || '');
      this.userRole.set(userData.role === 'ADMIN' ? 'Administrador' : 'Trabajador');
    }
  }
}

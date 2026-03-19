import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChangePasswordComponent } from '@features/auth/authentication/change-password.component';
import { AuthService } from '@app/core/services/authentication/auth-service';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, ChangePasswordComponent, DialogModule, ButtonModule],
  template: `
    <div class="p-6 max-w-3xl mx-auto">
      <h1 class="text-2xl font-bold text-surface-900 dark:text-surface-100 mb-6">
        Configuración
      </h1>

      <nav class="flex space-x-1 overflow-x-auto mb-6">
        <button 
          (click)="activeTab.set('user')"
          class="flex items-center gap-2 px-4 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors duration-200 whitespace-nowrap"
          [class.bg-primary-500]="activeTab() === 'user'"
          [class.text-primary-contrast]="activeTab() === 'user'"
          [class.border-primary-500]="activeTab() === 'user'"
        >
          <i class="pi pi-user"></i>
          <span>Usuario</span>
        </button>

        <button 
          (click)="activeTab.set('privacy')"
          class="flex items-center gap-2 px-4 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors duration-200 whitespace-nowrap"
          [class.bg-primary-500]="activeTab() === 'privacy'"
          [class.text-primary-contrast]="activeTab() === 'privacy'"
          [class.border-primary-500]="activeTab() === 'privacy'"
        >
          <i class="pi pi-eye"></i>
          <span>Privacidad</span>
        </button>

        <button 
          (click)="activeTab.set('password')"
          class="flex items-center gap-2 px-4 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors duration-200 whitespace-nowrap"
          [class.bg-primary-500]="activeTab() === 'password'"
          [class.text-primary-contrast]="activeTab() === 'password'"
          [class.border-primary-500]="activeTab() === 'password'"
        >
          <i class="pi pi-lock"></i>
          <span>Contraseña</span>
        </button>

        <button 
          (click)="activeTab.set('settings')"
          class="flex items-center gap-2 px-4 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors duration-200 whitespace-nowrap"
          [class.bg-primary-500]="activeTab() === 'settings'"
          [class.text-primary-contrast]="activeTab() === 'settings'"
          [class.border-primary-500]="activeTab() === 'settings'"
        >
          <i class="pi pi-cog"></i>
          <span>Otros</span>
        </button>
      </nav>

      @switch (activeTab()) {
        @case ('user') {
          <div class="py-4">
            <div class="space-y-3">
              <div class="flex justify-between py-2 border-b border-surface-200 dark:border-surface-700">
                <span class="text-surface-600 dark:text-surface-400">Nombre:</span>
                <span class="font-medium text-surface-900 dark:text-surface-100">{{ userName() }}</span>
              </div>
              <div class="flex justify-between py-2 border-b border-surface-200 dark:border-surface-700">
                <span class="text-surface-600 dark:text-surface-400">Correo:</span>
                <span class="font-medium text-surface-900 dark:text-surface-100">{{ userEmail() }}</span>
              </div>
              <div class="flex justify-between py-2">
                <span class="text-surface-600 dark:text-surface-400">Rol:</span>
                <span class="font-medium text-surface-900 dark:text-surface-100">{{ userRole() }}</span>
              </div>
            </div>
          </div>
        }

        @case ('privacy') {
          <div class="py-4">
            <div class="flex justify-between items-center mb-6">
              <div>
                <span class="text-surface-600 dark:text-surface-400">Estado: </span>
                <span [class]="habeasDataAccepted() ? 'text-green-600 dark:text-green-400 font-medium' : 'text-red-600 dark:text-red-400 font-medium'">
                  {{ habeasDataAccepted() ? 'Aceptado' : 'Pendiente' }}
                </span>
                @if (habeasDataAccepted()) {
                  <p class="text-sm text-surface-500 mt-1">Aceptado el {{ habeasDataDate() }}</p>
                }
              </div>
              <button 
                pButton 
                type="button" 
                label="Ver aviso" 
                icon="pi pi-eye"
                (click)="showHabeasDialog = true"
                class="p-button-outlined"
              ></button>
            </div>
          </div>
        }

        @case ('password') {
          <div class="py-4">
            <app-change-password></app-change-password>
          </div>
        }

        @case ('settings') {
          <div class="py-4">
            <p class="text-surface-500 text-sm">
              Más opciones de configuración pronto...
            </p>
          </div>
        }
      }
    </div>

    <!-- Habeas Data Dialog -->
    <p-dialog 
      [(visible)]="showHabeasDialog" 
      [modal]="true" 
      [closable]="true"
      [closeOnEscape]="true"
      [draggable]="false"
      [resizable]="false"
      header="Aviso de Privacidad y Tratamiento de Datos"
      [style]="{width: '90vw', maxWidth: '700px'}"
    >
      <div class="max-h-[60vh] overflow-y-auto text-sm leading-relaxed text-surface-700 dark:text-surface-300">
        <p class="mb-4">
          <strong>RMS</strong> (Restaurant Management System) le informa que es responsable del tratamiento 
          de sus datos personales conforme a la Ley 1581 de 2012 y sus decreto reglamentarios.
        </p>

        <p class="mb-4">
          <strong>Finalidad del tratamiento:</strong> Los datos recolectados serán utilizados para:
        </p>
        <ul class="list-disc pl-6 mb-4">
          <li>Gestión de pedidos y órdenes</li>
          <li>Administración de usuarios y empleados</li>
          <li>Control de inventarios y productos</li>
          <li>Reportes y análisis del restaurante</li>
          <li>Comunicación relacionada con el servicio</li>
        </ul>

        <p class="mb-4">
          <strong>Derechos del titular:</strong> Como titular de datos personales usted tiene derecho a:
        </p>
        <ul class="list-disc pl-6 mb-4">
          <li>Conocer, actualizar y rectificar sus datos personales</li>
          <li>Solicitar prueba de la autorización otorgada</li>
          <li>Ser informado sobre el uso que se le ha dado a sus datos</li>
          <li>Presentar quejas ante la Superintendencia de Industria y Comercio</li>
          <li>Revocar la autorización y/o solicitar la supresión de datos</li>
        </ul>

        <p class="mb-4">
          <strong>Cookies:</strong> Este sistema utiliza cookies para mejorar la experiencia del usuario 
          y recordar preferencias de sesión.
        </p>

        <p class="mb-4">
          <strong>Contacto:</strong> Para ejercer sus derechos o requerir información adicional, 
          puede contactarnos a través de los canales establecidos por la organización.
        </p>

        <p class="text-xs text-surface-500 mt-6">
          Fecha de última actualización: 13 de Marzo de 2026
        </p>
      </div>

      <div class="flex justify-end gap-2 mt-4">
        <p-button 
          label="Cerrar" 
          severity="secondary" 
          (onClick)="showHabeasDialog = false"
        ></p-button>
        @if (!habeasDataAccepted()) {
          <p-button 
            label="Aceptar" 
            (onClick)="acceptHabeasData()"
          ></p-button>
        }
      </div>
    </p-dialog>
  `
})
export class SettingsComponent implements OnInit {
  private authService = inject(AuthService);

  activeTab = signal<'user' | 'privacy' | 'password' | 'settings'>('user');
  userName = signal('');
  userEmail = signal('');
  userRole = signal('');
  showHabeasDialog = false;
  habeasDataAccepted = signal(false);
  habeasDataDate = signal('');

  ngOnInit(): void {
    const userData = this.authService.getData();
    if (userData) {
      this.userName.set(userData.name || '');
      this.userEmail.set(userData.email || '');
      this.userRole.set(userData.role === 'ADMIN' ? 'Administrador' : 'Trabajador');
    }

    this.checkHabeasDataStatus();
  }

  private checkHabeasDataStatus(): void {
    const accepted = localStorage.getItem('habeas_data_accepted');
    this.habeasDataAccepted.set(accepted === 'true');

    if (accepted === 'true') {
      const date = localStorage.getItem('habeas_data_date');
      this.habeasDataDate.set(date || '');
    }
  }

  acceptHabeasData(): void {
    const now = new Date();
    const dateStr = now.toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    localStorage.setItem('habeas_data_accepted', 'true');
    localStorage.setItem('habeas_data_date', dateStr);
    this.habeasDataAccepted.set(true);
    this.habeasDataDate.set(dateStr);
    this.showHabeasDialog = false;
  }
}

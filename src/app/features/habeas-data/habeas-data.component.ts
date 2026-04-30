import { Component, inject, OnInit } from '@angular/core';

import { Router } from '@angular/router';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-habeas-data',
  imports: [DialogModule, ButtonModule, CheckboxModule, FormsModule],
  template: `
    <p-dialog 
      [(visible)]="visible" 
      [modal]="true" 
      [closable]="false"
      [closeOnEscape]="false"
      [draggable]="false"
      [resizable]="false"
      header="Aviso de Privacidad y Tratamiento de Datos"
      [style]="{width: '90vw', maxWidth: '700px'}"
    >
      <div class="max-h-[60vh] overflow-y-auto text-sm leading-relaxed text-surface-700 dark:text-surface-300" [style.fontSize.px]="fontSize">
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
          Fecha de última actualización: {{ lastUpdateDate }}
        </p>
      </div>

      <div class="mt-4 p-4 bg-surface-100 dark:bg-surface-800 rounded">
        <label for="acceptTerms" class="flex items-center gap-3 cursor-pointer">
          <p-checkbox 
            [(ngModel)]="accepted" 
            [binary]="true"
            inputId="acceptTerms"
          ></p-checkbox>
          <span class="text-sm">
            He leído y acepto el tratamiento de mis datos personales
          </span>
        </label>
      </div>

      <div class="flex justify-end gap-2 mt-4">
        <p-button 
          label="Rechazar" 
          severity="secondary" 
          (onClick)="reject()"
          [disabled]="!accepted"
        ></p-button>
        <p-button 
          label="Aceptar" 
          (onClick)="accept()"
          [disabled]="!accepted"
        ></p-button>
      </div>
    </p-dialog>
  `
})
export class HabeasDataComponent implements OnInit {
  visible = false;
  accepted = false;
  lastUpdateDate = '13 de Marzo de 2026';
  fontSize = 16;

  private readonly FONT_SIZE_KEY = 'accessibility_font_size';
  private router = inject(Router);

  ngOnInit(): void {
    const accepted = localStorage.getItem('habeas_data_accepted');
    if (!accepted) {
      this.visible = true;
    }

    const savedFontSize = localStorage.getItem(this.FONT_SIZE_KEY);
    if (savedFontSize) {
      this.fontSize = parseInt(savedFontSize, 10);
    }
  }

  accept(): void {
    const now = new Date();
    const dateStr = now.toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    localStorage.setItem('habeas_data_accepted', 'true');
    localStorage.setItem('habeas_data_date', dateStr);
    this.visible = false;
  }

  reject(): void {
    localStorage.removeItem('habeas_data_accepted');
    localStorage.removeItem('access');
    localStorage.removeItem('refresh');
    window.location.href = '/login';
  }
}

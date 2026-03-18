import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { SelectButtonModule } from 'primeng/selectbutton';
import { FormsModule } from '@angular/forms';
import { Theme } from '@app/core/services/theme/theme';

interface FontSizeOption {
  label: string;
  value: number;
  icon: string;
}

@Component({
  selector: 'app-accessibility',
  standalone: true,
  imports: [CommonModule, ButtonModule, DialogModule, SelectButtonModule, FormsModule],
  template: `
    <p-button 
      icon="pi pi-wrench"
      (onClick)="showDialog()" 
      severity="primary"
      class="accessibility-btn"
      [title]="'Accesibilidad'"
    ></p-button>

    <p-dialog 
      header="Configuración de Accesibilidad" 
      [(visible)]="visible" 
      [modal]="true" 
      [style]="{width: '400px'}"
      [draggable]="false"
    >
      <div class="flex flex-col gap-6">
        <!-- Tamaño de letra -->
        <div>
          <label class="block text-sm font-medium mb-3">
            <i class="pi pi-text-height mr-2"></i>Tamaño de letra
          </label>
          <div class="flex gap-2">
            @for (option of fontSizeOptions; track option.value) {
              <p-button 
                [label]="option.label"
                [icon]="option.icon"
                [severity]="currentFontSize === option.value ? 'primary' : 'secondary'"
                [outlined]="currentFontSize !== option.value"
                (onClick)="setFontSize(option.value)"
                class="font-size-btn"
              ></p-button>
            }
          </div>
        </div>

        <!-- Contraste -->
        <div>
          <label class="block text-sm font-medium mb-3">
            <i class="pi pi-sun mr-2"></i>Modo de contraste
          </label>
          <div class="flex gap-2">
            <p-button 
              label="Normal"
              icon="pi pi-sun"
              [severity]="currentTheme === 'light' ? 'primary' : 'secondary'"
              [outlined]="currentTheme !== 'light'"
              (onClick)="setTheme('light')"
            ></p-button>
            <p-button 
              label="Oscuro"
              icon="pi pi-moon"
              [severity]="currentTheme === 'dark' ? 'primary' : 'secondary'"
              [outlined]="currentTheme !== 'dark'"
              (onClick)="setTheme('dark')"
            ></p-button>
          </div>
        </div>

        <!-- Alto contraste -->
        <div>
          <label class="block text-sm font-medium mb-3">
            <i class="pi pi-eye mr-2"></i>Alto contraste
          </label>
          <div class="flex gap-2">
            <p-button 
              label="Desactivado"
              [severity]="!highContrast ? 'primary' : 'secondary'"
              [outlined]="highContrast"
              (onClick)="setHighContrast(false)"
            ></p-button>
            <p-button 
              label="Activar"
              [severity]="highContrast ? 'primary' : 'secondary'"
              [outlined]="!highContrast"
              (onClick)="setHighContrast(true)"
            ></p-button>
          </div>
        </div>
      </div>

      <ng-template pTemplate="footer">
        <p-button 
          label="Cerrar" 
          severity="secondary" 
          (onClick)="visible = false"
        ></p-button>
      </ng-template>
    </p-dialog>
  `,
  styles: [`
    :host ::ng-deep .accessibility-btn .p-button {
      padding: 0.25rem;
      width: 2rem;
      height: 2rem;
    }

    :host ::ng-deep .accessibility-btn .p-button-icon {
      font-size: 1rem;
    }

    :host ::ng-deep .font-size-btn {
      min-width: 60px;
    }

    :host ::ng-deep .high-contrast {
      --contrast-bg: #000000;
      --contrast-text: #ffffff;
      --contrast-primary: #ffff00;
    }

    :host ::ng-deep .high-contrast body,
    :host ::ng-deep .high-contrast .bg-surface-0,
    :host ::ng-deep .high-contrast .bg-surface-100 {
      background-color: #000000 !important;
      color: #ffffff !important;
    }

    :host ::ng-deep .high-contrast .text-surface-900,
    :host ::ng-deep .high-contrast .text-surface-700 {
      color: #ffffff !important;
    }

    :host ::ng-deep .high-contrast .border-surface-200,
    :host ::ng-deep .high-contrast .border-surface-300 {
      border-color: #ffffff !important;
    }
  `]
})
export class AccessibilityComponent {
  private theme = inject(Theme);

  visible = false;
  currentFontSize = 16;
  currentTheme = 'light';
  highContrast = false;

  private readonly FONT_SIZE_KEY = 'accessibility_font_size';
  private readonly THEME_KEY = 'theme';
  private readonly HIGH_CONTRAST_KEY = 'accessibility_high_contrast';

  fontSizeOptions: FontSizeOption[] = [
    { label: 'Normal', value: 14, icon: 'pi pi-minus' },
    { label: 'Grande', value: 16, icon: 'pi pi-plus' },
    { label: 'Extra', value: 18, icon: 'pi pi-angle-double-up' }
  ];

  constructor() {
    this.loadSettings();
  }

  private loadSettings(): void {
    const savedFontSize = localStorage.getItem(this.FONT_SIZE_KEY);
    if (savedFontSize) {
      this.currentFontSize = parseInt(savedFontSize, 10);
    }

    const savedTheme = localStorage.getItem(this.THEME_KEY);
    this.currentTheme = savedTheme || 'light';

    const savedContrast = localStorage.getItem(this.HIGH_CONTRAST_KEY);
    this.highContrast = savedContrast === 'true';

    this.applySettings();
  }

  showDialog(): void {
    this.visible = true;
  }

  setFontSize(size: number): void {
    this.currentFontSize = size;
    localStorage.setItem(this.FONT_SIZE_KEY, size.toString());
    this.applySettings();
  }

  setTheme(theme: string): void {
    this.currentTheme = theme;
    this.theme.set(theme);
    localStorage.setItem(this.THEME_KEY, theme);
  }

  setHighContrast(enabled: boolean): void {
    this.highContrast = enabled;
    localStorage.setItem(this.HIGH_CONTRAST_KEY, enabled.toString());
    this.applySettings();
  }

  private applySettings(): void {
    document.documentElement.style.fontSize = `${this.currentFontSize}px`;

    if (this.highContrast) {
      document.body.classList.add('high-contrast');
    } else {
      document.body.classList.remove('high-contrast');
    }
  }
}

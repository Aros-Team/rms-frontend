import { Component, inject, OnInit } from '@angular/core';
import { ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { Theme } from '@app/core/services/theme/theme';

interface FontSizeOption {
  label: string;
  value: number;
  icon: string;
}

@Component({
  selector: 'app-accessibility',
  standalone: true,
  imports: [ButtonModule, DialogModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button 
      type="button"
      class="accessibility-btn"
      (click)="openDialog()"
      title="Accesibilidad"
      aria-label="Abrir configuración de accesibilidad"
    >
      <svg width="24" height="24" viewBox="0 0 100 100" fill="currentColor">
        <circle cx="50" cy="50" r="48" fill="none" stroke="currentColor" stroke-width="4"/>
        <circle cx="50" cy="22" r="10"/>
        <line x1="50" y1="32" x2="50" y2="58" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
        <line x1="15" y1="45" x2="85" y2="45" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
        <line x1="50" y1="58" x2="30" y2="88" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
        <line x1="50" y1="58" x2="70" y2="88" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
      </svg>
    </button>

    <p-dialog 
      header="Configuración de Accesibilidad" 
      [(visible)]="dialogVisible" 
      [modal]="false" 
      [closable]="true"
      [closeOnEscape]="true"
      [draggable]="false"
      [resizable]="false"
      [style]="{ width: '400px' }"
      [appendTo]="'body'"
      styleClass="accessibility-dialog"
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
              ></p-button>
            }
          </div>
        </div>

        <!-- Modo tema -->
        <div>
          <label class="block text-sm font-medium mb-3">
            <i class="pi pi-sun mr-2"></i>Modo
          </label>
          <div class="flex gap-2">
            <p-button 
              label="Diurno"
              icon="pi pi-sun"
              [severity]="currentTheme === 'light' ? 'primary' : 'secondary'"
              [outlined]="currentTheme !== 'light'"
              (onClick)="setTheme('light')"
            ></p-button>
            <p-button 
              label="Nocturno"
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
          (onClick)="closeDialog()"
        ></p-button>
      </ng-template>
    </p-dialog>
  `,
  styles: [`
    :host {
      display: inline-block;
      position: fixed;
      bottom: 1rem;
      right: 1rem;
      z-index: 2147483647;
    }

    .accessibility-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 3rem;
      height: 3rem;
      padding: 0;
      border: none;
      border-radius: 50%;
      background: #4c86e5;
      color: white;
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 4px 12px rgba(76, 134, 229, 0.4);
    }

    .accessibility-btn:hover {
      background: #3a6fd1;
      transform: scale(1.05);
      box-shadow: 0 6px 16px rgba(76, 134, 229, 0.5);
    }

    .accessibility-btn:focus {
      outline: 3px solid #4c86e5;
      outline-offset: 3px;
    }

    .accessibility-btn svg {
      width: 1.5rem;
      height: 1.5rem;
    }
  `]
})
export class AccessibilityComponent implements OnInit {
  private theme = inject(Theme);

  dialogVisible = false;
  currentFontSize = 16;
  currentTheme = 'light';
  highContrast = false;

  private readonly FONT_SIZE_KEY = 'accessibility_font_size';
  private readonly THEME_KEY = 'theme';
  private readonly HIGH_CONTRAST_KEY = 'accessibility_high_contrast';

  fontSizeOptions: FontSizeOption[] = [
    { label: 'Pequeño', value: 14, icon: 'pi pi-minus' },
    { label: 'Normal', value: 16, icon: 'pi pi-plus' },
    { label: 'Grande', value: 18, icon: 'pi pi-angle-double-up' }
  ];

  ngOnInit(): void {
    this.loadSettings();
  }

  private loadSettings(): void {
    const savedFontSize = localStorage.getItem(this.FONT_SIZE_KEY);
    if (savedFontSize) {
      const parsed = parseInt(savedFontSize, 10);
      if (!isNaN(parsed) && [14, 16, 18].includes(parsed)) {
        this.currentFontSize = parsed;
      }
    }

    const savedTheme = localStorage.getItem(this.THEME_KEY);
    this.currentTheme = savedTheme || 'light';
    this.theme.set(this.currentTheme);

    const savedContrast = localStorage.getItem(this.HIGH_CONTRAST_KEY);
    this.highContrast = savedContrast === 'true';

    this.applySettings();
  }

  openDialog(): void {
    this.dialogVisible = true;
  }

  closeDialog(): void {
    this.dialogVisible = false;
  }

  setFontSize(size: number): void {
    this.currentFontSize = size;
    localStorage.setItem(this.FONT_SIZE_KEY, size.toString());
    this.applySettings();
  }

  setTheme(theme: string): void {
    this.currentTheme = theme;
    localStorage.setItem(this.THEME_KEY, theme);
    this.theme.set(theme);
  }

  setHighContrast(enabled: boolean): void {
    this.highContrast = enabled;
    localStorage.setItem(this.HIGH_CONTRAST_KEY, enabled.toString());
    this.applySettings();
  }

  private applySettings(): void {
    const fontScale = this.currentFontSize / 16;
    document.documentElement.style.setProperty('--font-scale', fontScale.toString());
    document.documentElement.style.fontSize = `${this.currentFontSize}px`;

    if (this.highContrast) {
      document.body.classList.add('high-contrast');
    } else {
      document.body.classList.remove('high-contrast');
    }
  }
}
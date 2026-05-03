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
  imports: [ButtonModule, DialogModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './accessibility.html',
  styleUrl: './accessibility.css',
})
export class Accessibility implements OnInit {
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
    this.currentTheme = savedTheme ?? 'light';
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
    document.documentElement.style.fontSize = this.currentFontSize.toString() + 'px';

    if (this.highContrast) {
      document.body.classList.add('high-contrast');
    } else {
      document.body.classList.remove('high-contrast');
    }
  }
}
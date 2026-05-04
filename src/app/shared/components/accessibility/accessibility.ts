import { Component, inject, OnInit, ElementRef, ViewChild, ChangeDetectorRef } from '@angular/core';
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
  templateUrl: './accessibility.html',
  styleUrl: './accessibility.css',
})
export class Accessibility implements OnInit {
  private theme = inject(Theme);
  private cdr = inject(ChangeDetectorRef);

  dialogVisible = false;
  currentFontSize = 16;
  currentTheme = 'light';
  highContrast = false;

  private readonly FONT_SIZE_KEY = 'accessibility_font_size';
  private readonly THEME_KEY = 'theme';
  private readonly HIGH_CONTRAST_KEY = 'accessibility_high_contrast';
  private readonly POSITION_KEY = 'accessibility_button_position';

  @ViewChild('dragBtn') dragBtn!: ElementRef;

  isDragging = false;
  startX = 0;
  startY = 0;
  initialLeft = 0;
  initialTop = 0;

  buttonPosition = { left: window.innerWidth - 80, top: window.innerHeight - 80 };

  fontSizeOptions: FontSizeOption[] = [
    { label: 'Pequeño', value: 14, icon: 'pi pi-minus' },
    { label: 'Normal', value: 16, icon: 'pi pi-plus' },
    { label: 'Grande', value: 18, icon: 'pi pi-angle-double-up' }
  ];

  ngOnInit(): void {
    this.loadSettings();
    this.loadPosition();
  }

  private loadPosition(): void {
    const savedPosition = localStorage.getItem(this.POSITION_KEY);
    if (savedPosition) {
      try {
        const pos = JSON.parse(savedPosition) as { left: number; top: number };
        this.buttonPosition = {
          left: Math.max(0, Math.min(window.innerWidth - 60, pos.left)),
          top: Math.max(0, Math.min(window.innerHeight - 60, pos.top))
        };
      } catch {
        this.setDefaultPosition();
      }
    } else {
      this.setDefaultPosition();
    }
  }

  private setDefaultPosition(): void {
    this.buttonPosition = {
      left: window.innerWidth - 80,
      top: window.innerHeight - 80
    };
  }

  private savePosition(): void {
    localStorage.setItem(this.POSITION_KEY, JSON.stringify(this.buttonPosition));
  }

  onMouseDown(event: MouseEvent | TouchEvent): void {
    event.preventDefault();
    this.isDragging = false;

    const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
    const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;

    this.startX = clientX;
    this.startY = clientY;
    this.initialLeft = this.buttonPosition.left;
    this.initialTop = this.buttonPosition.top;

    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('mouseup', this.onMouseUp);
    document.addEventListener('touchmove', this.onTouchMove);
    document.addEventListener('touchend', this.onTouchEnd);
  }

  private onMouseMove = (event: MouseEvent): void => {
    const deltaX = event.clientX - this.startX;
    const deltaY = event.clientY - this.startY;

    if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
      this.isDragging = true;
    }

    this.buttonPosition = {
      left: Math.max(0, Math.min(window.innerWidth - 60, this.initialLeft + deltaX)),
      top: Math.max(0, Math.min(window.innerHeight - 60, this.initialTop + deltaY))
    };
    this.cdr.detectChanges();
  };

  private onMouseUp = (): void => {
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('mouseup', this.onMouseUp);
    this.savePosition();
  };

  private onTouchMove = (event: TouchEvent): void => {
    const deltaX = event.touches[0].clientX - this.startX;
    const deltaY = event.touches[0].clientY - this.startY;

    if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
      this.isDragging = true;
    }

    this.buttonPosition = {
      left: Math.max(0, Math.min(window.innerWidth - 60, this.initialLeft + deltaX)),
      top: Math.max(0, Math.min(window.innerHeight - 60, this.initialTop + deltaY))
    };
    this.cdr.detectChanges();
  };

  private onTouchEnd = (): void => {
    document.removeEventListener('touchmove', this.onTouchMove);
    document.removeEventListener('touchend', this.onTouchEnd);
    this.savePosition();
  };

  onClick(): void {
    if (!this.isDragging) {
      this.openDialog();
    }
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
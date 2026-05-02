import { Injectable, signal, effect } from '@angular/core';

export type FontSize = 'small' | 'normal' | 'large' | 'extra-large';
export type ContrastMode = 'normal' | 'high';

export interface AccessibilitySettings {
  fontSize: FontSize;
  contrastMode: ContrastMode;
}

@Injectable({
  providedIn: 'root'
})
export class Accessibility {
  private readonly STORAGE_KEY = 'accessibility_settings';
  
  readonly fontSize = signal<FontSize>('normal');
  readonly contrastMode = signal<ContrastMode>('normal');

  private readonly fontSizeMap: Record<FontSize, string> = {
    'small': '14px',
    'normal': '16px',
    'large': '18px',
    'extra-large': '20px'
  };

  constructor() {
    this.loadSettings();
    
    effect(() => {
      this.applyFontSize(this.fontSize());
    });
    
    effect(() => {
      this.applyContrast(this.contrastMode());
    });
  }

  setFontSize(size: FontSize): void {
    this.fontSize.set(size);
    this.saveSettings();
  }

  setContrastMode(mode: ContrastMode): void {
    this.contrastMode.set(mode);
    this.saveSettings();
  }

  private applyFontSize(size: FontSize): void {
    const root = document.documentElement;
    root.style.fontSize = this.fontSizeMap[size];
    root.setAttribute('data-font-size', size);
  }

  private applyContrast(mode: ContrastMode): void {
    const root = document.documentElement;
    if (mode === 'high') {
      root.setAttribute('data-contrast', 'high');
    } else {
      root.removeAttribute('data-contrast');
    }
  }

  private loadSettings(): void {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) {
      try {
        const settings: AccessibilitySettings = JSON.parse(stored);
        this.fontSize.set(settings.fontSize || 'normal');
        this.contrastMode.set(settings.contrastMode || 'normal');
      } catch {
        this.fontSize.set('normal');
        this.contrastMode.set('normal');
      }
    }
  }

  private saveSettings(): void {
    const settings: AccessibilitySettings = {
      fontSize: this.fontSize(),
      contrastMode: this.contrastMode()
    };
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(settings));
  }

  getSettings(): AccessibilitySettings {
    return {
      fontSize: this.fontSize(),
      contrastMode: this.contrastMode()
    };
  }
}
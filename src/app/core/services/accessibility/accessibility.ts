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

  /**
   * Scale factor applied on top of whatever the user configured in their
   * browser/OS. Never hard-code an absolute `px` root size: doing so would
   * override the browser's minimum font size and OS text scaling, which is
   * exactly what visually impaired users rely on.
   *
   * `normal` (1) leaves the root font size untouched.
   */
  private readonly fontSizeMap: Record<FontSize, number> = {
    'small': 0.875,
    'normal': 1,
    'large': 1.125,
    'extra-large': 1.25
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
    const scale = this.fontSizeMap[size];

    // `normal` must not pin a size: leave the user's own root font-size alone.
    if (scale === 1) {
      root.style.removeProperty('font-size');
    } else {
      root.style.fontSize = `${String(scale * 100)}%`;
    }
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
        const parsed: unknown = JSON.parse(stored);
        if (parsed && typeof parsed === 'object') {
          const settings = parsed as Record<string, unknown>;
          const fontSize = settings['fontSize'];
          const contrastMode = settings['contrastMode'];
          if (fontSize === 'small' || fontSize === 'normal' || fontSize === 'large' || fontSize === 'extra-large') {
            this.fontSize.set(fontSize);
          }
          if (contrastMode === 'normal' || contrastMode === 'high') {
            this.contrastMode.set(contrastMode);
          }
        }
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
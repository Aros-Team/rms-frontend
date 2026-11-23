import { Injectable } from '@angular/core';

export type ThemeName = 'light' | 'dark';

const STORAGE_KEY = 'theme';

/** Address-bar colours; match the manifest and `index.html`. */
const CHROME_LIGHT = '#FDEFC7';
const CHROME_DARK = '#0f172a';

@Injectable({
  providedIn: 'root'
})
export class Theme {
  private mediaQuery?: MediaQueryList;

  /**
   * Applies the user's stored preference, or the system preference when they
   * have none. Deliberately does NOT persist anything on first run: writing a
   * value here would pin the theme forever and stop it from following the OS
   * (many systems switch automatically at sunset).
   */
  setDefault(): void {
    const stored = this.readStored();

    this.apply(stored ?? this.systemTheme());

    // Keep following the OS while the user has no explicit override.
    if (!stored && typeof window.matchMedia === 'function' && !this.mediaQuery) {
      this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      this.mediaQuery.addEventListener('change', () => {
        if (!this.readStored()) {
          this.apply(this.systemTheme());
        }
      });
    }
  }

  // Get the effective theme (stored preference, else the system preference)
  get(): ThemeName {
    return this.readStored() ?? this.systemTheme();
  }

  // Set theme, persist it and apply it
  set(theme: ThemeName): void {
    localStorage.setItem(STORAGE_KEY, theme);
    this.apply(theme);
  }

  /**
   * Two-state toggle: flips what the user currently sees. When the result
   * matches the system preference the override is dropped, so the app goes
   * back to following the OS.
   */
  toggle(): void {
    const target: ThemeName = this.get() === 'light' ? 'dark' : 'light';

    if (target === this.systemTheme()) {
      localStorage.removeItem(STORAGE_KEY);
      this.apply(target);
      return;
    }

    this.set(target);
  }

  // Check if dark mode is active
  isDark(): boolean {
    return this.get() === 'dark';
  }

  private readStored(): ThemeName | null {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'dark' || stored === 'light' ? stored : null;
  }

  private systemTheme(): ThemeName {
    const prefersDark =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches;
    return prefersDark ? 'dark' : 'light';
  }

  /** Applies a theme to the DOM without persisting it. */
  private apply(theme: ThemeName): void {
    if (typeof document === 'undefined') return;

    const element = document.documentElement;

    element.classList.toggle('dark', theme === 'dark');

    // Keep the <meta> in sync: it drives `color-scheme`, which themes native
    // UI (scrollbars, form controls, canvas) and prevents FOUC on reload.
    document
      .querySelector('meta[name="color-scheme"]')
      ?.setAttribute('content', theme);

    // Browser chrome: both theme-colour metas carry the active colour with no
    // media query, so the address bar follows a manual toggle instead of only
    // the OS preference.
    const chrome = theme === 'dark' ? CHROME_DARK : CHROME_LIGHT;

    for (const id of ['theme-color-light', 'theme-color-dark']) {
      const meta = document.querySelector<HTMLMetaElement>(`meta[id="${id}"]`);
      meta?.removeAttribute('media');
      meta?.setAttribute('content', chrome);
    }
  }
}

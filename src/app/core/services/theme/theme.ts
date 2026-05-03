import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class Theme {

  setDefault(): void {
    const theme = localStorage.getItem('theme');

    if (!theme) {
      const isdark = window.matchMedia('(prefers-color-scheme: dark)').matches
      if (isdark) {
        this.set('dark');
      } else {
        this.set('light');
      }
    } else {
      this.set(theme);
    }
  }

  // Get current theme (default: light)
  get(): string {
    return localStorage.getItem('theme') ?? 'light';
  }

  // Set theme and handle light/dark classes
  set(theme: string): void {
    const element = document.querySelector('html');
    if (!element) return;

    // Remove both light and dark classes first
    element.classList.remove('light', 'dark');

    // Add the new theme class and save to localStorage
    if (theme === 'dark') {
      element.classList.add('dark');
    }
    // For light, we just don't add the dark class (default)

    localStorage.setItem('theme', theme);

    // Also update body class for better CSS selectors
    document.body.classList.remove('light-theme', 'dark-theme');
    document.body.classList.add(theme === 'dark' ? 'dark-theme' : 'light-theme');
  }

  // Toggle between light and dark
  toggle(): void {
    const current = this.get();
    this.set(current === 'light' ? 'dark' : 'light');
  }

  // Check if dark mode is active
  isDark(): boolean {
    return this.get() === 'dark';
  }
}

if (typeof window !== 'undefined') {
  (window as unknown as { global: typeof window }).global = window;
}
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { registerLocaleData } from '@angular/common';
import localeEs from '@angular/common/locales/es';

// Register Spanish locale
registerLocaleData(localeEs);

bootstrapApplication(App, appConfig)
  .catch((err: unknown) => { console.error(err); });

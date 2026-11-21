// `sockjs-client` still references the Node-style `global` object at runtime.
// ES module imports are hoisted and evaluated first, so this cannot run before
// them; it only has to happen before SockJS opens a transport, which is well
// after bootstrap. If SockJS is ever replaced with a native WebSocket, drop it.
if (typeof window !== 'undefined' && !('global' in window)) {
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

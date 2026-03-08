import { getTestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';

getTestBed().initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());

import './app/shared/legal/legal-consent-modal.component.spec';
import './app/shared/legal/legal-consent-state.service.spec';
import './app/core/auth/auth-session.service.spec';
import './app/core/auth/auth-flow.service.spec';
import './app/core/guards/auth.guard.spec';
import './app/infrastructure/http/interceptors/api-prefix.interceptor.spec';
import './app/infrastructure/http/interceptors/auth.interceptor.spec';
import './app/features/auth/application/auth.facade.spec';

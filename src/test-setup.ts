import { TestBed } from '@angular/core/testing';
import { BrowserDynamicTestingModule, platformBrowserDynamicTesting } from '@angular/platform-browser-dynamic/testing';

// Mock matchMedia for jsdom environment - required by Theme service
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    addListener: () => {},
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    removeListener: () => {},
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    addEventListener: () => {},
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    removeEventListener: () => {},
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    dispatchEvent: () => {},
  }),
});

// eslint-disable-next-line @typescript-eslint/no-deprecated
TestBed.initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());

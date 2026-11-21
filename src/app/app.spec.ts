/**
 * Tests for the root App component.
 *
 * Feature: Root component that hosts the router outlet for navigation.
 * Contract: Creates successfully and renders a router-outlet element.
 * Approach: Bootstrap App via TestBed with router, assert component
 * instance exists and the DOM contains a router-outlet element.
 */
import { TestBed } from '@angular/core/testing';
import { ɵresolveComponentResources as resolveComponentResources } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { MessageService } from 'primeng/api';
import { App } from './app';
import appHtmlContent from './app.html?raw';

// Mock matchMedia for jsdom environment
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

describe('App', () => {
  beforeAll(async () => {
    await resolveComponentResources((url: string) => {
      if (url === './app.html') {
        return Promise.resolve(appHtmlContent as unknown as string);
      }
      // Catch all external templates so adding templateUrl doesn't break tests
      return Promise.resolve('');
    });
  });

  beforeEach(async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        MessageService,
        provideRouter([]),
        provideHttpClient(),
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeInstanceOf(App);
  });

  it('should render router outlet', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const outlet = compiled.querySelector('router-outlet');
    expect(outlet).not.toBeNull();
    expect(outlet?.tagName.toLowerCase()).toBe('router-outlet');
  });
});

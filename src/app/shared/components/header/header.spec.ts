/**
 * Tests for the header identity and account chrome.
 *
 * Feature: the 72px shell header shows the restaurant identity (name plus the
 * admin-only subtitle) on the left and the account controls on the right.
 * Contract:
 *  - ADMIN sees `environment.customer` and the "Panel de administración"
 *    subtitle; the identity block has no fictitious selector (no svg/i);
 *  - the profile control renders the initials, the full name, the role label
 *    and the angle-down chevron;
 *  - the bell badge renders the unread count from NotificationCenter;
 *  - a WORKER identity has no admin subtitle;
 *  - workers get "Mi cuenta" (`/worker/profile`) in the profile menu, above
 *    "Cerrar sesión"; admins do not.
 *
 * Approach: standalone component through TestBed with boundary stubs for Auth
 * and NotificationCenter; resolve the external templates from `?raw` imports
 * and assert rendered content through contextual `data-testid` selectors.
 */
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { Auth } from '@core/services/auth/auth';
import { Menu } from '@core/services/menu/menu';
import { NotificationCenter } from '@core/services/notifications/notification-center';
import { environment } from '@environments/environment';
import { resolveUiResources } from '@shared/ui/testing/ui-test-resources';

import { Header } from './header';
import headerHtml from './header.html?raw';
import logoHtml from '../logo/logo.html?raw';
import buttonHtml from '@shared/ui/button/button.html?raw';

const authStub = {
  userData: () => ({ name: 'Ana Pérez', email: 'ana@rms.test', role: 'ADMIN' }),
};

const notificationCenterStub = {
  start: vi.fn(),
  refresh: vi.fn(),
  markRead: vi.fn(),
  markAllRead: vi.fn(),
  clear: vi.fn(),
  unreadCount: () => 2,
  notifications: () => [],
  workerFeed: () => false,
};

describe('Header', () => {
  beforeAll(async () => {
    await resolveUiResources({
      'header.html': headerHtml as unknown as string,
      'logo.html': logoHtml as unknown as string,
      'button.html': buttonHtml as unknown as string,
    });
  });

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [Header],
      providers: [
        Menu,
        provideRouter([]),
        { provide: Auth, useValue: authStub },
        { provide: NotificationCenter, useValue: notificationCenterStub },
      ],
    });
  });

  function create(role: 'ADMIN' | 'WORKER') {
    const fixture = TestBed.createComponent(Header);
    fixture.componentRef.setInput('role', role);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('renders the restaurant name and the admin subtitle', () => {
    const element = create('ADMIN');

    expect(
      element
        .querySelector('[data-testid="restaurant-identity"] > span:first-child')
        ?.textContent.trim(),
    ).toBe(environment.customer);
    expect(element.querySelector('[data-testid="restaurant-subtitle"]')?.textContent.trim()).toBe(
      'Panel de administración',
    );
  });

  it('does not render a fictitious selector inside the identity block', () => {
    const identity = create('ADMIN').querySelector('[data-testid="restaurant-identity"]');

    expect(identity?.querySelectorAll('svg, i').length).toBe(0);
  });

  it('renders the profile initials, name, role and chevron', () => {
    const element = create('ADMIN');

    expect(element.querySelector('[data-testid="user-avatar"]')?.textContent.trim()).toBe('AP');
    expect(element.querySelector('[data-testid="user-name"]')?.textContent.trim()).toBe(
      'Ana Pérez',
    );
    expect(element.querySelector('[data-testid="user-role"]')?.textContent.trim()).toBe(
      'Administrador',
    );
    expect(
      element
        .querySelector('[data-testid="user-menu-chevron"]')
        ?.classList.contains('pi-angle-down'),
    ).toBe(true);
  });

  it('renders the unread count in the notifications badge', () => {
    const element = create('ADMIN');

    expect(element.querySelector('[data-testid="notifications-badge"]')?.textContent.trim()).toBe(
      '2',
    );
  });

  it('hides the admin subtitle for a worker', () => {
    const element = create('WORKER');

    expect(element.querySelector('[data-testid="restaurant-subtitle"]')).toBeNull();
  });

  it('offers the account settings to workers inside the profile menu', () => {
    const fixture = TestBed.createComponent(Header);
    fixture.componentRef.setInput('role', 'WORKER');
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    element.querySelector<HTMLButtonElement>('[data-testid="user-menu-button"]')?.click();
    fixture.detectChanges();

    const account = element.querySelector('[data-testid="user-menu-account"]');
    expect(account?.getAttribute('href')).toBe('/worker/profile');
    expect(account?.textContent).toContain('Mi cuenta');
  });

  it('does not offer the worker account to an admin', () => {
    const fixture = TestBed.createComponent(Header);
    fixture.componentRef.setInput('role', 'ADMIN');
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    element.querySelector<HTMLButtonElement>('[data-testid="user-menu-button"]')?.click();
    fixture.detectChanges();

    expect(element.querySelector('[data-testid="user-menu-account"]')).toBeNull();
  });
});

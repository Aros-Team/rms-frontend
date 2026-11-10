/**
 * Tests for the ForbiddenPage (403 screen).
 *
 * Feature: Dedicated "authenticated but not allowed" screen, used instead of the
 * server-error page for 403 responses.
 * Contract:
 *  - renders the 403 title and the Spanish explanation
 *  - "Volver al inicio" → the user's area (`/admin` or `/worker`), `/login` when no session
 *  - "Cerrar sesión" → clears the session and goes to `/login`
 *
 * Approach: TestBed with the real component and template, Auth stubbed, Router
 * spied; assert exact rendered heading and exact navigation targets.
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ɵresolveComponentResources as resolveComponentResources } from '@angular/core';
import { Router, provideRouter } from '@angular/router';

import { ForbiddenPage } from './forbidden-page';
import { Auth } from '@services/auth/auth';
import { UserInfo } from '@models/domain/user/user-info';

import forbiddenHtml from './forbidden-page.html?raw';

const ADMIN: UserInfo = {
  id: 1,
  name: 'Ana',
  document: '1',
  email: 'ana@rms.test',
  role: 'ADMIN',
  areas: [],
};

const WORKER: UserInfo = { ...ADMIN, id: 2, name: 'Beto', role: 'WORKER' };

describe('ForbiddenPage', () => {
  let fixture: ComponentFixture<ForbiddenPage>;
  let router: Router;
  let navigateSpy: ReturnType<typeof vi.fn>;
  let auth: { getData: ReturnType<typeof vi.fn>; logout: ReturnType<typeof vi.fn> };

  beforeAll(async () => {
    await resolveComponentResources((url: string) => {
      if (url.endsWith('forbidden-page.html')) {
        return Promise.resolve(forbiddenHtml as string);
      }
      return Promise.reject(new Error(`Unexpected template: ${url}`));
    });
  });

  function setup(userData: UserInfo | undefined): void {
    auth = { getData: vi.fn().mockReturnValue(userData), logout: vi.fn() };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [ForbiddenPage],
      providers: [provideRouter([]), { provide: Auth, useValue: auth }],
    });

    router = TestBed.inject(Router);
    navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    fixture = TestBed.createComponent(ForbiddenPage);
    fixture.detectChanges();
  }

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders the 403 heading and the permission explanation', () => {
    setup(ADMIN);

    const root = fixture.nativeElement as HTMLElement;
    const heading = root.querySelector('h1') as HTMLElement;
    const message = root.querySelector('p') as HTMLElement;

    expect(heading.textContent.trim()).toBe('403 — Acceso restringido');
    expect(message.textContent.trim()).toBe(
      'Tu sesión es válida, pero no tienes permisos para entrar a esta sección. Si crees que es un error, contacta al administrador del restaurante.',
    );
  });

  it('sends an ADMIN back to /admin', () => {
    setup(ADMIN);

    fixture.componentInstance.goHome();

    expect(navigateSpy).toHaveBeenCalledWith(['/admin']);
  });

  it('sends a WORKER back to /worker', () => {
    setup(WORKER);

    fixture.componentInstance.goHome();

    expect(navigateSpy).toHaveBeenCalledWith(['/worker']);
  });

  it('sends an anonymous visitor to /login', () => {
    setup(undefined);

    fixture.componentInstance.goHome();

    expect(navigateSpy).toHaveBeenCalledWith(['/login']);
  });

  it('clears the session and goes to /login on logout', () => {
    setup(ADMIN);

    fixture.componentInstance.logout();

    expect(auth.logout).toHaveBeenCalledTimes(1);
    expect(navigateSpy).toHaveBeenCalledWith(['/login']);
  });
});

/**
 * Tests for the NotFoundPage (404 screen).
 *
 * Feature: Dedicated screen for unknown URLs, replacing the silent redirect to
 * `/login` that made a typo look like a session problem.
 * Contract:
 *  - renders the 404 title and the Spanish explanation
 *  - "Volver al inicio" → the user's area (`/admin` or `/worker`), `/login` when no session
 *  - logout is only offered with a session, and clears it before going to `/login`
 *
 * Approach: TestBed with the real component and template, Auth stubbed, Router
 * spied; assert exact rendered text and exact navigation targets.
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ɵresolveComponentResources as resolveComponentResources } from '@angular/core';
import { Router, provideRouter } from '@angular/router';

import { NotFoundPage } from './not-found-page';
import { Auth } from '@services/auth/auth';
import { UserInfo } from '@models/domain/user/user-info';

import notFoundHtml from './not-found-page.html?raw';

const ADMIN: UserInfo = {
  id: 1,
  name: 'Ana',
  document: '1',
  email: 'ana@rms.test',
  role: 'ADMIN',
  areas: [],
};

const WORKER: UserInfo = { ...ADMIN, id: 2, name: 'Beto', role: 'WORKER' };

describe('NotFoundPage', () => {
  let fixture: ComponentFixture<NotFoundPage>;
  let router: Router;
  let navigateSpy: ReturnType<typeof vi.fn>;
  let auth: { getData: ReturnType<typeof vi.fn>; logout: ReturnType<typeof vi.fn> };

  beforeAll(async () => {
    await resolveComponentResources((url: string) => {
      if (url.endsWith('not-found-page.html')) {
        return Promise.resolve(notFoundHtml as string);
      }
      return Promise.reject(new Error(`Unexpected template: ${url}`));
    });
  });

  function setup(userData: UserInfo | undefined): void {
    auth = { getData: vi.fn().mockReturnValue(userData), logout: vi.fn() };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [NotFoundPage],
      providers: [provideRouter([]), { provide: Auth, useValue: auth }],
    });

    router = TestBed.inject(Router);
    navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    fixture = TestBed.createComponent(NotFoundPage);
    fixture.detectChanges();
  }

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders the 404 heading and the explanation', () => {
    setup(ADMIN);

    const root = fixture.nativeElement as HTMLElement;
    const heading = root.querySelector('h1') as HTMLElement;
    const message = root.querySelector('p') as HTMLElement;

    expect(heading.textContent.trim()).toBe('404 — Página no encontrada');
    expect(message.textContent.trim()).toBe(
      'La dirección a la que intentas entrar no existe o cambió de lugar. Revisa el enlace o vuelve al inicio para seguir trabajando.',
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

  it('only offers logout when there is a session', () => {
    setup(undefined);
    expect(fixture.componentInstance.hasSession()).toBe(false);

    setup(ADMIN);
    expect(fixture.componentInstance.hasSession()).toBe(true);
  });

  it('clears the session and goes to /login on logout', () => {
    setup(ADMIN);

    fixture.componentInstance.logout();

    expect(auth.logout).toHaveBeenCalledTimes(1);
    expect(navigateSpy).toHaveBeenCalledWith(['/login']);
  });
});

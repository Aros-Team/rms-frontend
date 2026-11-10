/**
 * Tests for the login screen's post-authentication navigation.
 *
 * Feature: The login screen must close the `returnUrl` round-trip opened by the
 * guards/interceptor redirect, and fall back to the role-based destination when
 * no (or an unsafe) `returnUrl` is present.
 * Contract:
 *  - `?returnUrl=/admin/orders` + successful login → navigate to `/admin/orders`
 *  - no `returnUrl` → role default (`/admin`, `/worker/kitchen`, `/worker/waiter`)
 *  - unsafe `returnUrl` (`https://evil…`, `//evil…`, `/login`) → role default
 *  - TFA_REQUIRED → `/login/verify`, ignoring `returnUrl`
 *
 * Approach: TestBed with the real component, `ActivatedRoute` stubbed with fixed
 * query params, Auth stubbed (HTTP boundary), Router spied to capture the
 * navigation target. No private-state access.
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ɵresolveComponentResources as resolveComponentResources } from '@angular/core';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { LoginForm } from './login';
import { Auth } from '@services/auth/auth';
import { Logging } from '@core/services/logging/logging';
import { MessageService } from 'primeng/api';
import { UserInfo } from '@models/domain/user/user-info';

import loginHtml from './login.html?raw';

const ADMIN: UserInfo = {
  id: 1,
  name: 'Ana',
  document: '1',
  email: 'ana@rms.test',
  role: 'ADMIN',
  areas: [],
};

const KITCHEN_WORKER: UserInfo = {
  ...ADMIN,
  id: 2,
  name: 'Beto',
  role: 'WORKER',
  areas: [{ id: 1, name: 'Cocina', type: 'KITCHEN' } as UserInfo['areas'][number]],
};

const WAITER: UserInfo = {
  ...ADMIN,
  id: 3,
  name: 'Carla',
  role: 'WORKER',
  areas: [{ id: 2, name: 'Salón', type: 'SERVICE' } as UserInfo['areas'][number]],
};

describe('LoginForm navigation', () => {
  let fixture: ComponentFixture<LoginForm>;
  let component: LoginForm;
  let router: Router;
  let navigateSpy: ReturnType<typeof vi.fn>;
  let navigateByUrlSpy: ReturnType<typeof vi.fn>;
  let auth: {
    login: ReturnType<typeof vi.fn>;
    logout: ReturnType<typeof vi.fn>;
  };

  beforeAll(async () => {
    await resolveComponentResources((url: string) => {
      if (url.endsWith('login.html')) {
        return Promise.resolve(loginHtml as string);
      }
      return Promise.reject(new Error(`Unexpected template: ${url}`));
    });
  });

  function setup(queryParams: Record<string, string>): void {
    auth = { login: vi.fn(), logout: vi.fn() };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [LoginForm],
      providers: [
        provideRouter([]),
        { provide: Auth, useValue: auth },
        { provide: ActivatedRoute, useValue: { queryParams: of(queryParams) } },
        { provide: MessageService, useValue: { add: vi.fn() } },
        {
          provide: Logging,
          useValue: { auth: vi.fn(), routing: vi.fn(), error: vi.fn(), info: vi.fn() },
        },
      ],
    });

    router = TestBed.inject(Router);
    navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    navigateByUrlSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    fixture = TestBed.createComponent(LoginForm);
    component = fixture.componentInstance;
    component.ngOnInit();
    component.form.setValue({
      username: 'ana@rms.test',
      password: 'secret',
      termsAccepted: true,
    });
  }

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('navigates to the returnUrl after a successful login', () => {
    setup({ returnUrl: '/admin/orders' });
    auth.login.mockReturnValue(of(ADMIN));

    component.onSubmit();

    expect(auth.login).toHaveBeenCalledWith({ username: 'ana@rms.test', password: 'secret' });
    expect(navigateByUrlSpy).toHaveBeenCalledTimes(1);
    expect(navigateByUrlSpy).toHaveBeenCalledWith('/admin/orders');
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('falls back to the role destination when no returnUrl is present', () => {
    setup({});
    auth.login.mockReturnValue(of(ADMIN));

    component.onSubmit();

    expect(navigateSpy).toHaveBeenCalledWith(['/admin']);
  });

  it('ignores an external returnUrl and uses the role destination', () => {
    setup({ returnUrl: 'https://evil.example/phish' });
    auth.login.mockReturnValue(of(ADMIN));

    component.onSubmit();

    expect(navigateSpy).toHaveBeenCalledWith(['/admin']);
  });

  it('ignores a protocol-relative returnUrl and uses the role destination', () => {
    setup({ returnUrl: '//evil.example/phish' });
    auth.login.mockReturnValue(of(ADMIN));

    component.onSubmit();

    expect(navigateSpy).toHaveBeenCalledWith(['/admin']);
  });

  it('ignores a returnUrl pointing back to /login', () => {
    setup({ returnUrl: '/login?returnUrl=%2Fadmin' });
    auth.login.mockReturnValue(of(ADMIN));

    component.onSubmit();

    expect(navigateSpy).toHaveBeenCalledWith(['/admin']);
  });

  it('sends a kitchen worker to /worker/kitchen when returning to a safe internal URL is not requested', () => {
    setup({});
    auth.login.mockReturnValue(of(KITCHEN_WORKER));

    component.onSubmit();

    expect(navigateSpy).toHaveBeenCalledWith(['/worker/kitchen']);
  });

  it('sends a waiter to /worker/waiter when no returnUrl is present', () => {
    setup({});
    auth.login.mockReturnValue(of(WAITER));

    component.onSubmit();

    expect(navigateSpy).toHaveBeenCalledWith(['/worker/waiter']);
  });

  it('navigates to the 2FA screen and ignores the returnUrl when 2FA is required', () => {
    setup({ returnUrl: '/admin/orders' });
    auth.login.mockReturnValue(of({ type: 'TFA_REQUIRED' }));

    component.onSubmit();

    expect(navigateSpy).toHaveBeenCalledWith(['/login/verify']);
  });
});

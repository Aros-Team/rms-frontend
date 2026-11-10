/**
 * Tests for the auth-navigation helper (auth failure → screen mapping).
 *
 * Feature: The backend answers 401/403 with bodyless responses, so routing
 * decisions must be derived from the HTTP status alone.
 * Contract:
 *  - 401 (or an error without status) → `/login`, carrying the attempted URL
 *    URL-encoded as `returnUrl`
 *  - 403 → `/forbidden`
 *  - 0 / 5xx → `/server-error`
 *  - `resolveReturnUrl` accepts only internal, non-login paths
 *
 * Approach: Pure functions + a real Router from `provideRouter` to build and
 * serialize UrlTrees; assert exact serialized URLs and exact classifications.
 */
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import {
  classifyAuthFailure,
  loginUrlTree,
  redirectForFailure,
  resolveReturnUrl,
  statusOf,
} from './auth-navigation';

describe('auth-navigation', () => {
  let router: Router;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  describe('classifyAuthFailure', () => {
    it('classifies 401 as unauthenticated', () => {
      expect(classifyAuthFailure(401)).toBe('unauthenticated');
    });

    it('classifies 403 as forbidden', () => {
      expect(classifyAuthFailure(403)).toBe('forbidden');
    });

    it('classifies 500 as server', () => {
      expect(classifyAuthFailure(500)).toBe('server');
    });

    it('classifies 503 as server', () => {
      expect(classifyAuthFailure(503)).toBe('server');
    });

    it('classifies status 0 (network down) as server', () => {
      expect(classifyAuthFailure(0)).toBe('server');
    });

    it('classifies an unknown status as unauthenticated', () => {
      expect(classifyAuthFailure(undefined)).toBe('unauthenticated');
    });
  });

  describe('statusOf', () => {
    it('reads the status from an HttpErrorResponse', () => {
      expect(statusOf(new HttpErrorResponse({ status: 403 }))).toBe(403);
    });

    it('returns undefined for a plain Error', () => {
      expect(statusOf(new Error('No refresh token available'))).toBeUndefined();
    });

    it('returns undefined for a non-object throw', () => {
      expect(statusOf('boom')).toBeUndefined();
    });
  });

  describe('loginUrlTree', () => {
    it('encodes the attempted URL as returnUrl', () => {
      expect(router.serializeUrl(loginUrlTree(router, '/admin/orders'))).toBe(
        '/login?returnUrl=%2Fadmin%2Forders',
      );
    });

    it('omits returnUrl when none is provided', () => {
      expect(router.serializeUrl(loginUrlTree(router))).toBe('/login');
    });
  });

  describe('redirectForFailure', () => {
    it('redirects a 401 to login with the URL-encoded returnUrl', () => {
      const command = redirectForFailure(
        router,
        new HttpErrorResponse({ status: 401 }),
        '/worker/kitchen',
      );
      expect(router.serializeUrl(command.redirectTo)).toBe('/login?returnUrl=%2Fworker%2Fkitchen');
    });

    it('redirects a 403 to /forbidden', () => {
      const command = redirectForFailure(router, new HttpErrorResponse({ status: 403 }), '/admin');
      expect(router.serializeUrl(command.redirectTo)).toBe('/forbidden');
    });

    it('redirects a 500 to /server-error', () => {
      const command = redirectForFailure(router, new HttpErrorResponse({ status: 500 }), '/admin');
      expect(router.serializeUrl(command.redirectTo)).toBe('/server-error');
    });

    it('redirects a status 0 failure to /server-error', () => {
      const command = redirectForFailure(router, new HttpErrorResponse({ status: 0 }), '/admin');
      expect(router.serializeUrl(command.redirectTo)).toBe('/server-error');
    });
  });

  describe('resolveReturnUrl', () => {
    it('accepts an internal path', () => {
      expect(resolveReturnUrl('/admin/manage/products')).toBe('/admin/manage/products');
    });

    it('accepts an internal path with query params', () => {
      expect(resolveReturnUrl('/worker?tab=pedidos')).toBe('/worker?tab=pedidos');
    });

    it('rejects an absolute external URL', () => {
      expect(resolveReturnUrl('https://evil.example/steal')).toBeNull();
    });

    it('rejects a protocol-relative URL', () => {
      expect(resolveReturnUrl('//evil.example/steal')).toBeNull();
    });

    it('rejects the login screen itself (would loop)', () => {
      expect(resolveReturnUrl('/login')).toBeNull();
    });

    it('rejects a login URL with query params', () => {
      expect(resolveReturnUrl('/login?returnUrl=%2Fadmin')).toBeNull();
    });

    it('returns null for missing input', () => {
      expect(resolveReturnUrl(undefined)).toBeNull();
    });
  });
});

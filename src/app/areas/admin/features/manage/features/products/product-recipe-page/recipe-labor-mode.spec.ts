/**
 * Tests for the recipe labor-mode reader.
 *
 * Feature: surface the configured `labor_cost_mode` (AUTO/REAL/STANDARD)
 * without inventing an endpoint.
 * Contract:
 *  - reads `GET /v1/config` and returns the `labor_cost_mode` entry value
 *  - returns null when the entry is missing
 *  - returns null instead of failing the page when the config request errors
 *  - labels known modes in Spanish and unknown values verbatim
 *
 * Approach: HttpClientTestingBackend flushes a controlled envelope-free body
 * (the app interceptor unwraps `{ data }` in production; the service types the
 * payload) and a 500 error for the failure case.
 */
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { RecipeLaborMode, laborModeLabel } from './recipe-labor-mode';

function setup() {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting()],
  });
  return {
    service: TestBed.inject(RecipeLaborMode),
    http: TestBed.inject(HttpTestingController),
  };
}

describe('RecipeLaborMode', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('returns the configured mode from the general group', () => {
    const { service, http } = setup();
    let value: string | null = null;
    service.load().subscribe((mode) => {
      value = mode;
    });

    const request = http.expectOne('v1/config');
    request.flush([
      { entries: [{ key: 'default_currency', value: 'COP' }] },
      { entries: [{ key: 'labor_cost_mode', value: 'REAL' }] },
    ]);

    expect(value).toBe('REAL');
    http.verify();
  });

  it('returns null when the entry is missing', () => {
    const { service, http } = setup();
    let value: string | null = 'unset';
    service.load().subscribe((mode) => {
      value = mode;
    });
    http.expectOne('v1/config').flush([{ entries: [] }]);

    expect(value).toBeNull();
  });

  it('returns null when the config request fails', () => {
    const { service, http } = setup();
    let value: string | null = 'unset';
    service.load().subscribe((mode) => {
      value = mode;
    });
    http
      .expectOne('v1/config')
      .flush({ detail: 'forbidden' }, { status: 403, statusText: 'Forbidden' });

    expect(value).toBeNull();
  });
});

describe('laborModeLabel', () => {
  it('labels the three known modes', () => {
    expect(laborModeLabel('AUTO')).toBe('Automático (AUTO)');
    expect(laborModeLabel('REAL')).toBe('Real (REAL)');
    expect(laborModeLabel('STANDARD')).toBe('Estándar (STANDARD)');
  });

  it('renders "No disponible" without a value and keeps unknown values', () => {
    expect(laborModeLabel(null)).toBe('No disponible');
    expect(laborModeLabel('')).toBe('No disponible');
    expect(laborModeLabel('CUSTOM')).toBe('CUSTOM');
  });
});

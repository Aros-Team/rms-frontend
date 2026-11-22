/**
 * Tests for the cash-shift HTTP client.
 *
 * Feature: open, close, read the current shift and read the Z-summary.
 * Contract:
 *  - `GET /cash-shifts/current` normalizes the 204 body to `null`;
 *  - open/close serialize amounts as two-decimal strings and omit empty notes;
 *  - close trims the notes;
 *  - envelopes are unwrapped by the interceptor;
 *  - HTTP errors reach the caller.
 *
 * Approach: HttpTestingController with the real envelope interceptor.
 */
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { envelopeInterceptor } from '@app/core/interceptors/envelope/envelope';
import type {
  CashShiftResponse,
  CashShiftSummaryResponse,
} from '@app/shared/models/dto/cash-shifts/cash-shift';
import { CashShift } from './cash-shift';

const shift: CashShiftResponse = {
  id: 2,
  status: 'OPEN',
  currency: 'COP',
  openedBy: 1013,
  openedAt: '2026-11-21T21:45:23',
  openingFloat: { amount: '100000.00', currency: 'COP' },
  notes: null,
};

const summary: CashShiftSummaryResponse = {
  id: 2,
  status: 'CLOSED',
  currency: 'COP',
  openedBy: 1013,
  openedAt: '2026-11-21T21:45:23',
  closedBy: 1013,
  closedAt: '2026-11-21T23:00:00',
  openingFloat: { amount: '100000.00', currency: 'COP' },
  paymentsCount: 3,
  voidedCount: 1,
  subtotal: { amount: '126000.00', currency: 'COP' },
  discounts: { amount: '0.00', currency: 'COP' },
  tips: { amount: '0.00', currency: 'COP' },
  totalCharged: { amount: '126000.00', currency: 'COP' },
  cash: { amount: '126000.00', currency: 'COP' },
  card: { amount: '0.00', currency: 'COP' },
  transfer: { amount: '0.00', currency: 'COP' },
  changeGiven: { amount: '0.00', currency: 'COP' },
  paidIn: { amount: '0.00', currency: 'COP' },
  paidOut: { amount: '0.00', currency: 'COP' },
  expectedCash: { amount: '226000.00', currency: 'COP' },
  countedCash: { amount: '225000.00', currency: 'COP' },
  difference: { amount: '-1000.00', currency: 'COP' },
  notes: 'Cierre turno noche',
};

describe('CashShift', () => {
  let service: CashShift;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([envelopeInterceptor])),
        provideHttpClientTesting(),
        CashShift,
      ],
    });
    service = TestBed.inject(CashShift);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('returns the current shift from the envelope', () => {
    let result: CashShiftResponse | null = null;
    service.getCurrent().subscribe((value) => {
      result = value;
    });

    const request = httpMock.expectOne('v1/cash-shifts/current');
    expect(request.request.method).toBe('GET');
    request.flush({ data: shift });

    expect(result?.id).toBe(2);
  });

  it('normalizes a 204 current-shift response to null', () => {
    let result: CashShiftResponse | null | undefined;
    service.getCurrent().subscribe((value) => {
      result = value;
    });

    const request = httpMock.expectOne('v1/cash-shifts/current');
    request.flush(null, { status: 204, statusText: 'No Content' });

    expect(result).toBeNull();
  });

  it('opens a shift with a two-decimal float', () => {
    let result: CashShiftResponse | null = null;
    service.open(100000).subscribe((value) => {
      result = value;
    });

    const request = httpMock.expectOne('v1/cash-shifts/open');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ openingFloat: '100000.00' });
    request.flush({ data: shift }, { status: 201, statusText: 'Created' });

    expect(result?.status).toBe('OPEN');
  });

  it('closes a shift with the counted cash and trimmed notes', () => {
    let result: CashShiftSummaryResponse | null = null;
    service.close(2, 225000, '  Cierre turno noche  ').subscribe((value) => {
      result = value;
    });

    const request = httpMock.expectOne('v1/cash-shifts/2/close');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      countedCash: '225000.00',
      notes: 'Cierre turno noche',
    });
    request.flush({ data: summary });

    expect(result?.difference).toEqual({ amount: '-1000.00', currency: 'COP' });
  });

  it('omits empty close notes', () => {
    service.close(2, 225000, '   ').subscribe();

    const request = httpMock.expectOne('v1/cash-shifts/2/close');
    expect(request.request.body).toEqual({ countedCash: '225000.00' });
    request.flush({ data: summary });
  });

  it('reads the shift summary by id', () => {
    let result: CashShiftSummaryResponse | null = null;
    service.getSummary(2).subscribe((value) => {
      result = value;
    });

    const request = httpMock.expectOne('v1/cash-shifts/2');
    request.flush({ data: summary });

    expect(result?.expectedCash).toEqual({ amount: '226000.00', currency: 'COP' });
  });

  it('propagates a shift conflict', () => {
    let status: number | null = null;
    service.open(1000).subscribe({
      error: (error: { status: number }) => {
        status = error.status;
      },
    });

    const request = httpMock.expectOne('v1/cash-shifts/open');
    request.flush(
      { detail: 'A shift is already open' },
      { status: 409, statusText: 'Conflict' },
    );

    expect(status).toBe(409);
  });
});

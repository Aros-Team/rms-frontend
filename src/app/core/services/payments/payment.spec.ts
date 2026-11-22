/**
 * Tests for the payments HTTP client.
 *
 * Feature: call the five payments endpoints with the right URLs, query params,
 * idempotency header and wire body.
 * Contract:
 *  - pending/journal pages are unwrapped from `{ data: { items, total, ... } }`;
 *  - `POST /payments` sends `Idempotency-Key` and never a client total;
 *  - void sends the trimmed reason;
 *  - filters map to the exact query parameters;
 *  - HTTP errors reach the caller untouched.
 *
 * Approach: HttpTestingController with the real envelope interceptor, so the
 * flushed bodies match the API byte-for-byte.
 */
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';

import { envelopeInterceptor } from '@app/core/interceptors/envelope/envelope';
import type { Page } from '@app/shared/models/dto/common/pagination';
import type { PaymentResponse } from '@app/shared/models/dto/payments/payment-response';
import type { PaymentSummaryResponse } from '@app/shared/models/dto/payments/payment-summary-response';
import type { PendingOrderResponse } from '@app/shared/models/dto/payments/pending-order-response';
import { Payment } from './payment';

const pending: PendingOrderResponse = {
  orderId: 900029,
  tableId: 2,
  tableNumber: 2,
  partySize: 2,
  deliveredAt: '2026-11-21T11:01:00',
  total: { amount: '126000.00', currency: 'COP' },
  paymentStatus: 'UNPAID',
};

const payment: PaymentResponse = {
  id: 1,
  orderId: 900029,
  status: 'COMPLETED',
  receiptNumber: 'R-20261121-000001',
  currency: 'COP',
  subtotal: { amount: '126000.00', currency: 'COP' },
  discount: { amount: '0.00', currency: 'COP' },
  tip: { amount: '0.00', currency: 'COP' },
  total: { amount: '126000.00', currency: 'COP' },
  tendered: { amount: '126000.00', currency: 'COP' },
  change: { amount: '0.00', currency: 'COP' },
  tenders: [{ method: 'CASH', amount: { amount: '126000.00', currency: 'COP' }, reference: null }],
  cashierId: 1013,
  shiftId: 2,
  createdAt: '2026-11-21T21:45:22',
  completedAt: '2026-11-21T21:45:22',
  voidedAt: null,
  voidedBy: null,
  voidReason: null,
};

const summary: PaymentSummaryResponse = {
  id: 1,
  orderId: 900029,
  status: 'COMPLETED',
  receiptNumber: 'R-20261121-000001',
  currency: 'COP',
  subtotal: { amount: '126000.00', currency: 'COP' },
  discount: { amount: '0.00', currency: 'COP' },
  tip: { amount: '0.00', currency: 'COP' },
  total: { amount: '126000.00', currency: 'COP' },
  cashierId: 1013,
  shiftId: 2,
  completedAt: '2026-11-21T21:45:22',
  voidedAt: null,
  voidReason: null,
};

describe('Payment', () => {
  let service: Payment;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([envelopeInterceptor])),
        provideHttpClientTesting(),
        Payment,
      ],
    });
    service = TestBed.inject(Payment);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('fetches the pending board with date, exact search and paging', () => {
    let page: Page<PendingOrderResponse> | null = null;
    service
      .getPending({ date: '2026-11-21', search: '2', page: 1, size: 10 })
      .subscribe((value) => {
        page = value;
      });

    const request = httpMock.expectOne((candidate) => candidate.url === 'v1/payments/pending');
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('date')).toBe('2026-11-21');
    expect(request.request.params.get('search')).toBe('2');
    expect(request.request.params.get('page')).toBe('1');
    expect(request.request.params.get('size')).toBe('10');

    request.flush({
      data: { items: [pending], total: 1, page: 1, size: 10, total_pages: 1 },
    });

    expect(page?.items).toEqual([pending]);
    expect(page?.total).toBe(1);
  });

  it('defaults the pending page to 0/20 and omits empty filters', () => {
    service.getPending().subscribe();

    const request = httpMock.expectOne((candidate) => candidate.url === 'v1/payments/pending');
    expect(request.request.params.get('page')).toBe('0');
    expect(request.request.params.get('size')).toBe('20');
    expect(request.request.params.has('date')).toBe(false);
    expect(request.request.params.has('search')).toBe(false);
    request.flush({ data: { items: [], total: 0, page: 0, size: 20, total_pages: 0 } });
  });

  it('charges with the idempotency header and the exact body', () => {
    let result: PaymentResponse | null = null;
    service
      .charge(
        {
          orderId: 900029,
          tipAmount: '5000.00',
          discount: { type: 'PERCENT', value: '10.00', reason: 'Cortesía' },
          tenders: [
            { method: 'CARD', amount: '60000.00', reference: 'AUTH-1' },
            { method: 'CASH', amount: '60000.00' },
          ],
        },
        'key-123',
      )
      .subscribe((value) => {
        result = value;
      });

    const request = httpMock.expectOne((candidate) => candidate.url === 'v1/payments');
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('Idempotency-Key')).toBe('key-123');
    expect(request.request.body).toEqual({
      orderId: 900029,
      tipAmount: '5000.00',
      discount: { type: 'PERCENT', value: '10.00', reason: 'Cortesía' },
      tenders: [
        { method: 'CARD', amount: '60000.00', reference: 'AUTH-1' },
        { method: 'CASH', amount: '60000.00' },
      ],
    });
    request.flush({ data: payment }, { status: 201, statusText: 'Created' });

    expect(result?.id).toBe(1);
  });

  it('gets a payment by id', () => {
    let result: PaymentResponse | null = null;
    service.getById(1).subscribe((value) => {
      result = value;
    });

    const request = httpMock.expectOne('v1/payments/1');
    expect(request.request.method).toBe('GET');
    request.flush({ data: payment });

    expect(result?.receiptNumber).toBe('R-20261121-000001');
  });

  it('queries the journal with every filter', () => {
    let ids: number[] = [];
    service
      .getJournal({ date: '2026-11-21', method: 'CASH', status: 'COMPLETED', page: 0, size: 50 })
      .subscribe((value) => {
        ids = value.items.map((item) => item.id);
      });

    const request = httpMock.expectOne((candidate) => candidate.url === 'v1/payments');
    expect(request.request.params.get('date')).toBe('2026-11-21');
    expect(request.request.params.get('method')).toBe('CASH');
    expect(request.request.params.get('status')).toBe('COMPLETED');
    expect(request.request.params.get('page')).toBe('0');
    expect(request.request.params.get('size')).toBe('50');
    request.flush({ data: { items: [summary], total: 1, page: 0, size: 50, total_pages: 1 } });

    expect(ids).toEqual([1]);
  });

  it('voids with a trimmed reason', () => {
    let result: PaymentResponse | null = null;
    service.voidPayment(1, '  Cobro duplicado  ').subscribe((value) => {
      result = value;
    });

    const request = httpMock.expectOne('v1/payments/1/void');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ reason: 'Cobro duplicado' });
    request.flush({ data: { ...payment, status: 'VOIDED' } });

    expect(result?.status).toBe('VOIDED');
  });

  it('propagates a 409 problem body to the caller', () => {
    let status: number | null = null;
    service.charge({ orderId: 1, tenders: [{ method: 'CASH', amount: '1.00' }] }, 'k').subscribe({
      error: (error: { status: number }) => {
        status = error.status;
      },
    });

    const request = httpMock.expectOne((candidate) => candidate.url === 'v1/payments');
    request.flush(
      { detail: 'Order 1 is already paid', paymentId: 9001 },
      { status: 409, statusText: 'Conflict' },
    );

    expect(status).toBe(409);
  });
});

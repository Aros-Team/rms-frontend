/**
 * Tests for PayrollCache.
 *
 * Feature: `ResourceCache` wrappers around the payroll API, keyed per query
 * (all records / month / worker / worker+month) so switching period never shows
 * another period's numbers.
 * Contract:
 *  - each accessor issues exactly the matching endpoint URL;
 *  - accessors with parameters are memoized per key: the same key returns the
 *    same `ResourceCache` instance (one HTTP request, not one per caller), a
 *    different key returns a different instance hitting its own URL;
 *  - `invalidateAll()` marks every entry stale while keeping the data, and the
 *    next `loadIfStale()` re-fetches.
 *
 * Approach: `HttpTestingController` answers the fetches triggered by `load()`;
 * tests assert the exact URL of every request, the emitted data, instance
 * identity, and the re-fetch after invalidation. `httpMock.verify()` in
 * `afterEach` fails on any unexpected request.
 */
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { PayrollCache } from './payroll-cache';

import { Money } from '@models/dto/common/money';
import { PayrollResponse } from '@models/dto/payroll/payroll-response';
import { PayrollEventResponse } from '@models/dto/payroll/payroll-event-response';
import { PayrollSettlementResponse } from '@models/dto/payroll/payroll-settlement-response';

function moneyDto(amount: string): Money {
  return { amount, currency: 'COP' } as unknown as Money;
}

function payroll(id: number, month: number): PayrollResponse {
  return {
    id,
    userId: 7,
    userName: 'Juan Pérez',
    year: 2026,
    month,
    periodStart: `2026-0${String(month)}-01`,
    periodEnd: `2026-0${String(month)}-28`,
    baseSalary: moneyDto('3000000.00'),
    bonuses: moneyDto('0.00'),
    deductions: moneyDto('0.00'),
    netAmount: moneyDto('3000000.00'),
    paidAmount: moneyDto('0.00'),
    pendingAmount: moneyDto('3000000.00'),
    hoursWorked: 192,
    status: 'PENDING',
    notes: '',
    registeredBy: 1,
    createdAt: '2026-06-01T08:00:00Z',
    updatedAt: '2026-06-01T08:00:00Z',
  };
}

const eventResponse: PayrollEventResponse = {
  id: 31,
  userId: 7,
  userName: 'Juan Pérez',
  eventDate: '2026-06-15',
  eventType: 'OVERTIME',
  quantity: 2,
  unitRate: moneyDto('23437.50'),
  amount: moneyDto('46875.00'),
  notes: '',
  createdAt: '2026-06-15T20:00:00Z',
  createdBy: 1,
};

const settlementResponse: PayrollSettlementResponse = {
  id: 51,
  payrollId: 11,
  userId: 7,
  userName: 'Juan Pérez',
  settlementType: 'DAILY',
  periodStart: '2026-06-01',
  periodEnd: '2026-06-01',
  amount: moneyDto('100000.00'),
  notes: '',
  settledAt: '2026-06-02T10:00:00Z',
  settledBy: 1,
};

describe('PayrollCache', () => {
  let cache: PayrollCache;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    cache = TestBed.inject(PayrollCache);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    TestBed.resetTestingModule();
  });

  it('loads every payroll record from GET v1/payroll', () => {
    cache.payrolls.load();
    httpMock.expectOne('v1/payroll').flush([payroll(11, 6), payroll(12, 6)]);

    expect(cache.payrolls.data()?.map((p) => p.id)).toEqual([11, 12]);
    expect(cache.payrolls.hasData()).toBe(true);
  });

  it('period(year, month) hits GET v1/payroll/{year}/{month} and memoizes the instance', () => {
    const june = cache.period(2026, 6);

    expect(cache.period(2026, 6)).toBe(june);

    june.load();
    httpMock.expectOne('v1/payroll/2026/6').flush([payroll(11, 6)]);

    expect(june.data()).toEqual([payroll(11, 6)]);
  });

  it('period(year, month) returns a distinct cache per month', () => {
    const june = cache.period(2026, 6);
    const july = cache.period(2026, 7);

    expect(july).not.toBe(june);

    june.load();
    july.load();

    httpMock.expectOne('v1/payroll/2026/6').flush([payroll(11, 6)]);
    httpMock.expectOne('v1/payroll/2026/7').flush([payroll(21, 7)]);

    expect(june.data()?.[0].month).toBe(6);
    expect(july.data()?.[0].month).toBe(7);
  });

  it('worker(userId) hits GET v1/payroll/worker/{userId}', () => {
    const workerCache = cache.worker(7);

    expect(cache.worker(7)).toBe(workerCache);

    workerCache.load();
    httpMock.expectOne('v1/payroll/worker/7').flush([payroll(11, 6)]);

    expect(workerCache.data()?.map((p) => p.id)).toEqual([11]);
  });

  it('events(userId, year, month) hits GET v1/payroll/events/{userId}/{year}/{month}', () => {
    const events = cache.events(7, 2026, 6);

    expect(cache.events(7, 2026, 6)).toBe(events);

    events.load();
    httpMock.expectOne('v1/payroll/events/7/2026/6').flush([eventResponse]);

    expect(events.data()).toEqual([eventResponse]);
  });

  it('settlements(userId, year, month) hits GET v1/payroll/settlements/{userId}/{year}/{month}', () => {
    const settlements = cache.settlements(7, 2026, 6);

    expect(cache.settlements(7, 2026, 6)).toBe(settlements);

    settlements.load();
    httpMock.expectOne('v1/payroll/settlements/7/2026/6').flush([settlementResponse]);

    expect(settlements.data()).toEqual([settlementResponse]);
  });

  it('invalidateAll marks every entry stale, keeping the data, and loadIfStale re-fetches', () => {
    cache.payrolls.load();
    httpMock.expectOne('v1/payroll').flush([payroll(11, 6)]);

    const june = cache.period(2026, 6);
    june.load();
    httpMock.expectOne('v1/payroll/2026/6').flush([payroll(11, 6)]);

    cache.invalidateAll();

    // Data survives invalidation — the UI keeps rendering while it revalidates.
    expect(cache.payrolls.data()?.map((p) => p.id)).toEqual([11]);
    expect(cache.payrolls.status()).toBe('stale');
    expect(june.status()).toBe('stale');

    cache.payrolls.loadIfStale();
    june.loadIfStale();

    httpMock.expectOne('v1/payroll').flush([payroll(11, 6), payroll(13, 6)]);
    httpMock.expectOne('v1/payroll/2026/6').flush([payroll(11, 6)]);

    expect(cache.payrolls.data()?.map((p) => p.id)).toEqual([11, 13]);
    expect(cache.payrolls.status()).toBe('fresh');
  });

  it('surfaces HTTP failures in the cache error signal without dropping data', () => {
    cache.payrolls.load();
    httpMock.expectOne('v1/payroll').flush([payroll(11, 6)]);

    cache.payrolls.invalidate();
    cache.payrolls.loadIfStale();

    httpMock
      .expectOne('v1/payroll')
      .flush({ detail: 'boom' }, { status: 500, statusText: 'Server Error' });

    // `ResourceCache` collapses non-`Error` failures into an `Error`, so the
    // status code is not readable here — only that the failure was recorded.
    expect(cache.payrolls.error()).toBeInstanceOf(Error);
    expect(cache.payrolls.status()).toBe('stale');
    expect(cache.payrolls.data()?.map((p) => p.id)).toEqual([11]);
  });
});

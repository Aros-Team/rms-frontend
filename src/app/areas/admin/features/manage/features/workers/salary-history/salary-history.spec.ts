/**
 * Tests for the admin "salary history" screen.
 *
 * Feature: lists every salary change of a worker (old salary → new salary) as
 * returned by `GET /v1/users/{id}/salary-history`.
 * Contract:
 *  - both salaries are `Money` DTOs on the wire
 *    (`{ amount: "1200000.00", currency: "COP" }`) and render the formatted COP
 *    string — never `$ NaN`, never `[object Object]`;
 *  - a `Money` whose `amount` is a number (legacy payload) renders the same;
 *  - a missing previous salary (`oldSalary: null`, the first assignment) renders
 *    an em dash.
 *
 * Approach: mount `SalaryHistory` with a stubbed `Worker` service returning a
 * controlled history and a stub `ActivatedRoute` carrying the worker id, then
 * assert the exact text of the `old-salary` / `new-salary` cells, normalizing
 * the non-breaking space ICU inserts.
 */
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ɵresolveComponentResources as resolveComponentResources } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { Worker } from '@app/core/services/workers/worker';
import { Logging } from '@app/core/services/logging/logging';
import type { SalaryHistoryEntry } from '@app/shared/models/dto/workers/salary-history-entry';
import type { Money } from '@app/shared/models/dto/common/money';
import { SalaryHistory } from './salary-history';
import salaryHistoryHtml from './salary-history.html?raw';

/** Money DTO with a decimal-string amount — exactly what the backend sends. */
function money(amount: string): Money {
  return { amount, currency: 'COP' };
}

function makeEntry(oldSalary: Money | null, newSalary: Money, reason = 'Ajuste anual'): SalaryHistoryEntry {
  return {
    oldSalary,
    newSalary,
    changedAt: '2026-03-01T09:30:00',
    reason,
    observations: null,
  };
}

/** `Intl` separates the COP symbol from the amount with U+00A0. */
function normalize(text: string): string {
  return text.replace(/\u00a0|\u202f/g, ' ').replace(/\s+/g, ' ').trim();
}

describe('SalaryHistory', () => {
  let fixture: ComponentFixture<SalaryHistory>;
  let getSalaryHistory: ReturnType<typeof vi.fn<() => unknown>>;

  beforeAll(async () => {
    await resolveComponentResources((url: string) => {
      if (url.endsWith('salary-history.html')) {
        return Promise.resolve(salaryHistoryHtml as unknown as string);
      }
      return Promise.resolve('');
    });
  });

  beforeEach(() => {
    getSalaryHistory = vi.fn(() => of([]));
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    fixture.destroy();
  });

  function mount(entries: SalaryHistoryEntry[]): void {
    getSalaryHistory.mockReturnValue(of(entries));
    TestBed.configureTestingModule({
      imports: [SalaryHistory],
      providers: [
        { provide: Worker, useValue: { getSalaryHistory } },
        { provide: Logging, useValue: { debug: vi.fn(), error: vi.fn() } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => '42' } } },
        },
      ],
    });
    fixture = TestBed.createComponent(SalaryHistory);
    fixture.detectChanges();
  }

  function cellOf(row: Element, testId: string): string {
    return normalize(row.querySelector<HTMLElement>(`[data-testid="${testId}"]`)?.textContent ?? '');
  }

  function cell(testId: string): string {
    const node = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
      `[data-testid="${testId}"]`,
    );
    return normalize(node?.textContent ?? '');
  }

  it('renders both Money salaries as formatted COP strings', () => {
    mount([makeEntry(money('1150000.00'), money('1200000.00'))]);

    expect(cell('old-salary')).toBe('$ 1.150.000');
    expect(cell('new-salary')).toBe('$ 1.200.000');
  });

  it('renders a decimal Money amount rounded to COP (no minor unit)', () => {
    mount([makeEntry(money('1150000.50'), money('1200000.75'))]);

    expect(cell('old-salary')).toBe('$ 1.150.001');
    expect(cell('new-salary')).toBe('$ 1.200.001');
  });

  it('renders a legacy Money whose amount is a number', () => {
    mount([makeEntry({ amount: 1500000, currency: 'COP' }, { amount: 1650000, currency: 'COP' })]);

    expect(cell('old-salary')).toBe('$ 1.500.000');
    expect(cell('new-salary')).toBe('$ 1.650.000');
  });

  it('renders a missing previous salary as an em dash, not NaN or an object', () => {
    mount([makeEntry(null, money('900000.00'))]);

    expect(cell('old-salary')).toBe('—');
    expect(cell('new-salary')).toBe('$ 900.000');
    expect(cell('old-salary')).not.toMatch(/NaN|object/);
  });

  it('renders both changes of a two-row history independently', () => {
    mount([
      makeEntry(money('1000000.00'), money('1100000.00')),
      makeEntry(money('1100000.00'), money('1250000.00')),
    ]);

    const rows = (fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr');
    expect(rows).toHaveLength(2);
    expect(cellOf(rows[0], 'old-salary')).toBe('$ 1.000.000');
    expect(cellOf(rows[0], 'new-salary')).toBe('$ 1.100.000');
    expect(cellOf(rows[1], 'old-salary')).toBe('$ 1.100.000');
    expect(cellOf(rows[1], 'new-salary')).toBe('$ 1.250.000');
  });

  it('requests the history of the worker in the route', () => {
    mount([]);

    expect(getSalaryHistory).toHaveBeenCalledWith(42);
  });
});

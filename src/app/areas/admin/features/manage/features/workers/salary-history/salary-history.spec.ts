/**
 * Tests for the admin "salary history" screen.
 *
 * Feature: lists every salary change of a worker (old salary → new salary).
 * Contract:
 *  - a salary that arrives as `Money` (`{ amount: "1200000.00", currency: "COP" }`,
 *    the backend wire shape) renders the formatted COP string — never
 *    `$ NaN`;
 *  - a legacy numeric salary renders the same formatted string;
 *  - a missing previous salary (`null`) renders `-`.
 *
 * Approach: mount `SalaryHistory` with a stubbed `Worker` service returning a
 * controlled history and a stub `ActivatedRoute` carrying the worker id, then
 * assert the exact text of the `old-salary` / `new-salary` cells, normalizing
 * the non-breaking space ICU inserts.
 *
 * Note: `SalaryHistoryEntry` still types the salaries as `number`, while the
 * backend serializes `MoneyDto`. The fixtures therefore cast the money payload
 * — that gap is exactly what the `$ NaN` regression was about, and
 * `formatSalary()` is expected to cope at runtime.
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

/** The DTO type is still `number`; the wire sends `MoneyDto`. */
type WireSalary = Money | number | null;

function makeEntry(
  oldSalary: WireSalary,
  newSalary: WireSalary,
  reason = 'Ajuste anual',
): SalaryHistoryEntry {
  const asWire = { oldSalary, newSalary } as unknown as SalaryHistoryEntry;
  return {
    ...asWire,
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

  function cell(testId: string): string {
    const node = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
      `[data-testid="${testId}"]`,
    );
    return normalize(node?.textContent ?? '');
  }

  it('renders Money salaries as formatted COP strings, never NaN', () => {
    mount([
      makeEntry(
        { amount: '1150000.00', currency: 'COP' },
        { amount: '1200000.00', currency: 'COP' },
      ),
    ]);

    expect(cell('old-salary')).toBe('$ 1.150.000');
    expect(cell('new-salary')).toBe('$ 1.200.000');
    expect(cell('new-salary')).not.toMatch(/NaN/);
  });

  it('renders legacy numeric salaries the same way', () => {
    mount([makeEntry(1500000, 1650000)]);

    expect(cell('old-salary')).toBe('$ 1.500.000');
    expect(cell('new-salary')).toBe('$ 1.650.000');
  });

  it('renders a missing previous salary as a dash', () => {
    mount([makeEntry(null, { amount: '900000.00', currency: 'COP' })]);

    expect(cell('old-salary')).toBe('-');
    expect(cell('new-salary')).toBe('$ 900.000');
  });

  it('requests the history of the worker in the route', () => {
    mount([]);

    expect(getSalaryHistory).toHaveBeenCalledWith(42);
  });
});

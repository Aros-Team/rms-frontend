# Test Policy Violations Report

> Re-audited 2026-11-10 against `docs/testing.md` (activity 35).
> Priority: HIGH = would miss bugs, MEDIUM = weak signal, LOW = cosmetic/structural

## Violation Codes

| Code | Meaning | Severity |
|------|---------|----------|
| `NO_HEADER` | Missing file header (feature/contract/approach) | LOW |
| `WEAK_RENDER_ASSERT` | `toContain` as sole rendering assertion | MEDIUM |
| `WEAK_EXIST_ASSERT` | `toBeTruthy`/`toBeDefined`/`not.toBeNull()` as sole assertion | MEDIUM |
| `NO_HTTP_VERIFY` | HTTP tests missing `httpMock.verify()` in afterEach | HIGH |
| `NO_RESETTestingModule` | TestBed-configured suites missing `resetTestingModule` between tests | MEDIUM |
| `NO_ERROR_PATHS` | Missing error/edge case tests for public entry points | HIGH |
| `OVERBROAD_ASSERT` | Asserts too broadly (e.g. entire textContent) | MEDIUM |

## Status: clean

**86 spec files audited. 0 with outstanding violations.**

| Check | Result |
|---|---|
| File header (§1) | 86/86 present |
| `httpMock.verify()` (§7) | every `HttpTestingController` suite verifies (`combo-reference-cache` uses `verify({ignoreCancelled: true})`) |
| `resetTestingModule` (§7) | added to all 15 suites that call `configureTestingModule`; not required in the rest |
| Weak asserts | no lone `toBeTruthy`/`toBeDefined`/`toContain` render asserts remain |
| Error paths (§5) | `option-selection-type-mapper` closed (was the only HIGH item) |

## Deliberately not flagged

- `payroll-panel.spec.ts:611` — `expect(first).toBeDefined()` is a setup guard inside a focus-trap
  test whose real assertions follow (`dialog.contains(document.activeElement)`).
- Seven pure-function/helper suites (`money.spec`, `pagination.spec`, `date-format.spec`,
  `option-selection-type-helper/mapper`, `order-detail-dialog.spec`, `analytics-period-state.spec`)
  never call `configureTestingModule`, so `resetTestingModule` would be noise.

## Why this round mattered

Three bugs shipped green during the same session, all because the old specs asserted
invariants that could not fail:

1. Order lists silently truncated to page 1 (`size: 500` removal) — specs asserted array
   identity, not completeness.
2. `NaN` money totals — specs used bare-number fixtures while the wire had become
   `MoneyDto {amount: string, currency: string}`.
3. An `Instant` rendered as `15T18:00:00/06/2026` — the test asserted row counts, never the
   rendered date.

The rule that follows: **assert the exact rendered value or exact aggregate**, and build
fixtures from the real wire shape.

## Blocked (needs app-code changes, not test changes)

- `p-inputNumber` value and `SelectButton` `aria-labelledby` are unobservable in jsdom.
- Missing `data-testid` hooks on the banner, empty-state and recipe-row markup block exact
  selector assertions. Add those hooks when those templates are next touched.

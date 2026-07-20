# AN-01-01 Decision Register — Analytics Section

> Author: orchestrator session 2026-07-17. Companion contract: `docs/analytics.md` + `docs/contracts/analytics.yaml` (formally `docs/analytics.yaml`). Implementation rules: `docs/conventions.md`, `docs/architecture.md`, `docs/DESIGN.md`.

## 1. Scope

Five admin-only analytical modules under `/admin/analytics/*`:

| Path | Module | Page (component selector) |
|------|--------|---------------------------|
| `/admin/analytics/prime-cost`        | Prime Cost & Margins        | `<app-analytics-prime-cost>` |
| `/admin/analytics/menu-engineering`  | Menu Engineering (BCG)      | `<app-analytics-menu-engineering>` |
| `/admin/analytics/operations`        | Operational Efficiency      | `<app-analytics-operations>` |
| `/admin/analytics/cohort`            | Customer Cohort             | `<app-analytics-cohort>` |
| `/admin/analytics/alerts`            | Variance Alerts             | `<app-analytics-alerts>` |

The existing `<app-analytics>` becomes the shell (parent with `<router-outlet>` and nav). The legacy top-selling chart is dropped from `/admin/analytics` and the new shell redirects to `prime-cost` so the user lands on actual analytics, not the stub.

## 2. Architecture

```
src/app/
├── core/services/analytics/
│   ├── analytics.ts                   ← HTTP service (existing file, widened)
│   ├── analytics-cache.ts             ← AnalyticsCacheService with 5 ResourceCache instances
│   ├── analytics-period-state.ts      ← shared signal store for { bucket, from, to }
│   └── analytics-utils.ts             ← period-key formatter + validation helpers
├── shared/
│   ├── models/dto/analytics/
│   │   ├── money.ts                   ← Money value object
│   │   ├── metric-value.ts            ← MetricValue (decimal string)
│   │   ├── time-bucket.ts             ← 'daily' | 'weekly' | 'monthly' | 'yearly'
│   │   ├── data-completeness.ts       ← 'FULL' | 'PARTIAL' | 'EMPTY'
│   │   ├── period.ts                  ← Period meta { bucket, from, to, keys[] }
│   │   ├── prime-cost-report.ts       ← PrimeCostReport + PrimeCostPeriod
│   │   ├── menu-engineering-report.ts ← MenuEngineeringReport + MenuEngineeringItem + cache status
│   │   ├── operations-report.ts       ← OperationsReport
│   │   ├── cohort-report.ts           ← CohortReport
│   │   ├── alert.ts                   ← Alert, AlertsPage, AlertSeverity/Status/Type
│   │   ├── problem-detail.ts          ← RFC 7807 ProblemDetail
│   │   └── index.ts                   ← re-exports
│   └── pipes/
│       ├── money.ts                   ← MoneyPipe (COP, no decimals, es-CO locale)
│       └── metric-value.ts            ← MetricValuePipe (generic decimal formatting)
└── areas/admin/features/analytics/
    ├── analytics.ts + analytics.html + analytics.css   ← shell with <router-outlet> + nav + period selector
    ├── analytics-routes.ts                            ← child route table (consumed by app.routes.ts)
    ├── components/
    │   ├── analytics-nav/                             ← horizontal tab nav
    │   ├── period-selector/                           ← bucket + from/to inputs bound to period state
    │   └── data-completeness-banner/                  ← shared banner that renders notes[] when not FULL
    ├── features/
    │   ├── prime-cost/                                ← PrimeCost module page
    │   ├── menu-engineering/                          ← MenuEngineering module page
    │   ├── operations/                                ← Operations module page
    │   ├── cohort/                                    ← Cohort module page
    │   └── alerts/                                    ← Alerts module page
    └── skeletons/                                     ← feature-specific skeletons (each module)
```

## 3. Money / Money-related formatting

| Concern | Decision |
|---------|----------|
| Wire format                  | Decimal string + ISO-4217 currency (e.g. `"125000000.00"` + `"COP"`). Never raw float. Matches `analytics.yaml` `Money`. |
| Display format (COP)         | `Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })`. The schema says `.amount` keeps 2 decimals but display omits them for COP (no centavos). |
| Display format (other)       | Default: `Intl.NumberFormat(locale, { style: 'currency', currency })`. Most analytics responses are COP. |
| Negative values              | Prefix `"-"` outside the symbol, never parentheses (Spanish locale uses no currency-side neg). |
| MetricValue (alert ratios)   | Display with 2 decimals and `%` suffix only for `FOOD_COST_DEVIATION`/`LABOR_COST_DEVIATION`/`deviationPct`. Other metric values use the raw decimal text. Implemented via `MetricValuePipe` + caller-supplied suffix label, not inferred from type. |
| `null`                       | Render as `'—'` (em dash). |
| Pipe name                    | `money` for `Money`. `metricValue` for `MetricValue`. |
| Pipe location                | `src/app/shared/pipes/{money,metric-value}.ts`. |

## 4. Period key formatting & validation

| Bucket   | Key shape        | Example      | Validators |
|----------|------------------|--------------|------------|
| `daily`  | `YYYY-MM-DD`     | `2026-07-17` | ISO date, valid calendar day |
| `weekly` | `YYYY-Www`       | `2026-W29`   | ISO week, 1..53 |
| `monthly`| `YYYY-MM`        | `2026-07`    | month 1..12 |
| `yearly` | `YYYY`           | `2026`       | year 1900..2999 |

Rules enforced client-side before query (server re-validates per `analytics.md` §3):

- `to >= from` — otherwise surface inline validation, do **not** submit.
- Range cap: 366 days **only** when bucket == `daily` (derive via `formatPeriodKey` conversion). For other buckets, allow up to 366 days between the temporal extent (e.g. 100 monthly buckets), still respecting server's 422 range-too-large. We do not duplicate the server cap; we let the server speak.
- Default on first mount: bucket=`monthly`, from = 5 months ago, to = current month (e.g. today is `2026-07`, range `2026-02..2026-07`). This matches the contract examples.

`formatPeriodKey(date, bucket)` lives in `analytics-utils.ts` and is the inverse of date parsing.

## 5. Cache TTL strategy

Each module gets its own `ResourceCache<T>` keyed by the current period `{bucket,from,to}`. Since `ResourceCache` keys by identity not by params, the cache service exposes a method that builds the fetch fn from the current period state and calls `cache.invalidate()` whenever the period changes (effect on the period state in the cache service).

| Module            | TTL (ms) | staleWhileRevalidate | Rationale                                |
|-------------------|---------:|----------------------|------------------------------------------|
| `primeCost`       | 600_000  | true                 | Read-mostly rollup, slow-changing.       |
| `menuEngineering` | 1_800_000| true                 | Cache table on backend; revalidate on price/recipe change later. |
| `operations`      | 300_000  | true                 | Updated each shift; faster rollback.     |
| `cohort`          | 600_000  | true                 | Heavier query; range not too volatile.   |
| `alerts`          | 120_000  | true                 | User needs to see new alerts without spamming; markRead invalidates via mutate API. |

Mark-read uses `patchData` on the alerts cache to flip status locally (optimistic) and lets HTTP confirm.

## 6. RFC 7807 error mapping

The existing `errorInterceptor` (in `src/app/core/interceptors/error.ts`) already shapes errors; we add per-endpoint toast mapping at the call site only when the canonical handler did not already surface a message. Module pattern:

```ts
this.cache.primeCost.load()
this.cache.primeCost.error();   // signal<Error | undefined>
```

The component watches `error()`, shows a PrimeNG `<p-message>` with severity `error`. `dataCompleteness` does **not** trigger an error component; it triggers `<app-data-completeness-banner [notes]="...">`.

## 7. Shared period state

`AnalyticsPeriodState` (root service) holds:

```ts
bucket = signal<TimeBucket>('monthly');
from   = signal<string>('2026-02');   // default = 5 months ago
to     = signal<string>('2026-07');   // default = current month
```

`setPeriod(p: PeriodSelection)` validates before applying. `PeriodSelectorComponent` writes here; every `ResourceCache` in `AnalyticsCacheService` reads these signals and **invalidates** when they change (via effect). Browsing modules keeps the same period; switching bucket re-fetches.

## 8. Charts library choice

PrimeNG `p-chart` (already used by `top-selling-chart` and bundled with `chart.js`). Rationale: consistent look with theme, lighter ops cost than adding `ng2-charts`/`ngx-chartjs`. Types: line (Prime Cost trend), doughnut (COGS by category, labor by area, cohort split), bubble/scatter (BCG matrix) using `type="bubble"`.

## 9. dataCompleteness banner

`<app-data-completeness-banner [completeness]="..." [notes]="..." />` — appears above the module's main content. When `FULL`, renders nothing. When `PARTIAL`/`EMPTY`, renders a PrimeNG `<p-message>` with severity `warn`/`error` containing:
- A translated headline ("Datos parciales" / "Sin datos").
- The `notes[]` list as bullet points.
- A button to retry (calls the relevant cache `refresh()`).

## 10. Navigation

Horizontal tabs (mirroring `manage.ts`):

```
[ Costo primo ] [ Carta ] [ Operaciones ] [ Cohorte ] [ Alertas ]
```

Active tab via `routerLinkActive`. Bottom thin underline indicator. Touch-target ≥ 40px.

The shell maintains the section title "Estadísticas" in the page header and the period selector on the right.

## 11. Accessibility expectations

| Surface | Targets |
|---------|---------|
| Period selector       | Inputs labelled, ARIA `combobox` for bucket, inline validation announced. |
| Tab nav               | Each tab is `<a role="tab">`, active `aria-current="page"`, ←/→ arrow keys move focus. |
| Charts                | Wrap in a `figure` with hidden `<figcaption>` summarising the chart (PrimeNG reads `ariaLabel`). |
| Skeletons             | Use `p-skeleton` (PrimeNG component) with `role="status"` and `aria-live="polite"` wrapper. |
| Tables                | `<p-table>` with `<caption>` + sort buttons ARIA-labelled. |
| Alerts list           | Each row has a `role="button"` mark-read action with label "Marcar como leído". Toast for action confirmation. |

## 12. Empty / error / loading states

Every page renders:
1. Skeleton (header + body placeholder) while loading.
2. Banner if `dataCompleteness` ≠ `FULL` + notes list.
3. Empty state with icon + button to retry if server returned 0 series / 0 items.
4. Error message + retry button if `error()` is set.
5. Real content otherwise.

## 13. Open questions / future work

None blocking foundation. Follow-up activities can discuss:
- WebSocket alerts refresh (`/topic/analytics/alerts`) — out of scope now.
- Per-user period persistence (localStorage) — nice-to-have, not blocking.

## 14. Decisions on items not in the contract but required for FE

- The five module pages must exist for the nav to land somewhere even when the module is "stub"; the foundation activity creates placeholders that the per-module activities overwrite.
- `getTopSellingProducts` from the legacy analytics service **stays** (the old Top-Selling chart is dropped from this view; the API call survives for any other consumer found during implementation).

## 15. Sign-off

OK to proceed to AN-01-02 (DTOs) → AN-01-03 (HTTP service) → AN-01-04 (Cache service) → AN-01-05 (Pipes & utils) → AN-01-06 (Foundation tests) → AN-01-07 (Reviewer audits foundation).

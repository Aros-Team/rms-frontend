# Known accessibility failures (Sprint 0 baseline)

Owner task: **P1-QA-07** — close the Sprint 0 axe failures on existing routes.
Gate: zero `serious` or `critical` violations in the baseline suite.

This file is the explicit allowlist-free inventory of what is still red. The a11y
specs keep failing on these; nothing is silenced in the test code. `/dev/ui` is
exempt from the axe gate by request and is not counted here.

Last verified: 2026-11-21 (full run after the Shell and Design System lanes merged).
Result: **32 failing routes, 68 rule-route pairs, 10 rule types**.
Axe artifacts: `docs/sprint-0/artifacts/playwright/a11y/<role>/<route>.json`.

## Violation id → routes

### `button-name` (critical, 26 routes)

`/admin`, `/admin/orders`, `/admin/manage`, `/admin/manage/products`,
`/admin/manage/products/1/recipe`, `/admin/manage/categories`,
`/admin/manage/tables`, `/admin/manage/areas`, `/admin/manage/combos`,
`/admin/manage/combos/new`, `/admin/manage/combos/1/edit`,
`/admin/manage/combos/1/history`, `/admin/manage/orders-create`,
`/admin/manage/workers`, `/admin/manage/workers/1001/salary-history`,
`/admin/manage/inventory`, `/admin/analytics`, `/admin/analytics/prime-cost`,
`/admin/analytics/menu-engineering`, `/admin/analytics/operations`,
`/admin/analytics/cohort`, `/admin/analytics/alerts`, `/admin/create-product`,
`/admin/profile`, `/worker/profile`, `/worker/waiter?tab=pedidos`.

### `label-content-name-mismatch` (serious, 13 routes)

`/admin/analytics`, `/admin/analytics/prime-cost`,
`/admin/analytics/menu-engineering`, `/admin/analytics/operations`,
`/admin/analytics/cohort`, `/admin/analytics/alerts`, `/worker`,
`/worker/waiter`, `/worker/waiter?tab=carta`, `/worker/waiter?tab=pedidos`,
`/worker/combos/1`, `/worker/my-schedule`, `/worker/profile`.

### `nested-interactive` (serious, 7 routes)

`/worker`, `/worker/waiter`, `/worker/waiter?tab=carta`,
`/worker/waiter?tab=pedidos`, `/worker/combos/1`, `/worker/my-schedule`,
`/worker/profile`.

### `role-img-alt` (serious, 6 routes)

`/admin/analytics`, `/admin/analytics/prime-cost`,
`/admin/analytics/menu-engineering`, `/admin/analytics/operations`,
`/admin/analytics/cohort`, `/admin/analytics/alerts`.

### `color-contrast` (serious, 5 routes)

`/admin/manage/areas`, `/admin/manage/inventory`, `/setup-account`,
`/worker/combos/1`, `/worker/waiter?tab=carta`.

### `scrollable-region-focusable` (serious, 5 routes)

`/admin/analytics`, `/admin/analytics/prime-cost`,
`/admin/analytics/operations`, `/admin/analytics/alerts`,
`/admin/manage/inventory`.

### `aria-prohibited-attr` (serious, 2 routes)

`/admin/manage/combos/new`, `/admin/manage/combos/1/edit`.

### `label` (critical, 2 routes)

`/admin/manage/products/1/recipe`, `/worker/waiter?tab=pedidos`.

### `aria-hidden-focus` (serious, 1 route)

`/admin/manage/categories`.

### `select-name` (critical, 1 route)

`/admin/create-product`.

## Commands

```bash
cd /home/jorge/Projects/aros/worktrees/fe-playwright

# The gate: expected red until P1-QA-07 is closed
npx playwright test --grep "a11y /"

# Green mode for local work on unrelated features (not configured in CI)
npx playwright test --grep-invert "a11y /"
```

The inventory is regenerated from `a11y/<role>/*.json` on every run. When a rule
is fixed, update this file in the same change so the document and the red test
list stay aligned.

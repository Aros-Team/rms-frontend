# Known accessibility failures (Sprint 0 baseline)

Owner task: **P1-QA-07** — close the Sprint 0 axe failures on existing routes.
Gate: zero `serious` or `critical` violations in the baseline suite.

This file is the explicit allowlist-free inventory of what is still red. The a11y
specs keep failing on these; nothing is silenced in the test code. `/dev/ui` is
exempt from the axe gate by request and is not counted here.

Last verified: 2026-11-22 (refactor wave merged: settings, schedules, live
analytics, recipe editor, kitchen TV, cashier board).
Result: **40 unique failing role-routes, 81 rule-route pairs, 9 rule types**. The
suite reports **43 failing tests** because the three kitchen routes run in both
`kitchen-tv` (1920x1080) and `kitchen-tablet` (1024x768).
Axe artifacts: `docs/sprint-0/artifacts/playwright/a11y/<role>/<route>--<project>.json`.

## Violation id → routes

### `button-name` (critical, 29 role-routes)

Admin: `/admin`, `/admin/orders`, `/admin/schedules`,
`/admin/schedules?tab=plantillas`, `/admin/schedules?tab=registros`,
`/admin/manage`, `/admin/manage/products`, `/admin/manage/products/1/recipe`,
`/admin/manage/categories`, `/admin/manage/tables`, `/admin/manage/areas`,
`/admin/manage/combos`, `/admin/manage/combos/new`,
`/admin/manage/combos/1/edit`, `/admin/manage/combos/1/history`,
`/admin/manage/orders-create`, `/admin/manage/workers`,
`/admin/manage/workers/1001/salary-history`, `/admin/manage/inventory`,
`/admin/analytics`, `/admin/analytics/prime-cost`,
`/admin/analytics/menu-engineering`, `/admin/analytics/operations`,
`/admin/analytics/cohort`, `/admin/analytics/alerts`, `/admin/settings`,
`/admin/create-product`, `/admin/profile`.
Waiter: `/worker/profile`.

### `color-contrast` (serious, 24 role-routes)

Admin: `/admin/analytics`, `/admin/analytics/prime-cost`,
`/admin/analytics/menu-engineering`, `/admin/analytics/operations`,
`/admin/analytics/cohort`, `/admin/analytics/alerts`, `/admin/manage/areas`,
`/admin/manage/inventory`, `/admin/schedules`, `/admin/settings`.
Waiter: `/worker`, `/worker/waiter`, `/worker/waiter?tab=carta`,
`/worker/waiter?tab=pedidos`, `/worker/combos/1`, `/worker/my-schedule`.
Kitchen: `/worker`, `/worker/kitchen`, `/worker/my-schedule` (both kitchen
projects).
Cashier: `/worker/my-schedule`.
Public: `/setup-account`.

### `label-content-name-mismatch` (serious, 14 role-routes)

Admin: `/admin/analytics`, `/admin/analytics/prime-cost`,
`/admin/analytics/menu-engineering`, `/admin/analytics/operations`,
`/admin/analytics/cohort`, `/admin/analytics/alerts`, `/admin/schedules`.
Waiter: `/worker`, `/worker/waiter`, `/worker/waiter?tab=carta`,
`/worker/waiter?tab=pedidos`, `/worker/combos/1`, `/worker/my-schedule`,
`/worker/profile`.

### `role-img-alt` (serious, 5 role-routes)

`/admin/analytics`, `/admin/analytics/prime-cost`,
`/admin/analytics/menu-engineering`, `/admin/analytics/operations`,
`/admin/analytics/cohort`.

### `scrollable-region-focusable` (serious, 4 role-routes)

`/admin/analytics`, `/admin/analytics/prime-cost`,
`/admin/analytics/menu-engineering`, `/admin/manage/inventory`.

### `aria-prohibited-attr` (serious, 2 role-routes)

`/admin/manage/combos/new`, `/admin/manage/combos/1/edit`.

### `aria-hidden-focus` (serious, 1 role-route)

`/admin/manage/categories`.

### `label` (critical, 1 role-route)

`/admin/manage/combos`.

### `select-name` (critical, 1 role-route)

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

# Known accessibility failures (Sprint 0 baseline)

Owner task: **P1-QA-07** — close the Sprint 0 axe failures on existing routes.
Gate: zero `serious` or `critical` violations in the baseline suite.

## Status: gate met (2026-11-22, `feat/a11y-fixes`)

The last full run reports **63 passed, 0 failed** and **zero violations of any
impact** across the 63 role-route executions (40 unique role-routes; the kitchen
routes run in both `kitchen-tv` and `kitchen-tablet`). `/dev/ui` remains exempt
from the axe gate by request.

What used to be red and is now fixed (details in
`docs/reports/a11y-lane.md`):

| Rule | Was | Now |
|---|---|---|
| `button-name` | 29 role-routes | fixed — icon-only controls have names |
| `color-contrast` | 24 role-routes | fixed — semantic tokens (muted text darkened to 4.9:1 on subtle/sunken) |
| `label-content-name-mismatch` | 14 role-routes | fixed — accessible names derive from visible content |
| `role-img-alt` | 5 role-routes | fixed — charts expose a summary |
| `scrollable-region-focusable` | 4 role-routes | fixed — scroll panels and the inventory table are focusable |
| `aria-prohibited-attr` | 2 role-routes | fixed — step markers carry `role="img"` |
| `aria-hidden-focus` | 1 role-route | fixed — category toggle is no longer hidden from AT |
| `label` | 1 role-route | fixed — read-only combo switches have names |
| `select-name` | 1 role-route | fixed — create-product selects are labelled |

Axe artifacts: `docs/sprint-0/artifacts/playwright/a11y/<role>/<route>--<project>.json`.

## Commands

```bash
cd /home/jorge/Projects/aros/worktrees/fe-playwright

# The gate
npx playwright test --grep "a11y /"

# Green mode for local work on unrelated features (not configured in CI)
npx playwright test --grep-invert "a11y /"
```

The inventory is regenerated from `a11y/<role>/*.json` on every run. Keep this
file aligned with the red test list when a rule regresses.

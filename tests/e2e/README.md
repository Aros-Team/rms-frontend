# Playwright baseline (Sprint 0, Lane F)

Evidence suite for the full refactor. It crawls every route in `app.routes.ts`,
captures console/page/network failures, runs axe (WCAG A+AA), and stores light
theme screenshots for the role viewports. Kitchen runs twice: `kitchen-tv`
(1920x1080, primary) and `kitchen-tablet` (1024x768, fallback).

## Run

The dev servers must already be running (the config never starts one):

```bash
# API on :8080, Angular dev server on :4200
npx playwright test                 # full baseline (~3.5 min, 4 workers)
npx playwright test --project=admin-desktop
npx playwright test --grep "smoke /"     # crawl only
npx playwright test --grep "a11y /"      # axe only (gate: zero violations)
npx playwright test --grep "visual /"    # snapshots only
npx playwright test --grep-invert "a11y /"  # green mode for local work (not CI)
npx playwright test --list               # route inventory, no browser
```

Artifacts default to
`/home/jorge/Projects/aros/rms/docs/sprint-0/artifacts/playwright/`
(`PW_ARTIFACTS` overrides): `html-report/`, `results/` (traces on failure),
`a11y/<role>/`, `results.json`, `run.log`. Visual baselines live in the worktree
under `tests/e2e/visual/__screenshots__/<project>/` (64 snapshots) so they can be
reviewed and committed with the lane.

## Deterministic visuals (P1-QA-09)

`support/visual-determinism.ts` freezes the browser clock to the seed anchor
(2026-11-21 20:00 Bogota) so dashboard/analytics "today" ranges do not move, and
masks every visible leaf containing a digit (dates, clock, totals, ids, KPI
numbers, relative times), all chart canvases, form values and worker toasts.
Static labels, cards and table structure stay visible. The client-side token-expiry cookie is
extended beyond the frozen instant in `global-setup.ts`; the API still validates
the real JWT expiry.

The accessibility gate is met: `KNOWN_A11Y.md` records zero serious/critical
violations across 63 role-route executions (P1-QA-07 closed). A regression must
be reported by rule and route, never silenced or allowlisted. The `/dev/ui`
gallery is visually baselined but excluded from the axe gate (`a11yExempt`).

## Auth shortcut

`tests/e2e/global-setup.ts` writes `tests/e2e/.auth/<role>.json` from the
orchestrator token files in `/tmp/opencode` on every run. Tokens are read at run
time and the run aborts with a clear message if one has expired. This is a
Sprint 0 shortcut only: real credential login belongs in Phase 1 and should
replace the global setup, not the specs. `.auth/` is git-ignored because it
contains access tokens.

## Conventions

- Routes live in `tests/e2e/support/routes.ts` with the expected final URL
  (redirects included) and the area shell selector.
- `Permissions policy violation: unload is not allowed in this document.` is
  known Chromium/dev-server noise and is filtered in `support/collect.ts`.
- Only `serious`/`critical` axe violations fail a test; the full report is in
  the JSON artifact.
- Visual snapshots are light only; dark is a Phase 1 follow-up. Worker toasts
  are masked because they depend on polling and seed state.
- `tests/e2e/**` and `playwright.config.ts` are outside `ng lint`'s
  `src/**` scope and are transpiled by Playwright.

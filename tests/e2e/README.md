# Playwright baseline (Sprint 0, Lane F)

Evidence suite for the full refactor. It crawls every route in `app.routes.ts`,
captures console/page/network failures, runs axe (WCAG A+AA), and stores light
theme screenshots for four role viewports.

## Run

The dev servers must already be running (the config never starts one):

```bash
# API on :8080, Angular dev server on :4200
npx playwright test                 # full baseline (~3.5 min, 4 workers)
npx playwright test --project=admin-desktop
npx playwright test --grep "smoke /"     # crawl only
npx playwright test --grep "a11y /"      # axe only (expected red, see KNOWN_A11Y.md)
npx playwright test --grep "visual /"    # snapshots only
npx playwright test --grep-invert "a11y /"  # green mode for local work (not CI)
npx playwright test --list               # route inventory, no browser
```

Artifacts default to
`/home/jorge/Projects/aros/rms/docs/sprint-0/artifacts/playwright/`
(`PW_ARTIFACTS` overrides): `html-report/`, `results/` (traces on failure),
`a11y/<role>/`, `results.json`, `run.log`. Visual baselines live in the worktree
under `tests/e2e/visual/__screenshots__/<project>/` (54 snapshots) so they can be
reviewed and committed with the lane.

Accessibility failures are tracked in `KNOWN_A11Y.md` and mapped to P1-QA-07.
They must keep failing until that task closes; the suite is not allowed to
silence or allowlist them. The `/dev/ui` gallery is visually baselined but
excluded from the axe gate (`a11yExempt`).

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

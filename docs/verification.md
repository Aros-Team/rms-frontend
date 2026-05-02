# Verification

> How to verify that work is correct.

---

## 1. Before declaring a task `done`

1. Run `node scripts/harness.js` — all blocks must pass
2. Verify lint: `npm run lint:check` — no errors
3. Verify build: `npm run build` — compiles without errors
4. Verify tests: `npm test -- --watch=false` — all tests green
5. Review `docs/CHECKPOINTS.md` — all applicable checkboxes marked

---

## 2. Manual Verification Steps

### Code Quality
- No `console.log()` or debug prints left behind
- No TODOs without context
- No inline styles (except token-based dynamic values)
- All user-facing text in Spanish
- All class/variable names in English

### Architecture Compliance
- Components use `templateUrl` + `styleUrl` (no inline)
- Files follow naming conventions (kebab-case, no suffix)
- Services are one-file-per-domain
- Shared components in `shared/`
- Feature components in `features/`

### Style Compliance
- Only design tokens used (no hardcoded colors/sizes)
- PrimeNG components preferred
- No custom CSS outside design system

### Tests
- New functionality has tests
- Tests are in `tests/` folder
- Tests pass independently

---

## 3. Reviewer Checklist

The reviewer agent must verify:

- [ ] Lint passes (`npm run lint:check`)
- [ ] Build succeeds (`npm run build`)
- [ ] All tests pass (`npm test`)
- [ ] Component files separated (`.ts`, `.html`, `.css`)
- [ ] No inline templates or styles
- [ ] No hardcoded custom CSS
- [ ] User-facing text in Spanish
- [ ] Code follows naming conventions
- [ ] No leftover debug code

---

## 4. Git Hygiene

Before closing a session:

- [ ] No temp files (`.tmp`, `__pycache__`)
- [ ] `progress/current.md` emptied to template
- [ ] Summary moved to `progress/history.md`
- [ ] `feature_list.json` status updated

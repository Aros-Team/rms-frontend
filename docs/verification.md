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
- **Todo archivo `.ts` está dentro de una carpeta** (no hay archivos sueltos)
- Services grouped by entity folder, named by use case (`products/get-all.ts`)
- Each service file does ONE thing
- Shared components in `shared/`
- Feature components in `features/`

### Style Compliance
- Only design tokens used (no hardcoded colors/sizes)
- PrimeNG components preferred
- No custom CSS outside design system

### Reutilización
- Se verificó que no exista un componente similar en `shared/` antes de crear uno nuevo
- Si el componente es reusable, se creó en `shared/`, no dentro de una feature
- No hay duplicación de lógica o UI que pueda unificarse

### Data Loading
- Toda consulta a lista incluye `size` (paginated query obligatorio)
- Se usó `ResourceCache` para cachear datos (no llamadas HTTP directas sin cache)
- TTL configurado según el tipo de dato (crítico: 1-2 min, referencia: 30 min)
- Se invalidó el cache después de mutaciones (create/update/delete)
- Componentes con datos debajo del fold usan `[appLazyLoad]`
- Skeletons presentes en todos los estados de carga

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
- [ ] No duplicate components — checked `shared/` before creating new ones
- [ ] Paginated queries — every list endpoint includes `size` parameter
- [ ] Cache used via `ResourceCache` — no raw HTTP calls without caching for list data
- [ ] Cache invalidated after mutations
- [ ] `[appLazyLoad]` used for data below the fold
- [ ] Skeletons present for all loading states
- [ ] Every `.ts` file is inside a folder (no loose files)
- [ ] Service files grouped by entity folder, named by use case (`entidad/verbo-accion.ts`)

---

## 4. Git Hygiene

Before closing a session:

- [ ] No temp files (`.tmp`, `__pycache__`)
- [ ] `progress/current.md` emptied to template
- [ ] Summary moved to `progress/history.md`
- [ ] `feature_list.json` status updated

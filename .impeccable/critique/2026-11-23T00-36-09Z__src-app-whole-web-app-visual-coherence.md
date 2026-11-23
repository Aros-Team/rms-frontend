---
target: src/app (whole web app visual coherence)
total_score: 27
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:/home/jorge/Projects/aros/rms/frontend/src/app (whole web app visual coherence)"
timestamp: 2026-11-23T00-36-09Z
slug: src-app-whole-web-app-visual-coherence
---
# Visual coherence review — RMS web app

Target: `src/app` (auth + admin + worker + cashier), Angular 21 + PrimeNG 21 + Tailwind 4.
Method: single-context pass over the committed Playwright visual baselines, the token files and the feature templates; detector run via `impeccable detect`.

## Design Health Score

| # | Heuristic | Score | Key issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Skeletons, status pills and server-state banners are present; the floating order dock and the docked period bar can cover the last content row |
| 2 | Match System / Real World | 3 | Domain Spanish is right; the masthead still says "Restaurante de prueba" (an environment placeholder that ships to production) |
| 3 | User Control and Freedom | 3 | Dialogs cancel/Esc; the unsaved order-status batch still has no route guard |
| 4 | Consistency and Standards | 3 | Status colours were tokenized in this pass; four masthead compositions by role and two nav models remain |
| 5 | Error Prevention | 2 | Validation and disabled submit exist; destructive status changes still lack confirmation |
| 6 | Recognition Rather Than Recall | 3 | Icons are paired with labels; contextual header sentence plus page H1 plus subtitle is a lot of repeated orientation |
| 7 | Flexibility and Efficiency | 2 | No keyboard accelerators, no bulk order actions |
| 8 | Aesthetic and Minimalist Design | 3 | The permanent gold identity pill and the thick side-tab accents are gone; empty half-screens remain |
| 9 | Error Recovery | 2 | Error surfaces now share the token system, but copy is still generic ("Error de conexión") |
| 10 | Help and Documentation | 1 | No contextual help for prime-cost, pmix or menu-engineering |
| **Total** | | **27/40** | **Acceptable — coherent system, integration seams remain** |

## Design Specificity Verdict

**LLM assessment**: The visual world is authored, not category chrome. Archivo, one gold accent used as a fill, border-only elevation, a slate ramp shared by light/dark/high-contrast, and a real primitive gallery (`dev-ui`) make every screen feel like the same restaurant tool. "Carta", "Mesas", "En cola", "Cobrar", the kitchen three-column queue and the waiter bottom tabs are business-derived. The incoherence is at the seams: the masthead re-invents itself per role, status colour was re-built from the Tailwind palette in three shared components, and two areas borrow a mobile shell at desktop width.

**Deterministic scan** (`impeccable detect --json src/app`): 10 findings — 8 `broken-image` (all false positives: Angular `[src]` bindings the detector cannot read) and 2 `side-tab` in `tree-node-card.spec.ts` (now removed from the component; the spec was updated). No contrast or spacing findings.

## Overall Impression

Bones are strong: a documented three-layer token system, one focus ring, one type ramp, real skeletons. The biggest remaining opportunity is not more surface polish but one coherent shell: the same masthead logic in every area and one navigation model per breakpoint.

## What's Working

1. **One accent, one job.** After demoting the identity pill, gold means "primary action" or "current selection" everywhere. That is why `Nuevo producto`, `Armar combo` and `Marcar lista` read instantly.
2. **Border-only elevation.** No shadows, no gradients; depth is a 1px border plus a surface step. It reads calm and stays legible in dark mode.
3. **Primitives carry the states.** `rms-status-pill`, `rms-empty-state`, `rms-skeleton`, `rms-stat-tile` are used consistently by the newer lanes, and the gallery proves the system.

## Priority Issues

### [P1] Desktop areas reuse the mobile bottom tab bar
- **What**: `worker-layout` renders a fixed, full-width bottom nav for the cashier area at 1440px, with two items spread across ~48rem. The admin area uses a right rail instead.
- **Why it matters**: A desktop cashier reads the bar as a phone control; the primary workspace navigation sits far from the work.
- **Fix**: At `lg`, render worker navigation as a segmented control in the page header or as a left rail; keep the bottom bar under `lg`.
- **Suggested command**: `/impeccable adapt`

### [P1] Docked period selector clips the analytics scroll area
- **What**: `.analytics-shell__content` is a scroll viewport above `.period-dock`; the last chart legend/link is cut mid-row at the viewport edge, and the chart skeleton visually escapes the frame in the baseline.
- **Why it matters**: The user cannot tell whether there is more chart or whether the page ended.
- **Fix**: Add `scroll-padding-block-end` and a matching `padding-block-end` to the content, and verify the frame clips its children.
- **Suggested command**: `/impeccable layout`

### [P2] Two headlines per page
- **What**: The masthead prints a contextual sentence, then the page prints an H1 and a subtitle. Settings was a literal duplicate ("Negocio, dinero, personas y sistema" / "Administra el negocio, el dinero, las personas y el sistema"); it is now "Preferencias del restaurante", but the pattern remains on orders, analytics and manage.
- **Why it matters**: Two headlines slow the first read and weaken the real H1.
- **Fix**: Give the masthead a short place label only, and let the page own the sentence.
- **Suggested command**: `/impeccable distill`

### [P2] Table action idioms diverge
- **What**: Orders uses an eye icon plus a status pill *and* a status select showing the same value; products uses a document icon plus a red no-entry icon. Sortable header cells also paint a gold fill that no other table uses.
- **Why it matters**: The same "act on a row" gesture looks different between two adjacent manage screens.
- **Fix**: One row-action pattern (icon button cluster with tooltips) and one status display.
- **Suggested command**: `/impeccable polish`

### [P3] Auth validation and legacy dialogs still bypass tokens
- **What**: Login, forgot-password, form-validation, settings and the chat error bubble used raw `red-*`/`green-*` classes; the logout dialog used `yellow-500`.
- **Why it matters**: The same "error" was a different red in every screen, and dark mode shifted hue.
- **Status**: Fixed in this pass with `.rms-text-danger`, `.rms-text-success`, `.rms-text-warning` and `.rms-status-surface--*`.

## Changes made in this pass

- `src/styles/global.css` — added sanctioned `rms-status-surface--*`, `rms-status-badge--*` and `rms-solid--*` utilities built only from semantic status roles.
- `shared/components/header/header.html` — demoted the permanent gold restaurant pill to a quiet bordered chip with brand text; removed the infinite `animate-ping` on the chat icon; tokenized the logout warning icon.
- `shared/components/server-down-banner`, `restricted-banner`, `forbidden-page`, `server-error-page`, `server-down-page` — tokenized error/warning surfaces and the retry action.
- `shared/components/order-detail-dialog` — status badge now uses the documented status roles instead of raw green/blue/yellow/orange/red.
- `shared/components/tree-node-card` — removed the `border-l-4` side-tab; the product type is marked by its accented icon (spec updated).
- `areas/admin/features/chat` — removed the 3px left accent bar and tokenized links/quote/hr.
- Auth validation, inline-create-popover and shared settings — tokenized validation colours.
- `core/config/navigation/role-navigation.ts` — settings masthead sentence no longer duplicates the page subtitle.

## Verification

`npm run lint:check` clean · `npm run build` succeeded · `npx vitest run` 1613/1613 passed · `node scripts/harness.js` green. The committed Playwright visual baselines for the authenticated screens must be re-captured, because the masthead chip and the tokenized banners change those pixels.

## Persona Red Flags

**Alex (power user)**: On desktop cashier, navigation is a phone bar at the bottom of a 1440px window. No keyboard shortcuts anywhere; five order-status changes still need five dropdowns plus Save.

**Sam (keyboard / low vision)**: Status is now consistent by colour role, but the orders table still shows the same status twice (pill + select), once as colour and once as text. Error pages now use the same danger token as inline errors.

**Casey (tablet on the floor)**: The waiter dock is a large fixed pill that overlaps the second combo card while scrolling; the bottom bar and the dock are two stacked fixed surfaces. The masthead loses the RMS wordmark under `md`, so the brand survives as an icon plus a chip.

## Minor Observations

- `environment.ts` (production) still ships `customer: 'Restaurante de prueba'`.
- Login's disabled CTA is a washed gold with muted text; the enabled state is fine (dark text on gold).
- Page titles mix Title Case ("Gestión de Pedidos", "Carta de Productos") and sentence case ("Menú del día", "Pendientes de cobro").
- The chat FAB dot is now static; the assistant remains discoverable without an infinite attention magnet.

## Questions to Consider

- Should the masthead say where you are (place) or what you can do (sentence)? It currently says both, above a page that says both again.
- At what width does cashier stop being a tablet and become a desktop workspace?
- If status lived in one component, how many templates would shrink?

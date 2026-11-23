# RMS frontend — performance, design and visual-coherence review

Date: 2026-11-23
Scope: `frontend/` (Angular 21, zoneless, PrimeNG 21 + Tailwind 4)
Method: source walk of the shell, routes, tokens and 139 templates; production
build (`npm run build`) measured per artifact; lint; grep-based consistency
audit over `src/app`.

What this review does **not** do: no Lighthouse run was executed (needs the
seeded login corpus); the numbers below are bundle/byte measurements plus static
findings. The existing LHCI gate covers runtime metrics.

---

## 0. Baseline (measured)

| Metric | Value |
|---|---|
| Initial payload (index.html graph: `main` + 10 preloaded chunks + CSS) | **324 kB raw / 71 kB gzip** |
| — `main-*.js` | 141 kB raw / 25.5 kB gzip |
| — `styles-*.css` | 90 kB raw / 17.1 kB gzip (non-blocking, critical CSS inlined) |
| Lazy chunks | **144 chunks, 2.85 MB raw (~700 kB gzip)** |
| Largest lazy chunks | 214.5 kB (charts), `products` 167 kB, `combo-wizard-page` 114.7 kB, `cashier-area` 91.8 kB, `admin-area` 91.6 kB |
| Fonts | Archivo variable, 2 subsets, 68 kB; latin preloaded ✔ |
| PrimeIcons artifacts emitted | **630 kB** (`svg` 342 kB, `ttf` 85 kB, `woff` 85 kB, `woff2` 35 kB, `eot` 85 kB) |
| Templates | 139 |
| Axe status | 63/63 route-runs, zero serious/critical ✔ |

**Verdict:** the foundation is genuinely good — zoneless CD, `OnPush`
everywhere, lazy routes, self-hosted variable fonts, inlined critical CSS,
image `width`/`height` + `loading="lazy"` in the main lists, semantic token
layer, passing a11y suite. The remaining problems are **not** "the app is slow";
they are **unnecessary weight added on purpose** (chart.js, chat, preloader) and
**two design generations living side by side**.

---

## 1. Performance findings

### P1 — `chart.js` registers every controller and element (high impact)

`src/app/shared/ui/chart/chart-theme.ts:86`

```ts
Chart.register(...registerables);
```

`registerables` pulls in radar, polarArea, scatter, bubble, logarithmic/time
scales, every element and every plugin. The product only renders **bar, line,
doughnut and bubble** (`grep "ChartData<'"` → bar ×5, line ×2, bubble ×1;
`rmsDoughnutOptions` ×4), plus a hand-built treemap. Registering only what is
used typically removes 40–60 % of the chart chunk — the single largest lazy
chunk is 214 kB.

```ts
import {
  Chart, BarController, LineController, DoughnutController, BubbleController,
  BarElement, LineElement, PointElement, ArcElement,
  CategoryScale, LinearScale,
  Tooltip, Legend, Filler,
} from 'chart.js';

Chart.register(
  BarController, LineController, DoughnutController, BubbleController,
  BarElement, LineElement, PointElement, ArcElement,
  CategoryScale, LinearScale, Tooltip, Legend, Filler,
);
```

Keep the `registered` guard; add a spec that asserts `Chart.registry` contains
only the expected ids so a future `registerables` cannot creep back.

### P2 — the assistant is bundled into every admin route (high impact)

`src/app/areas/admin/admin-area.ts` imports `Chat` statically:

```ts
import { Chat } from '@app/areas/admin/features/chat/chat';
imports: [Layout, RouterOutlet, Chat],
```

`Chat` imports `marked` + `dompurify`. Verified in the build: the
`admin-area` chunk (91.6 kB) contains `DOMPurify` and `marked`. That is ~20 kB
gzip of markdown parsing on **every** admin route load, for a panel most users
never open.

Fix — defer the panel, do not import it eagerly:

```html
<!-- admin-area.html -->
@defer (when isChatOpen()) {
  <app-chat (closed)="isChatOpen.set(false)"></app-chat>
} @placeholder {
  <div class="p-4 text-sm text-muted">Cargando asistente…</div>
}
```

or `loadComponent: () => import(...)` inside the template outlet. Either way
`marked`/`dompurify` become their own chunk fetched on first open.

### P3 — preloading downloads all 144 chunks after boot (high impact on mobile)

`core/preloading/selective-preloading-strategy.ts` only filters 2G/save-data.
On any normal connection it preloads **2.85 MB raw (~700 kB gzip)** immediately
after boot, competing with the current route's data requests.

```ts
preload(route: Route, load: () => Observable<unknown>): Observable<unknown> {
  if (!this.shouldPreload() || route.data?.['preload'] === false) return EMPTY;
  return timer(2_000).pipe(switchMap(() => load())); // or requestIdleCallback
}
```

Then mark the heavy, rarely-used routes `data: { preload: false }`
(`products`, `combo-wizard-page`, `schedules`, `cashier`, `product-creation`).
Keep `dashboard`, `orders`, `manage` preloaded.

### P4 — no `@defer` and no `content-visibility` on heavy dashboards

`grep "@defer"` → 0 hits. The dashboard (643-line template) and the analytics
screens render every below-the-fold block up front. Two cheap tools:

- `@defer (on viewport)` around the analytics sections / long tables;
- `content-visibility: auto` + `contain-intrinsic-size` on off-screen list
  blocks (`.route-content` children, treemap rows, table wrappers). This is
  CSS-only and degrades to normal rendering where unsupported.

Do **not** apply it to above-the-fold blocks — it delays the critical paint.

### P5 — budgets cannot catch a regression

`angular.json` allows `initial` warning at **820 kB**, i.e. 2.5× the measured
324 kB. Tighten so the gate is meaningful:

| Budget | Now | Suggested |
|---|---|---|
| initial warning / error | 820 / 900 kB | **420 / 500 kB** |
| anyComponentStyle | 16 / 32 kB | 16 / 32 kB (keep; `kitchen.css` 17 kB and `week-grid.css` 16.3 kB already sit on the limit) |

### P6 — service worker re-downloads every chunk on update

`ngsw-config.json`: the `app` group uses `installMode: lazy` but
**`updateMode: prefetch`** — on each new deploy the browser prefetches all
`.js` in the group, i.e. all 144 chunks, for every user. Set `updateMode: "lazy"`
for `app` and keep `prefetch` only for `index.html`/fonts. The update will be
picked up on next navigation instead of a 3 MB background download.

### P7 — PrimeIcons ships five formats

Only `woff2` is ever fetched at runtime, but the deploy carries the SVG (342 kB),
TTF, WOFF and EOT too. Serve `woff2` only (subset the icon font to the glyphs
actually used, or `@font-face` with a single `woff2` src). Saves ~590 kB of
artifacts and keeps the PWA cache lean.

### P8 — images are good; finish the last mile

Strengths: `width`/`height` + `loading="lazy"` + `decoding="async"` on the
product lists, product card and recipe thumbnails.

Remaining:
- `products.html:197` and `products.html:288` (preview) have no intrinsic size →
  CLS risk inside the creation wizard.
- No `srcset`/`<picture>`: 48–600 px boxes request the original upload. Add a
  thumbnail size to the API contract and emit `srcset` (or AVIF/WebP variants).
  This is the single biggest real-world byte win on mobile kitchen devices.

### P9 — PWA metadata drifted from the brand

`public/manifest.webmanifest`:

```json
"background_color": "#1a1a1a",
"theme_color": "#F9BB0B",     // old amber, not a design token
"orientation": "portrait-primary",
```

- `#F9BB0B` is not in the palette (`--rms-brand-500` is `#FDEFC7`), so the
  installed-app splash/status bar shows the retired amber.
- `orientation: portrait-primary` **locks the installed app to portrait** — on
  the tablets used in the kitchen/schedule screens this is actively harmful.
  Use `"orientation": "any"` (or omit).
- `index.html` keeps `theme-color` on `prefers-color-scheme` only; after the
  in-app toggle it does not follow. Update the two `<meta name="theme-color">`
  values from `Theme.apply()` (it already syncs `color-scheme`).
- `icon-192/512` declare `purpose: "any maskable"` on the same art; maskable
  needs the safe-zone padding or Android crops the logo. Ship explicit
  `maskable` variants.

### P10 — global CSS carries the legacy override layer

`src/styles.css` is 22.8 kB with **67 `!important`** rules; only 2 component
stylesheets use `!important`. A large part of it re-fights PrimeNG (buttons,
tables, overlays). Every `!important` is a future theme bug (the file's own
comments document two such incidents). See D8/M2.

---

## 2. Design and visual-coherence findings

The design system (`docs/DESIGN.md`, `src/styles/tokens.css`, 20 primitives with
specs) is **well above average**. The problem is that adoption stopped at ~80 %,
and the 20 % that remains is concentrated on the **first screen users see**
(login/auth) and on the **shell** (header/sidebar), while the redesigned screens
(dashboard) look different.

### D1 — two generations of UI in one product (highest visible impact)

| Legacy API | Files | Redesigned equivalent |
|---|---|---|
| `<p-button>` 63 uses | 20 | `app-rms-button` (249 uses / 52 files) |
| raw `pInputText` | 21 | `app-rms-input` / `app-rms-select` |
| `bg-primary-contrast` | 18 | `bg-rms-surface` |
| `text-primary` bridge | 3 | `text-rms-brand-text` |

Worst offender: **`areas/auth/features/login/login.html`** — plain `p-button`,
raw inputs, `text-xl` H1, `gap-1.5`, while the rest of the app has a card-based
primitive look. Login is the LCP screen and the product's first impression.

### D2 — theme drift is encoded in templates

- `dark:` variants: **270 occurrences across 42 of 139 templates**
- `text-surface-*` 209 · `bg-surface-*` 140 · `border-surface-*` 186

The tokens were introduced precisely so a component reads `text-rms-ink-muted`
and follows light/dark/high-contrast with no `dark:` pair. Every manual pair is
a place where high contrast can silently break (and the repo already has a
whole override block in `styles.css` to patch exactly that).

### D3 — the shell has no surface hierarchy

`layout.html`, `header.html` and `sidebar.html` all paint the **same** level:

```html
<div class="… bg-surface-50 … dark:bg-surface-900">   <!-- layout -->
<header class="… bg-surface-50 dark:bg-surface-900">  <!-- header -->
<aside  class="… bg-surface-50 dark:bg-surface-900">  <!-- sidebar -->
```

So the header, the sidebar and the page are indistinguishable; only the inner
cards step up to white. `styles.css` still contains an unused `.header` rule
(`bg-surface-100 dark:bg-surface-800`) that would have given the chrome a
different level — dead, but evidence of the intent.

Recommended hierarchy (2 steps, matching the token model):

```
page    = bg-rms-page      (neutral-50 / 900)
chrome  = bg-rms-surface + border-rms-border   (header, sidebar)
content = bg-rms-page; cards = bg-rms-surface + border
```

### D4 — radius scale has drifted into six values

`rounded-lg` 106 · `rounded-xl` 73 · `rounded-full` 33 · `rounded` 22 ·
`rounded-2xl` 10 · `rounded-md` 3 — plus `--radius-card` / `--radius-container`
declared in the Tailwind theme and effectively unused. The same panel is
`rounded-lg` on mobile and `rounded-2xl` on desktop (`layout.html` main).

Define one rule and document it in `DESIGN.md`:

| Role | Token | Tailwind |
|---|---|---|
| controls, buttons, inputs | 8 px | `rounded-lg` |
| cards, grouped inputs | 12 px | `rounded-xl` |
| page panels / sheets | 16 px | `rounded-2xl` |

Then make `rounded`/`rounded-md` lint-forbidden in feature code.

### D5 — z-index is ad-hoc and collides with the token scale

```
z-[400000] ×4  (workers, payroll dialogs)
z-[200]    ×3  (skip links)
z-[100]    ×1  (sidebar)
z-50 ×6 · z-40 · z-10
```

but `tokens.css` defines `--rms-z-overlay: 1000`. A sidebar at 100 sits below
every PrimeNG overlay (≈1100) and below a 400000 dialog, so the stacking order
is accidental. Use the layer tokens: chrome 10, sticky 20, drawer 40,
overlay 1000, dialog 1100, toast 1200.

### D6 — arbitrary spacing values bypass the 4 px scale

`[400px]` ×9, `[200px]` ×6, `[500px]` ×3, `[22rem]`, `[260px]`, `[9px]`,
`gap-1.5`, `mb-[0.5rem]`, `lg:mb-[1rem]`, `mt-[-1rem]` … The 4/8 px scale exists
in `tokens.css` but is not what the templates use. Prefer Tailwind's own
scale (`gap-2`, `gap-4`, `mb-2`) or the `--rms-space-*` tokens; ban `[...]`
sizes in feature templates via lint.

### D7 — typographic hierarchy is inconsistent on the auth screens

`login.html` H1 is `text-xl font-bold` (20 px) while the token scale says
`--rms-type-h1-size: 1.875rem` (30 px). Labels are `text-sm font-medium`
instead of `rms-label`, and body copy mixes `text-xs text-muted`,
`text-sm text-surface-700 dark:text-surface-300` and `rms-text-danger` in the
same form. The auth shell also lacks the card surface the rest of the product
uses, so it reads as a different application.

### D8 — high contrast is implemented twice

- `src/styles.css`: `html[data-contrast="high"]` block that rewrites `--p-*`
  tokens **and** overrides `.text-surface-*` classes with `!important`;
- `src/styles/tokens.css`: `html[data-contrast='high']` / `prefers-contrast`
  rewriting `--rms-*`.

They agree today (the doc says so), but they are two sources of truth for the
same visual state. Once D2 is done (no `dark:`/`surface-*` classes), the entire
`!important` class-override block can be deleted, leaving only the token values.

### D9 — duplicate component homes

`shared/components/` still holds hand-built `product-card`, `removable-chip`,
`option-group-badge`, `search-input`, `tree-node-card`, `inline-create-popover`
… which partly overlap `shared/ui/` primitives (`card`, `badge`, `input`,
`icon-button`). Two card implementations (`app-rms-card` and a hand-rolled
`<div class="rounded-xl border border-rms-border bg-rms-surface">`) are visible
in the same screens. Consolidate before adding more screens.

### D10 — navigation chrome diverges

- Admin: fixed header + tablet inline nav + sidebar tiles + overflow menu.
- Worker: header + bottom nav + order dock.

Same destination is styled differently in each (radius, active state, height,
icon size). Extract a single `nav-item` primitive used by all three, so active
states (`!text-accent font-semibold`) and touch targets are defined once.

---

## 3. Accessibility and UX polish

| # | Finding | Fix |
|---|---|---|
| A1 | `worker-area.ts:110` `waitForUserData()` re-arms `setTimeout(…, 100)` forever if user data never arrives | bound the retries (e.g. 50 × 100 ms) then navigate to login/forbidden with a log |
| A2 | `viewport` lacks `viewport-fit=cover` while iOS status bar is `black-translucent`; only 2 `safe-area-inset` usages | add `viewport-fit=cover` and pad the header/bottom nav with `env(safe-area-inset-*)` |
| A3 | login "Campo requerido" is shown for any invalid state (format errors included) | use the field error from the control (`email` → "Correo no válido") |
| A4 | login terms row nests a `<button>` inside a `<span>` next to a `p-checkbox`; the label association is split | wrap in `app-rms-checkbox` with a description slot / link |
| A5 | `theme-color` not updated on manual theme toggle (see P9) | sync both metas in `Theme.apply()` |

Axe is green; these are UX/semantics, not gate failures.

---

## 4. Maintainability

| # | Finding |
|---|---|
| M1 | 67 `!important` in `src/styles.css`; split it into `@layer` blocks (base / primeng-bridge / legacy) and delete what the token migration makes redundant |
| M2 | `styles.css` mixes font faces, Tailwind theme bridge, legacy PrimeNG fixes, high-contrast overrides and responsive button helpers in one 22 kB file |
| M3 | 3 NG8113 warnings (unused `RmsButton` imports in `cohort`, `operations`, `prime-cost`) — build is not warning-clean |
| M4 | No lint rule enforces the design system: palette classes, arbitrary `[...]` sizes/radii, `z-[…]`, raw `p-button`/`pInputText` in feature code |

Suggested ESLint guards (cheap, high leverage):

```js
// no-template-classes with regex: /(text|bg|border)-surface-\d+/, /\brounded(-md)?\b/, /z-\[/
'no-restricted-syntax': [/* forbid `p-button` selector in areas/** */]
```

---

## 5. Prioritized action plan

### Now — quick wins (≈1–2 days, measurable)

1. **P2** defer the chat → every admin route loses ~20 kB gzip.
2. **P1** register only the chart controllers actually used → biggest lazy chunk
   shrinks ~50 %.
3. **P3** preload on idle + `data.preload: false` for heavy routes.
4. **P6** `updateMode: "lazy"` for the SW `app` group.
5. **P9** manifest: brand `theme_color`/`background_color`, `orientation: "any"`,
   sync `theme-color` on toggle, real maskable icons.
6. **P5** tighten budgets so regressions fail.
7. **M3** remove the 3 unused imports (warning-clean build).

### Next — visual coherence (≈1 sprint)

8. **D1/D7** migrate `areas/auth/**` (login, 2FA, recovery, setup) to
   `app-rms-*` primitives and the type roles — this is the first impression.
9. **D3** shell surface hierarchy (page / chrome / cards) in
   `layout.html`, `header.html`, `sidebar.html`, `worker-layout.html`.
10. **D4/D5/D6** adopt the 3-step radius rule, the layer tokens, and the 4 px
    scale; add the lint guards.
11. Migrate the remaining `manage/**` legacy files (combos, settings, time-logs,
    payroll) off `p-button`/`pInputText`/`text-surface-*`.

### Later — structural

12. **D2** burn down the 270 `dark:` pairs / 535 `*-surface-*` classes; then
    delete the `!important` high-contrast block (**D8**) and most of **M1**.
13. **P4** `@defer (on viewport)` + `content-visibility` for analytics/table
    heavy sections.
14. **D9/D10** consolidate duplicate cards and extract one `nav-item`.
15. **P8** thumbnail variants in the API contract + `srcset`.
16. **P7** subset/trim PrimeIcons to `woff2`.

---

## 6. Suggested definition of done for the design work

- `grep -r "p-button\|pInputText\|text-surface-\|dark:\|bg-primary-contrast"`
  in `src/app/**/*.html` → 0 for migrated areas.
- One radius rule, one z-index scale, no `[...]` sizes in feature templates
  (enforced by lint).
- `npm run build` has zero warnings; initial budget ≤ 500 kB.
- `/dev/ui` gallery becomes the visual regression reference for light, dark and
  high contrast.

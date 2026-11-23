# RMS Design System

> Authoritative reference for tokens, primitives, theming and migration.
> Layout and IA are fixed (D-002); this document only governs what happens
> inside the existing shell.

Owner: DS lane. Files owned by this lane:

| Path | Purpose |
|---|---|
| `src/styles/tokens.css` | Primitive, semantic, dark and high-contrast token values |
| `src/styles/global.css` | Focus system, type roles, reduced/forced motion, helpers |
| `src/styles.css` | Tailwind theme bridge, font faces, legacy compatibility |
| `src/app/app.config.ts` | PrimeNG preset mapped to the semantic tokens |
| `src/app/shared/ui/**` | Primitives, chart theme and the dev gallery |

No feature lane may add raw colours, raw radii or palette classes. See
"Migration rules" at the end.

---

## 1. Architecture

Three layers, one direction of dependency:

```
primitive  ->  semantic  ->  component
(raw values)   (roles)      (app-rms-*)
```

- **Primitive** values live only in `src/styles/tokens.css` (`--rms-neutral-*`,
  `--rms-brand-*`).
- **Semantic** tokens describe a role (`--rms-bg-surface`, `--rms-text-muted`,
  `--rms-danger-fg`). Feature code and primitives read these.
- **Component** tokens (`--rms-control-bg`, `--rms-table-header-bg`) alias
  semantics for a specific primitive family. They are still defined centrally.

Theme activation:

| Theme | Selector |
|---|---|
| Light | `:root` (default) |
| Dark | `.dark` on `<html>` |
| High contrast (OS) | `@media (prefers-contrast: more)` |
| High contrast (in-app) | `html[data-contrast="high"]` (Accessibility service) |

The theme boots in `index.html` before first paint and is kept in sync by
`core/services/theme`; do not add a second mechanism.

---

## 2. Colour tokens

### 2.1 Neutral and brand primitives

| Token | Value | Use |
|---|---|---|
| `--rms-neutral-0` | `#ffffff` | Card surface (light) |
| `--rms-neutral-50` | `#f8fafc` | Page (light) |
| `--rms-neutral-100` | `#f1f5f9` | Subtle fill, table header |
| `--rms-neutral-200` | `#e2e8f0` | Hairline border |
| `--rms-neutral-300` | `#cbd5e1` | Input border (light), strong border |
| `--rms-neutral-400` | `#94a3b8` | Placeholder, muted text (dark) |
| `--rms-neutral-500` | `#64748b` | Slate mid-tone primitive (see `--rms-text-muted`) |
| `--rms-neutral-600` | `#475569` | Secondary text (light, 7.24:1) |
| `--rms-neutral-700` | `#334155` | Border (dark), body text (light) |
| `--rms-neutral-800` | `#1e293b` | Card surface (dark) |
| `--rms-neutral-900` | `#0f172a` | Page (dark), primary text (light) |
| `--rms-neutral-950` | `#020617` | Sunken surface (dark) |
| `--rms-brand-500` | `#fdefc7` | **Fill only**: primary CTA, selected marker |
| `--rms-brand-600` | `#d9a209` | Primary hover |
| `--rms-brand-700` | `#b07e06` | Primary active, large graphic strokes |
| `--rms-brand-text` | `#8a6508` / `#f2daa2` | Brand-coloured **text and borders** |
| `--rms-brand-soft` | `#fef7e0` / `#2a230f` | Selected row/badge background |
| `--rms-on-brand` | `#896511` | Dark-gold **ink** on the cream fill |

### 2.1.1 Hard rule — a colour keeps its role

Every colour has exactly one job: **fill**, **ink** or **border**. The pair is
deliberate and must never be inverted:

- `#fdefc7` is the **fill** (background). It is never text or a border colour
  for content on white.
- `#896511` is the **ink/border** (dark gold). It is **never a background**:
  no `background: #896511`, no `bg-[#896511]`, no inline `background-color`
  with that value. The same applies to every `*-text`, `*-fg`, `*-border` and
  `*-on-*` token: those tokens are ink, not surfaces.
- The only legitimate dark-gold surface is a status/solid token that explicitly
  says `*-solid` and carries its matching `*-on-solid` ink. Brand text is not
  one of them.
- Do not repurpose a global palette token to fix one component, and do not
  invert a fill/ink pair when a design change arrives. Change the component to
  the token with the correct role; if the pair itself changes, update both
  tokens and re-run contrast checks.
- Before touching a brand value, list every surface that reads it (buttons,
  tabs, badges, charts, calendars) and run the a11y suite; a palette edit is a
  cross-product change, not a one-screen change.

### 2.2 Semantic roles

| Token | Light | Dark | Role |
|---|---|---|---|
| `--rms-bg-page` | `#f8fafc` | `#0f172a` | App/page background |
| `--rms-bg-surface` | `#ffffff` | `#1e293b` | Card, dialog, input surface |
| `--rms-bg-subtle` | `#f1f5f9` | `#172033` | Table header, quiet fill |
| `--rms-bg-sunken` | `#eef2f7` | `#0b1220` | Inset well |
| `--rms-bg-inverse` | `#0f172a` | `#f1f5f9` | Inverted band |
| `--rms-bg-selected` | `#fef7e0` | `#2a230f` | Selected row/option |
| `--rms-bg-disabled` | `#f1f5f9` | `#1e293b` | Disabled control |
| `--rms-bg-overlay` | `rgb(15 23 42 / .55)` | `rgb(2 6 23 / .72)` | Modal scrim |
| `--rms-border` | `#e2e8f0` | `#334155` | Hairline |
| `--rms-border-strong` | `#cbd5e1` | `#475569` | Input/control border |
| `--rms-text` | `#0f172a` | `#e2e8f0` | Body and headings |
| `--rms-text-secondary` | `#475569` | `#cbd5e1` | Labels, support copy |
| `--rms-text-muted` | `#5f6b7d` | `#94a3b8` | Captions, hints (4.9:1 on subtle/sunken) |
| `--rms-text-inverse` | `#ffffff` | `#0f172a` | On inverse surfaces |
| `--rms-text-on-brand` | `#1e1b19` | `#1e1b19` | On a gold fill |
| `--rms-text-disabled` | `#94a3b8` | `#64748b` | Disabled text |
| `--rms-link` | `#1d4ed8` | `#93c5fd` | Inline links |
| `--rms-focus` | `#1d4ed8` | `#93c5fd` | Focus ring |

Rules:

- Dark is derived from the same slate ramp, never a second palette (no zinc).
- Elevation never inverts: page < surface < raised. Inputs sit on `surface`
  with `border-strong`; they do not sink.
- Elevation is a surface step plus a 1px border. No box-shadow on content.

### 2.3 Status

Every status has four roles: `fg` (text), `bg` (soft fill), `border`, `solid`
(filled chip/button) and `on-solid`. Light:

| Status | fg | bg | border | solid |
|---|---|---|---|---|
| success | `#065f46` | `#ecfdf5` | `#a7f3d0` | `#047857` |
| warning | `#92400e` | `#fffbeb` | `#fde68a` | `#b45309` |
| danger | `#b91c1c` | `#fef2f2` | `#fecaca` | `#b91c1c` |
| info | `#1d4ed8` | `#eff6ff` | `#bfdbfe` | `#1d4ed8` |
| neutral | `#334155` | `#f1f5f9` | `#e2e8f0` | `#475569` |

Dark variants are the light-text/soft-fill counterparts (`#6ee7b7` on
`#052e22`, and so on). `success`, `warning`, `danger` and `info` tokens exist for
each role: `--rms-<status>-fg|bg|border|solid|on-solid`.

Only `fg` is allowed on text. `solid` is for a filled chip or button and its
label uses `on-solid`.

Domain mapping (do not invent per-screen colours):

| State | Token |
|---|---|
| Table AVAILABLE / Order READY / Worker ACTIVE | success |
| Table OCCUPIED / Order PREPARING | info |
| Table RESERVED / Order PENDING / IN_QUEUE / low stock | warning |
| Table DIRTY / Order DELIVERED / Worker INACTIVE | neutral |
| Order CANCELLED / stock 0 | danger |
| Data partial | warning banner (`role="status"`) |

### 2.4 Chart tokens

`--rms-chart-1..8`, plus `--rms-chart-grid`, `--rms-chart-axis`,
`--rms-chart-legend-text`, `--rms-chart-tooltip-bg|text|border`. Dark values are
the lighter counterparts. Fixed mappings:

- Sales actual = series 1. Comparison = series 7 (dashed).
- COGS: FOOD 5, BEVERAGE 1, ALCOHOL 4, OTHER 7.
- Labor by area: FOH 2, BOH 5.
- Menu quadrants: STAR success, PLOWHORSE warning, PUZZLE info, DOG danger.
- Prime cost line = danger, margin = success. Two lines maximum.

---

## 3. Typography

One family (Archivo, self-hosted variable), four weights (400/600/700, plus 900
for the wordmark only).

| Class / token | Size / line | Weight | Use |
|---|---|---|---|
| `.rms-display` | 36 / 44 | 700 | Auth hero, error pages |
| `.rms-h1` | 30 / 38 | 700 | Page title, one per route |
| `.rms-h2` | 24 / 32 | 700 | Section title |
| `.rms-h3` | 20 / 28 | 600 | Card/group title |
| `.rms-h4` | 16 / 24 | 600 | Panel subheading |
| `.rms-body-lg` | 16 / 26 | 400 | Waiter/kitchen/auth reading text |
| `.rms-body` | 14 / 22 | 400 | Admin default |
| `.rms-caption` | 12 / 18 | 400 | Hints, timestamps, axis labels |
| `.rms-label` | 12 / 16 | 600 | Form labels, table headers |
| `.rms-numeric` | 16 / 24 | 600 | KPI value, tabular |
| `.rms-numeric-lg` | 30 / 36 | 700 | Primary KPI only, tabular |

Rules:

- One H1 per page. `app-rms-page-header` owns it. The logo is a link, not a
  heading.
- Admin tables use body 14 with `.rms-tabular`; never 16px cells.
- Waiter body minimum 16px; never 12px for product names or prices.
- Hyphenation is off globally (`hyphens: manual`); long words wrap, never split.
- Money goes through the `money` pipe; dates through a date helper. Never raw
  ISO in the UI.
- Weights 800/900 are reserved for the wordmark.

Tokens: `--rms-type-<role>-size|line`, `--rms-weight-*`.

---

## 4. Spacing, radii, borders, elevation, density

Spacing is a 4px scale: `--rms-space-1|2|3|4|5|6|8|10|12|16` = 4, 8, 12, 16,
20, 24, 32, 40, 48, 64. No arbitrary values (`p-[13px]` is banned).

Radii: `--rms-radius-sm` 8 (controls), `--rms-radius-md` 12 (cards),
`--rms-radius-lg` 16 (page panels), `--rms-radius-full` (pills).

Borders: `--rms-border-width` 1px, `--rms-border-width-strong` 2px (inputs in
high contrast, switch track, checkbox).

Elevation: `--rms-elevation-0` none, `--rms-elevation-1|2` are 1px rings. No
blur shadows on content. Overlays separate with a scrim, not a drop shadow.

Density is a surface decision:

| Token | Value | Surface |
|---|---|---|
| `--rms-control-sm` | 32 | Compact admin tables |
| `--rms-control-md` | 40 | Admin comfortable |
| `--rms-control-lg` | 48 | Waiter, cashier |
| `--rms-control-xl` | 56 | Kitchen |
| `--rms-touch-min` | 44 | Product floor for any touch target |
| `--rms-row-compact` | 40 | Admin restaurant tables |
| `--rms-row-comfortable` | 48 | Everything else |

---

## 5. Motion

| Token | Value | Use |
|---|---|---|
| `--rms-motion-fast` | 120ms | Hover, focus, colour |
| `--rms-motion-base` | 180ms | Expand, tab, toast |
| `--rms-motion-slow` | 280ms | Sheet/drawer |
| `--rms-motion-chart` | 240ms | First chart render |
| `--rms-ease` | `cubic-bezier(.2,0,0,1)` | Enter/move |
| `--rms-ease-exit` | `cubic-bezier(.4,0,1,1)` | Dismiss |

Motion communicates state, never decoration: no bounce, no idle pulse, no scale
on hover. A global `prefers-reduced-motion: reduce` block sets animation and
transition durations to `0.01ms`, disables `scroll-behavior: smooth` and is the
only gate a component needs. Chart.js animation is disabled under reduced
motion by the chart theme.

---

## 6. Focus and accessibility floor

- One ring: `2px solid var(--rms-focus)` with `2px` offset (3px in high
  contrast). It is applied globally by `:focus-visible` to links, buttons,
  inputs, selects, textareas, summaries, `[tabindex]` and ARIA widgets.
- Never remove an outline. If a component moves the ring to a custom box (for
  example the checkbox), it must draw the same token ring on that box.
- Skip link: `.rms-skip-link` plus `<main id="main" tabindex="-1">`. The Shell
  lane owns adding it to the layouts.
- Icon-only controls require a name. `app-rms-icon-button` makes `ariaLabel` a
  required input; a tooltip is a supplement, never the name.
- Errors are exposed with `aria-invalid` and `aria-describedby`; the message is
  `role="alert"` and stays in the DOM.
- Skeleton blocks are `role="status"` with a label; their bars are
  `aria-hidden`.
- Status is always text plus colour; colour alone is a defect.
- Forced colors: borders are preserved with system colours and status dots are
  forced to `ButtonText`.

Contrast targets: 4.5:1 for normal text, 3:1 for large text and graphics. The
token values above are chosen to meet them on their intended surfaces; the
contrast and focus gates belong to the QA lane.

---

## 7. PrimeNG mapping

The preset lives in `src/app/app.config.ts` and maps PrimeNG onto the semantic
layer:

| PrimeNG token | Value |
|---|---|
| `--p-primary-color` | `var(--rms-brand-500)` |
| `--p-primary-contrast-color` | `#ffffff` (kept for `bg-primary-contrast` cards) |
| `--p-surface-0..950` | the slate ramp, identical in light and dark |
| `--p-content-background` | `#ffffff` / `#1e293b` |
| `--p-content-border-color` | `#e2e8f0` / `#334155` |
| `--p-text-color` | `#0f172a` / `#e2e8f0` |
| `--p-text-muted-color` | `#64748b` / `#94a3b8` |
| `--p-form-field-background` | `#ffffff` / `#1e293b` |
| `--p-form-field-border-color` | `#cbd5e1` / `#475569` |
| `--p-focus-ring-color` | `var(--rms-focus)` |
| `--p-focus-ring-width` | `2px` |
| `--p-focus-ring-offset` | `2px` |
| `--p-highlight-background` | `var(--rms-bg-selected)` |
| `--p-highlight-color` | `var(--rms-brand-text)` |

Rules:

- PrimeNG remains the substrate for tables, dialogs, selects and toasts. Do not
  rebuild them; wrap them.
- Do not add local `!important` overrides to fight the theme. The legacy
  datatable-header and dark-input overrides were replaced with semantic tokens.
- Primary button labels use ink (`#1e1b19`), never white on gold.
- `bg-primary-contrast` is a legacy alias for the card surface; new code uses
  `bg-rms-surface`.

---

## 8. Charts

One configuration module: `shared/ui/chart/chart-theme.ts`.

- `applyRmsChartDefaults()` registers Chart.js once and reads tokens at call
  time (light/dark/high contrast follow automatically). `RmsChartFrame` calls it
  on render and on theme-class changes.
- Palette: `rmsChartPalette()` (eight series).
- Options builders: `rmsLineOptions()`, `rmsBarOptions()`,
  `rmsDoughnutOptions()`. They set responsive layout, category axis without
  gridlines, 12px ticks, muted axis colour, 1px grid, tooltip surface and
  hidden canvas legend by default.
- Legend is HTML below the plot (`[rmsChartLegend]`), never absolute inside the
  canvas.
- Every chart sits in `app-rms-chart-frame`: fixed height, `overflow: hidden`,
  title/subtitle, loading, empty, error and a data-table fallback
  (`[rmsChartData]` in a "Ver datos" disclosure or visually hidden).
- No chart animation on resize; none under reduced motion.
- KPIs state their period ("Último mes") and render `—`, not `0,00 %`, when the
  denominator is empty.

---

## 9. Primitives

All selectors use the `app-` prefix required by ESLint (`app-rms-*`), are
standalone, `OnPush`, and import directly from their folder (no barrel, so
`chart.js` stays out of feature bundles):

```ts
import { RmsButton } from '@shared/ui/button/button';
```

Inputs are decorator inputs (not `input()` signals) on purpose: the Vitest
runner uses JIT, which does not register signal inputs. Internal state still
uses signals. Keep it that way for every new primitive.

### 9.1 Actions

| Component | API |
|---|---|
| `app-rms-button` | `variant: primary\|secondary\|ghost\|danger\|link` (default primary), `size: sm\|md\|lg\|xl` (md), `type`, `disabled`, `loading`, `iconStart`, `iconEnd`, `ariaLabel`, `block`. Label is projected. |
| `app-rms-icon-button` | `icon` (required), `ariaLabel` (required), `tooltip`, `variant: ghost\|secondary\|danger`, `size`, `disabled`, `type`. |

```html
<app-rms-button variant="primary" iconStart="pi pi-plus">Nuevo producto</app-rms-button>
<app-rms-icon-button icon="pi pi-pencil" ariaLabel="Editar producto" />
```

### 9.2 Forms

| Component | API |
|---|---|
| `app-rms-field` | `label` (required), `controlId`, `hint`, `error`, `required`, `optionalLabel`, `hideLabel`, `size`. Exposes `describedBy`, `labelId`, `hintId`, `errorId`. |
| `app-rms-input` | `label` (required), `id`, `type`, `placeholder`, `hint`, `error`, `required`, `optionalLabel`, `hideLabel`, `autocomplete`, `inputMode`, `maxLength`, `name`, `size`, `disabled`, `readonly`; CVA. |
| `app-rms-textarea` | same as input plus `rows`, `showCount`; CVA. |
| `app-rms-select` | `label` (required), `options: {label, value, disabled?}[]`, `placeholder`, `hint`, `error`, `required`, `showClear`, `filter` (auto above 8 options), `size`, `disabled`; CVA. |
| `app-rms-checkbox` | `label` (required), `description`, `disabled`, `required`; CVA boolean. |
| `app-rms-switch` | `label` (required), `onLabel`, `offLabel`, `showState`, `disabled`; CVA boolean, `role="switch"`. |

```html
<app-rms-input formControlName="name" label="Nombre" [error]="nameError" />
<app-rms-select label="Área" [options]="areas" formControlName="areaId" />
<app-rms-checkbox formControlName="active" label="Producto activo" />
```

Use `app-rms-field` only for custom controls; pass its `describedBy` to the
control's `aria-describedby`.

### 9.3 Overlays

| Component | API |
|---|---|
| `app-rms-dialog` | `visible` + `visibleChange`, `header` (required), `width` (clamped to 92vw), `closeOnEscape`, `dismissableMask`. Project body; footer via `[rmsDialogFooter]`. |
| `app-rms-sheet` | `open` + `openChange`, `title` (required), `side: bottom\|end`, `dismissible`. Native `<dialog>` + `showModal()`. Footer via `[rmsSheetFooter]`. |

D-012: PrimeNG Dialog for complex flows, native sheet for simple panels.

```html
<app-rms-dialog [(visible)]="open" header="Nuevo producto">
  …form…
  <div rmsDialogFooter>
    <app-rms-button variant="secondary" (click)="open = false">Cancelar</app-rms-button>
    <app-rms-button>Guardar</app-rms-button>
  </div>
</app-rms-dialog>
```

### 9.4 Surfaces and feedback

| Component | API |
|---|---|
| `app-rms-card` | `tone: surface\|subtle\|sunken`, `padding: none\|sm\|md\|lg`, `title`, `subtitle`. Slots `[rmsCardActions]`, `[rmsCardFooter]`. |
| `app-rms-section` | `title` (required), `description`, `level: 2\|3`. Slot `[rmsSectionActions]`. |
| `app-rms-badge` | `label` (required), `tone: success\|warning\|danger\|info\|neutral\|brand`, `variant: soft\|solid\|outline`, `size`, `dot`. |
| `app-rms-status-pill` | `label` (required), `status: RmsStatus`, `dot`, `size`. |
| `app-rms-empty-state` | `icon`, `title` (required), `message`, `actionLabel`, `actionIcon`, `secondaryLabel`; outputs `action`, `secondaryAction`. |
| `app-rms-skeleton` | `variant: text\|rect\|circle`, `width`, `height`, `lines`, `ariaLabel`. |
| `app-rms-page-header` | `title` (required), `subtitle`, `backLabel`; output `back`. Slots `[rmsPageHeaderMeta]`, `[rmsPageHeaderActions]`. |
| `app-rms-stat-tile` | `label` (required), `value`, `period`, `delta`, `deltaTone`, `icon`, `loading`, `emphasis`. |
| `app-rms-chart-frame` | `title` (required), `subtitle`, `height`, `loading`, `empty`, `error`, `emptyMessage`, `emptyActionLabel`, `errorTitle`, `summary`, `dataMode: none\|disclosure\|hidden`, `dataLabel`; outputs `retry`, `emptyAction`. Slots `[rmsChartActions]`, `[rmsChartLegend]`, `[rmsChartData]`. |

### 9.5 Gallery

`shared/ui/gallery/gallery.ts` renders every token family and every primitive
in both themes, plus a PrimeNG comparison. It refuses to render outside dev
mode and is **not routed** yet. The Shell lane adds:

```ts
// app.routes.ts — dev-only, never in production
{
  path: 'dev/ui',
  canMatch: [() => isDevMode()],
  loadComponent: () =>
    import('./shared/ui/gallery/gallery').then((m) => m.UiGallery),
}
```

Suggested URL: `/dev/ui`. Do not add it to navigation.

---

## 10. Do / Don't

Do:

- Read semantic tokens (`var(--rms-text-muted)`) or compose primitives.
- Use the type role classes, the 4px spacing scale and the documented radii.
- Keep one H1 and one primary action per view.
- Pass a `summary` and a data table to every chart.
- Use `--rms-<status>-fg` for status text and the matching `-bg`/`-border` for
  the chip.
- Keep touch targets at 44px minimum, 48px on waiter, 56px actions in kitchen.

Don't:

- Don't write hex, rgb, `black`, `white` or palette classes
  (`text-red-500`, `bg-green-600`, `text-surface-*` for new code) in feature
  templates.
- Don't use gold as text, icon, chart series or selected text. Use
  `--rms-brand-text`.
- Don't add box-shadow to content. Use a border and a surface step.
- Don't use `bg-surface-0`/`bg-white`; use `bg-rms-surface`.
- Don't create a second H1, a second primary button or a second bottom bar.
- Don't put a legend inside a canvas or absolute over a table.
- Don't create ad-hoc sizes or radii; extend the scale in a PR owned by DS.

Utility equivalents available from the Tailwind bridge:
`bg-rms-page|surface|subtle|sunken`, `border-rms-border|border-strong`,
`text-rms-ink|ink-secondary|ink-muted|ink-inverse`, `bg-rms-brand`,
`text-rms-brand-text`, `text-rms-success|warning|danger|info`,
`text-rms-h1|h2|h3|h4|display|body|caption|label`.

---

## 11. Migration rules (P1-DS-11 and later)

Feature lanes migrate one module at a time; the DS lane does not bulk-edit
feature templates.

1. Replace every raw hex in `src/app/areas` with a semantic token. The only
   allowed home for raw values is `src/styles/tokens.css` and the chart palette
   fallbacks.
2. Replace palette classes (`text-green-*`, `text-red-*`, `text-amber-*`) in
   domain states with `app-rms-status-pill` / `--rms-*-fg`.
3. Replace `text-primary` with `text-rms-brand-text` or `text-accent`. A legacy
   bridge currently makes `text-primary` readable; it is temporary.
4. Replace hand-built page titles with `app-rms-page-header` (one H1).
5. Replace hand-built tables with the table primitive when it lands; until then
   keep the PrimeNG table and add `aria-label` via pass-through.
6. Replace chart markup with `app-rms-chart-frame` and the chart theme options.
7. Replace `bg-primary-contrast` surfaces with `bg-rms-surface` and the old
   auth variables (`--surface-ground`, `--text-color-secondary`) with semantic
   tokens.
8. Remove any `outline: none` that does not provide the token ring.
9. Delete legacy `.text-primary`-style bridges only in the migration PR, after
   the grep gate reports zero usages.

Legacy compatibility kept in Round 1 (do not add new uses):

- `--accent-text` aliases `--rms-brand-text`.
- `--muted-text` aliases `--rms-text-secondary`.
- `.text-primary` is overridden to `--rms-brand-text`.
- PrimeNG `surface-*` utilities still resolve to the same slate ramp.
- The old high-contrast PrimeNG override block remains; it now agrees with the
  token values.

---

## 12. Testing

- Every primitive has a spec under its folder with a contract header following
  `docs/testing.md`.
- Run `npx vitest run src/app/shared/ui` for the primitive suite.
- Specs must be JIT-compatible: decorator inputs/outputs, no required signal
  inputs, `?raw` templates resolved through `testing/ui-test-resources.ts`.
- Accessibility assertions live in the specs: names, `aria-invalid`,
  `aria-describedby`, roles (`status`, `alert`, `switch`, `img`), decorative
  icons hidden, and one H1 where the component owns it.
- Run `npm run lint:check`, `npx tsc -p tsconfig.app.json --noEmit` and
  `npm run build` before handing off.

### Hard rule — fill vs ink (incident 2026-11-23)

A palette edit set the dark-gold ink (`#896511`) as `primary.contrastColor` to
put it on the new cream fill. Because legacy surfaces read
`--p-primary-contrast-color` as a **background** (`bg-primary-contrast`), the
header account chip and cards turned dark gold with dark text. The mistake was
using one token for two roles.

Rules going forward:

1. Fill tokens (`--rms-brand-500`, `--rms-brand-soft`, `*-bg`, `*-solid`) are
   backgrounds; ink tokens (`--rms-brand-text`, `*-fg`, `*-text`, `*-on-*`)
   are text/borders. Never cross them.
2. `#896511` is ink/border only; `#fdefc7` is a fill only.
3. A component-level fix must not edit the global ramp. Add or use a
   role-specific token instead.
4. Any change to a role token requires the a11y suite before commit, including
   the schedules calendar (small 12 px text on tinted bars).

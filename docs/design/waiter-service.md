# Waiter Service Design Guide

> Source of truth for **visual + interaction** design of waiter interfaces (`/worker` dashboard).
>
> Stack: Angular 21 + PrimeNG 21 (`@primeuix/themes` Aura preset) + Tailwind CSS v4 (`@tailwindcss-primeui` preset) + local **Archivo** woff2 fonts. Frontend mobile-first (390×884), one-handed thumb operation.
>
> **Merging into the existing system** — do not introduce new tech. Extend the current stack:
> - Primary palette already gold `#F9BB0B` (see `src/environments/theme.ts`).
> - Archivo already loaded locally (see `public/fonts/Archivo-*.woff2` + `@font-face` in `src/styles.css`).
> - All tokens via Tailwind v4 `@theme {}` block in `src/styles.css`, never a config file.

---

## 1. Brand Personality

**Serious · Professional · High-Velocity.**

Designed for the high-pressure restaurant floor: every interaction must feel *certain*, every piece of information *scannable at a glance*. Enterprise-grade efficiency — clean slate neutral surfaces, minimal decoration, maximum clarity. The tone is executive: no ornament, no tactile nostalgia. Gold `#F9BB0B` provides the only chromatic accent, used sparingly for primary calls to action and active state.

The waiter dashboard is a full-height view hosted by `<app-worker-layout>`. The parent layout provides `<app-header>`; the dashboard adds a horizontal navigation bar below it, then renders feature content inline.

---

## 2. Color Tokens

> All colors below are **Aros Hospitality Core** Material 3-style tokens. In code use the PrimeNG semantic equivalents (`--p-primary-*`, `--p-surface-*`, etc.) so dark mode + high-contrast work automatically.

### 2.1 Functional Map

| Role | Light hex | PrimeNG semantic | Use case |
|---|---|---|---|
| **Primary** | `#795900` (text) / `#f9bb0b` (container) | `--p-primary-*` | Brand identity, active selection, primary CTAs |
| **Secondary (Info)** | `#0058be` (text) / `#2170e4` (container) | `--p-info-*` | "Preparing in Kitchen", active progress, info badges |
| **Tertiary (Success)** | `#006c49` (text) / `#4cdda2` (container) | `--p-success-*` | **"Ready at Pass"** — highest-priority waiter notification |
| **Error** | `#ba1a1a` (text) / `#ffdad6` (container) | `--p-error-*` | "Cancelled" / "Voided" actions |
| **Warning (Pending)** | amber family | `--p-warn-*` | "In Queue" status |

### 2.2 Surface Strategy — Slate Enterprise

| Layer | Light hex | Use |
|---|---|---|
| Page background | `#f8fafc` (slate-50) | Body / page |
| Cards & panels | `#ffffff` (white / surface-0) | Content containers |
| Borders & dividers | `#e2e8f0` (slate-200) | Hairline card borders |
| Secondary text | `#64748b` (slate-500) | Subtle metadata |
| Body text | `#0f172a` (slate-900) | Primary content text |

No warm cream anywhere. The slate neutral family communicates professionalism, cleanliness, and enterprise readiness. Page background `slate-50` provides a subtle cool-tinted foundation; cards are pure white for maximum clarity.

**Dark mode:** deep charcoal `#0a0a0a` for OLED battery efficiency — critical for 8–10 h shifts.

### 2.3 Outline & Border

| Token | Light | Use |
|---|---|---|
| `outline` | `#475569` (slate-600) | Focus rings, active borders |
| `outline-variant` | `#cbd5e1` (slate-300) | Hairline dividers, card borders |

### 2.4 High-Contrast Mode (Accessibility)

> Forces strict black `#000000` background + electric yellow `#ffff00` interactive targets + white text for **maximum outdoor legibility** (terrace, sunny patio).

Implemented via PrimeNG theme variants — do not hardcode.

---

## 3. Typography

**Single family: `Archivo`** (grotesque, tall x-height, fast to scan while moving).

### 3.1 Type Scale

| Token | Size / weight / line | Tailwind class | Use |
|---|---|---|---|
| `display-lg` | 39 / 900 / 48, -0.02em | `text-4xl font-black tracking-tight` | Marketing splash (rare in waiter app) |
| `headline-xl` | 36 / 900 / 44, -0.01em | `text-[36px] font-black` | Desktop brand header |
| `headline-xl-mobile` | 28 / 900 / 34 | `text-[28px] font-black` | **Mobile page title** |
| `headline-md` | 24 / 700 / 32, -0.01em | `text-2xl font-bold` | Section title |
| `body-lg` | 18 / 500 / 28 | `text-lg font-medium` | Primary product list item |
| `body-bold` | 16 / 700 / 24 | `text-base font-bold` | Product title, totals |
| `body-base` | 16 / 400 / 24 | `text-base font-normal` | Default body, descriptions |
| `label-caps` | 10 / 700 / 14, 0.15em | `text-[10px] font-bold tracking-[0.15em] uppercase` | Functional metadata labels |

### 3.2 Rules

- **All containers** implement `overflow-wrap: break-word` so user-scaled text never breaks the layout.
- Heavy weights (900) anchor page titles; medium (500) preferred over book (400) for product lists.
- Tighter tracking on displays; wide tracking on `label-caps` (e.g. "TÉRMINO DE COCCIÓN") to separate functional labels from content.

---

## 4. Spacing & Layout

**8 px base unit.**

### 4.1 Spacing Tokens

| Token | Value |
|---|---|
| `xs` | 4 px |
| `sm` | 8 px |
| `md` | 16 px |
| `lg` | 24 px |
| `xl` | 32 px |
| `gutter` | 16 px |
| `margin-mobile` | 16 px |
| `margin-desktop` | 24 px |
| `touch-target-min` | 44 px (WCAG-friendly) |

### 4.2 Layout Grid

**12-column fluid grid** with viewport specialization:

| Viewport | Layout |
|---|---|
| **Desktop / Tablet** (≥ 1024 px) | 3-column split. First 2 columns (66 %) = Catalog Workspace (categories / search / products). Third column (33 %) = Checkout Sidebar. |
| **Mobile** (< 1024 px) | Single stacked column. Checkout Sidebar becomes a **persistent summary bar** or a full-screen overlay. |

### 4.3 Workspace Layout

The waiter dashboard at `/worker` is a **full-height view**:
1. **Parent `<app-worker-layout>`** provides `<app-header>` with brand, user menu, overflow.
2. **Horizontal nav bar** immediately below the header (no gap) — inline tab switcher for the 3 feature sections.
3. **Content area** fills remaining vertical space. Feature components render directly inside `@if` blocks — no shell wrapper, no extra header.

```
┌─────────────────────────────────────┐
│  <app-header>  (from parent layout) │
├─────────────────────────────────────┤
│  [Menú del Día] │ [Carta] │ [Pedidos] │  ← inline nav bar
├─────────────────────────────────────┤
│                                     │
│  Feature content (inline, fills)    │
│                                     │
└─────────────────────────────────────┘
```

No `m-2/m-4 rounded-xl bg-surface shadow` wrapper. The dashboard is flush to the viewport edges.

---

## 5. Elevation & Depth

**No shadows anywhere.**

Project conventions prohibit `shadow-sm`, `shadow-md`, or any box-shadow on surfaces. Hierarchy is built with **flat layers**:

| Layer | Treatment |
|---|---|
| **Layer 0 — Page background** | `bg-slate-50` |
| **Layer 1 — Cards / Panels** | Pure white `bg-white`. Hairline `1px` border in `border-slate-200`. |
| **Layer 2 — Modals / Overlays** | Backdrop: `bg-black/70 backdrop-blur-sm`. No shadow — the blur + opacity provides sufficient depth. |

No App-in-Card diffusion shadow. No card drop shadows. Borders + backdrop blur are the only elevation mechanisms.

---

## 6. Shapes (Border Radius)

Distinctly rounded — approachable, physically "soft".

| Token | Value | Use |
|---|---|---|
| `rounded-sm` | 0.25 rem | Inline badges |
| `rounded` (default) | 0.5 rem | Buttons, inputs, small cards |
| `rounded-md` | 0.75 rem | Standard elements |
| `rounded-lg` | 1 rem | Major workspace cards |
| `rounded-xl` | 1.5 rem | Primary containers |
| `rounded-full` | 9999 px | Pill chips, drag handles, nav indicators |
| **Modal top** | 1.75 rem (28 px) | Mimics native mobile OS drawer |

---

## 7. Components

### 7.1 Buttons

| Variant | Spec | PrimeNG |
|---|---|---|
| **Primary** | Min 48 px tall, solid Gold (`primary`), white text, `rounded-md`. Gold bg must use `text-slate-900` for WCAG AA (10.32:1 ratio). | `<p-button severity="primary">` |
| **Secondary / Ghost** | Thin border, clear icon. On mobile → icon-only circle (40 px). | `<p-button severity="secondary">` |
| **Destructive** | Solid `--p-error-*`. | `<p-button severity="danger">` |

Touch target **never below 44 px**. Icons + label always paired on primary actions.

### 7.2 Cards

**Product Card** — clean border, white bg, `body-bold` title, secondary gray metadata. `rounded-lg`. Tappable area ≥ 44 px.

**Table Card (grid)** — square-ish, `rounded-md`. **Selected state** = `2px` Primary Gold border + `--p-highlight-bg` tint.

Cards have **no shadow**. Use `border border-slate-200 bg-white rounded-lg`.

### 7.3 Modals (Dialog / Drawer)

Single point of entry for product options and confirmations. No bottom sheet — just modals.

- Modal background: `bg-white rounded-xl`.
- Backdrop: `bg-black/70 backdrop-blur-sm`.
- No `shadow-2xl` — the backdrop blur is sufficient depth cue.
- Top rounding: 28 px for drawer-style modals.

PrimeNG: `<p-dialog>` or `<p-drawer>` with custom backdrop styling.

### 7.4 Form Inputs

- **Search & Special Instructions**: `padding: 16px`. Background = `bg-slate-100` (light neutral fill, NOT white) to differentiate from the card surface.
- **Counter Controls**: circular `−` / `+` buttons flanking a central digit (quantity stepper).

PrimeNG: `<p-inputtext>` for text, `<p-inputnumber>` with `buttonLayout="horizontal"` for counters.

### 7.5 Navigation — Dashboard Tab Bar

The waiter dashboard at `/worker` hosts a horizontal inline navigation bar that switches between 3 feature views. This replaces any router-based sub-navigation.

**Structure:**

```html
<nav class="flex items-center gap-1 px-4 py-2 bg-white border-b border-surface-200">
  @for (tab of tabs; track tab.id) {
    <button
      (click)="setTab(tab.id)"
      class="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors cursor-pointer text-sm whitespace-nowrap"
      [class]="activeTab() === tab.id
        ? 'text-primary-500 font-semibold'
        : 'text-surface-700 hover:bg-surface-100'">
      <i [class]="tab.icon + ' text-sm'"></i>
      <span>{{ tab.label }}</span>
    </button>
  }
</nav>
```

**Tab definitions:**

| id | Icon | Label |
|---|---|---|
| `menu` | `pi pi-sun` | Menú del Día |
| `carta` | `pi pi-book` | Carta |
| `pedidos` | `pi pi-list` | Pedidos |

**Behavior:**
- Inactive tab: `text-surface-700`, hover state `hover:bg-surface-100`.
- Active tab: `text-primary-500 font-semibold` (gold text + semibold).
- Click sets `activeTab.set(id)` via a signal.
- Content renders via `@if` / `@else if` blocks in the dashboard template.
- No router involvement — single component at `/worker`.

**Feature components** (`<app-day-menu>`, `<app-take-order>`, `<app-today-orders>`) are standalone: they render directly inside the `@if` blocks without any shell wrapper or extra header. They expect no App-in-Card container.

### 7.6 Status Badges

Use the functional palette strictly:

| Status | Color | Spanish label |
|---|---|---|
| Pendiente / En Cola | warn amber | "EN COLA" |
| En Preparación | info blue | "PREPARANDO" |
| Listo en Pass | **success emerald** | "LISTO" |
| Cancelado / Anulado | error red | "ANULADO" |

Always render as `<p-tag>` with `severity` + `rounded` + uppercase `label-caps` typography.

---

## 8. Reference Screens

The waiter design is no longer represented by Stitch-generated screens. The current implementation uses:

**8.1 Waiter Dashboard (`/worker`)**

The primary screen — hosts the full waiter experience in a single view:

```
┌─────────────────────────────────────────┐
│  <app-header>  brand · user             │
├─────────────────────────────────────────┤
│  ☀ Menú del Día  │ 📖 Carta  │ 📋 Pedidos│
├─────────────────────────────────────────┤
│                                         │
│  Active feature content renders here    │
│                                         │
│  (DayMenu / TakeOrder / TodayOrders)    │
│                                         │
└─────────────────────────────────────────┘
```

- No bottom navigation, no separate routes.
- 3 tabs correspond to the 3 feature components.
- Each feature fills the available height below the nav bar.
- Feature components are standalone: no shell, no extra container.

**8.2 Feature Components**

Each feature component (`<app-day-menu>`, `<app-take-order>`, `<app-today-orders>`) renders its complete interface — search, grid, cards, filters, status badges — without an outer wrapper. The dashboard's `bg-white` nav bar and `bg-slate-50` content area provide the base surface hierarchy.

---

## 9. PrimeNG + Tailwind v4 Mapping Cheat Sheet

> Run the **Aura preset** already extended in `src/app/app.config.ts` (`arosPreset` from `definePreset(Aura, ...)`). Add surface + semantic colors via Tailwind v4 `@theme {}` block in `src/styles.css`. Tokens map directly:

| Design token | PrimeNG CSS variable | Tailwind utility (via `tailwindcss-primeui`) |
|---|---|---|
| `primary` | `--p-primary-color` | `bg-primary`, `text-primary`, `border-primary` |
| `primary-container` | `--p-highlight-bg` | `bg-highlight` |
| `on-surface` | `--p-text-color` | `text-surface-900` (light) / `text-surface-0` (dark) |
| `surface` | `--p-content-background` | `bg-surface-0` (white) / `bg-surface-900` (dark) |
| `surface-container` | `--p-content-border-color` | `border-surface-200` |
| `outline-variant` | `--p-content-color` (secondary text) | `text-surface-500` |
| `tertiary` (success) | `--p-green-500` family | `bg-green-500`, `text-green-500` |
| `error` | `--p-red-500` family | `bg-red-500`, `text-red-500` |
| `secondary` (info) | `--p-blue-500` family | `bg-blue-500`, `text-blue-500` |
| `warn` (pending) | `--p-yellow-500` family | `bg-yellow-500`, `text-yellow-500` |
| Spacing `md` (16 px) | — | `m-4` / `p-4` |
| `rounded-md` (12 px) | — | `rounded-md` |
| `rounded-xl` (24 px) | — | `rounded-xl` |
| Font Archivo | `--font-sans: 'Archivo', sans-serif` (already in `@theme {}`) | `font-sans` (default body) |

### 9.1 Tokens to add to `@theme {}` in `src/styles.css`

```css
@theme {
  /* Surface slate family (enterprise) */
  --color-slate-50: #f8fafc;
  --color-slate-100: #f1f5f9;
  --color-slate-200: #e2e8f0;
  --color-slate-300: #cbd5e1;
  --color-slate-400: #94a3b8;
  --color-slate-500: #64748b;
  --color-slate-600: #475569;
  --color-slate-700: #334155;
  --color-slate-800: #1e293b;
  --color-slate-900: #0f172a;
  --color-slate-950: #020617;

  /* Outline family (slate-based) */
  --color-outline: #475569;        /* slate-600 */
  --color-outline-variant: #cbd5e1; /* slate-300 */

  /* Spacing (8 px base) */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;
  --spacing-touch: 44px;

  /* Extended radius */
  --radius-card: 1rem;        /* 16 px — major workspace cards */
  --radius-container: 1.5rem; /* 24 px — primary containers */
  --radius-modal-top: 1.75rem; /* 28 px — modal top edge */
}
```

These produce the Tailwind utilities `bg-slate-50…950`, `text-outline`, `p-touch` (44 px), `rounded-card`, `rounded-container`, etc.

### 9.2 Aura preset semantic extension (in `src/environments/theme.ts`)

```ts
export const theme = {
  primary: { /* already gold #F9BB0B family */ },
  semantic: {
    info: { 500: '#3b82f6' },     // secondary container blue
    success: { 500: '#10b981' },  // tertiary emerald
    warn: { 500: '#f59e0b' },     // pending amber
    surface: {
      0: '#ffffff',
      50: '#f8fafc',              // page background slate
      100: '#f1f5f9',
      200: '#e2e8f0',
      300: '#cbd5e1',
      400: '#94a3b8',
      500: '#64748b',
    }
  }
};
```

Then in `app.config.ts`, wire `arosPreset` with these new semantic slots so PrimeNG auto-emits the corresponding CSS variables.

---

## 10. Implementation Rules (must follow)

1. **Mobile-first.** Every waiter component is designed for 390 × 884 then expanded upward.
2. **Touch targets ≥ 44 px.** No exceptions.
3. **No hardcoded hex.** Use semantic tokens (`bg-surface`, `text-primary`, `bg-primary`, etc.). Tailwind theme extends with the color map above.
4. **Status badges = strict color discipline.** Never use primary gold for state — use the functional palette.
5. **No shadows anywhere.** Flat surfaces with `border` + `backdrop-blur` for elevation hierarchy. No `shadow-sm`, `shadow-md`, `shadow-2xl`, or custom box-shadow.
6. **Spanish strings only.** Labels, buttons, toasts, modals — all in Spanish. Class names, files, comments — English.
7. **Skeleton on every load.** Use `<p-skeleton>` shaped exactly like the loaded content (per `conventions.md` § 12).
8. **Nav bar uses `flex items-center gap-1`**, tabs are `px-3 py-2 rounded-lg` matching header nav style (`header.html:23-34`). Active tab = gold text `text-primary-500 font-semibold`, inactive = `text-surface-700 hover:bg-surface-100`.
9. **Feature components are standalone.** They render directly inside the dashboard's `@if` blocks without shell wrapper, extra header, or App-in-Card container.
10. **Selected table / selected item uses the "thickness" cue** (2 px gold border + amber tint), not just color.
11. **Animations are subtle.** Slide-and-fade, 200 ms, non-distracting. No bounce, no scale tricks.
12. **Gold `#F9BB0B` on backgrounds uses `text-slate-900`** (not white) for WCAG AA compliance (10.32:1 contrast ratio).

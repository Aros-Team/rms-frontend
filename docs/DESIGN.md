# Design Tokens & Style Rules

> Token palette, shadow/contrast rules, and validation checklist.
> Source of truth for all styling decisions.

---

## 1. Color Tokens

| Token | Value | Usage |
|---|---|---|
| `primary` | Gold `#F9BB0B` | Brand, active CTAs, selected states |
| `semantic.info` | Blue `#3b82f6` | Secondary container, "Preparing" status |
| `semantic.success` | Emerald `#10b981` | Tertiary container, "Ready" status |
| `semantic.warn` | Amber `#f59e0b` | Pending, "In Queue" status |
| `surface` | Slate family | Enterprise sober tone — page bg, cards, borders |

All tokens defined in `src/environments/theme.ts`. Tailwind `@theme` block in `src/styles.css`.

### Surface Token Map

| Token | Slate equivalent | Role |
|---|---|---|
| `surface-0` / `bg-primary-contrast` | `#ffffff` | Card/content surface (light mode) |
| `surface-50` | `#f8fafc` | Page background |
| `surface-100` | `#f1f5f9` | Header panels, secondary surfaces |
| `surface-200` | `#e2e8f0` | Hairline borders |
| `surface-300` | `#cbd5e1` | Input borders |
| `surface-400` | `#94a3b8` | Muted text, placeholders |
| `surface-500` | `#64748b` | Secondary text |
| `surface-600` | `#475569` | Body text (dark mode) |
| `surface-700` | `#334155` | Borders (dark mode) |
| `surface-800` | `#1e293b` | Card surface (dark mode) |
| `surface-900` | `#0f172a` | Primary text (light mode) |

---

## 2. Surface Layering

Use `bg-primary-contrast` (not `bg-surface-0`, not `bg-white`) for content surfaces.

| Layer | Light | Dark |
|---|---|---|
| Page background | `bg-surface-50` | `dark:bg-surface-900` |
| Header panels | `bg-surface-100` | `dark:bg-surface-800` |
| Content surfaces | `bg-primary-contrast` | `dark:bg-surface-800` |
| Input backgrounds | `bg-transparent` | `dark:bg-surface-700` |

---

## 3. Shadows — FORBIDDEN

**No shadows anywhere.** This includes:

- `shadow-sm`, `shadow-md`, `shadow-lg`, `shadow-xl`, `shadow-xs`
- Any `box-shadow` in CSS
- Glow effects using `box-shadow`

### Replace with

Use **borders** for visual separation instead:
- `border border-surface-200 dark:border-surface-700`

**Exceptions:**
- High-contrast mode in `src/styles.css` (accessibility override)
- Scrollbar thumb colors (`rgba(0, 0, 0, 0.2)` etc. — system-level, not content shadows)

---

## 4. Black / Absolute Black — FORBIDDEN

**Do not use** `#000`, `#000000`, `black`, `rgb(0,0,0)` for text or backgrounds.

### Use instead

| Intent | Token |
|---|---|
| Primary text (light) | `text-surface-900` |
| Primary text (dark) | `dark:text-surface-0` |
| Secondary text | `text-surface-500` / `dark:text-surface-400` |
| Headings | `text-surface-800 dark:text-surface-100` |

**Exceptions:**
- High-contrast mode in `src/styles.css` (accessibility override)

---

## 5. Icons

- Use PrimeIcons (`pi pi-*`) only
- No custom SVG icons
- Icon color inherits from parent text color

---

## 6. PrimeNG Component Priority

1. Prefer PrimeNG components for all interactive elements
2. Use PrimeNG attributes (`label`, `icon`, `severity`) over custom wrappers
3. Do not override PrimeNG internal styles unless absolutely necessary
4. Component borders, backgrounds use design tokens via PrimeNG theme

---

## 7. Style Modification Checklist

Before adding or modifying any style:

- [ ] Does it use a design token? (No raw hex/rgb values)
- [ ] Does it avoid `box-shadow` and `shadow-*` classes?
- [ ] Does it avoid `#000` / `black` / `rgb(0,0,0)`?
- [ ] Does it use `bg-primary-contrast` instead of `bg-white` or `bg-surface-0`?
- [ ] Does it use PrimeNG components where applicable?
- [ ] Does the pattern match existing conventions in `docs/conventions.md`?

---

## 8. Validation

The harness (`scripts/harness.js`) validates new components and style additions against this file.
Run `node scripts/harness.js` before declaring any styling task complete.

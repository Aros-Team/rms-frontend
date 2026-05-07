# Conventions

> Style rules, naming, and structure. Follow exactly.

---

## 1. File Naming (kebab-case everywhere)

| Element | File Name | Example |
|---------|-----------|---------|
| Component | `feature-name.ts` | `login-form.ts` |
| Service | `feature-name.ts` | `auth.ts` |
| Guard | `feature-name.ts` | `auth.ts` (guard suffix allowed) |
| Model/DTO | `dto-name.ts` | `user-response.ts` |
| Component folder | `feature-name/` | `login-form/` |

**No `*.component.ts`, `*.service.ts`, `*.model.ts` suffixes in file names.**

---

## 2. Class Naming (PascalCase)

```typescript
// Good
export class LoginForm { }
export class Auth { }
export class Areas { }

// Bad
export class LoginFormComponent { }
export class AuthService { }
export class AreasManager { }
```

---

## 3. Component Decorator

```typescript
@Component({
  selector: 'app-login-form',
  templateUrl: './login-form.html',
  styleUrl: './login-form.css',
})
export class LoginForm { }
```

**Always use `templateUrl` + `styleUrl`. No inline `template` or `styles`.**

---

## 4. Template Rules

- Use **PrimeNG components** as first option
- Use **design tokens** for colors, spacing, typography
- **No hardcoded custom CSS values** (colors, sizes, etc.)
- Class names in templates: **English only**
- User-facing text (labels, messages, buttons): **Spanish**

```html
<!-- Good -->
<p-button label="Iniciar sesión" icon="pi pi-sign-in"></p-button>
<span class="text-surface-500">Precio</span>

<!-- Bad -->
<button class="my-custom-red-button">Click</button>
```

---

## 5. Style Rules

- **Only design tokens** (`--primary-color`, `--surface-500`, etc.)
- **No hardcoded custom styles** outside design system
- **PrimeNG component styling** via built-in classes and tokens
- If custom styles needed: use CSS custom properties referencing tokens

### 5.1 Surface Layering (Dashboard Pattern)

Elements should NOT feel flat. Use different surface tones to create visual depth and avoid monotony.

**Background hierarchy:**

| Level | Usage | Light mode | Dark mode |
|---|---|---|---|
| **Header panels** | Stats, date/time, quick info sections | `bg-surface-100` | `dark:bg-surface-800` |
| **Primary content** | Main tables, data panels, card sections | `bg-primary-contrast` | `dark:bg-surface-800` |
| **Nested cards** | Items inside panels, detail blocks | `bg-surface-50` | `dark:bg-surface-800` |
| **Borders** | All containers | `border-surface-200` | `dark:border-surface-700` |
| **Rounding** | Outer containers | `rounded-xl` or `rounded-2xl` | same |

**Page module template (header + table):**
```html
<div class="flex flex-col p-4 md:p-6 min-w-0 min-h-0">
  <!-- Title area (no container, just spacing) -->
  <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
    <div>
      <h1 class="text-xl md:text-2xl font-bold text-surface-900 dark:text-surface-0">Título</h1>
      <p class="text-surface-600 dark:text-surface-400 mt-1 text-sm">Descripción</p>
    </div>
  </div>

  <!-- Content container: white in light, surface-800 in dark -->
  <div class="flex-1 min-h-0 border border-surface-200 dark:border-surface-700 rounded-xl bg-primary-contrast overflow-hidden">
    <!-- Table or content here -->
  </div>
</div>
```

**Dashboard-style info panel (stats, date, etc.):**
```html
<!-- Slightly off-white header to stand out from white content -->
<header class="border border-surface-200 dark:border-surface-700 rounded-xl bg-surface-100 dark:bg-surface-800 overflow-hidden">
  <!-- Stats, info content -->
</header>

<!-- White content area for contrast -->
<section class="border border-surface-200 dark:border-surface-700 rounded-xl bg-primary-contrast overflow-hidden">
  <!-- Tables, lists -->
</section>
```

**DO NOT use:**
- `shadow-sm` or any box-shadow (no shadows anywhere)
- `bg-surface-0` — use `bg-primary-contrast` instead
- Plain containers without borders (they feel floating/disconnected)

---

## 6. Service Naming

One file per domain, class name matches file name:

```
core/services/
├── auth.ts           class Auth
├── order.ts          class Order
├── product.ts        class Product
```

---

## 7. Variable Naming (camelCase)

```typescript
// Good
const userData = this.auth.getData();
const isLoading = signal(false);

// Bad
const UserData = this.auth.getData();
const IsLoading = signal(false);
```

---

## 8. Signal Usage

```typescript
// Local state
const count = signal(0);

// Computed
const doubled = computed(() => count() * 2);

// In template
@if (doubled() > 0) {
  <span>{{ doubled() }}</span>
}
```

---

## 9. Imports

- Use **path aliases** from `tsconfig.json` (`@core/`, `@shared/`, `@features/`)
- Avoid relative imports crossing module boundaries
- Group imports: Angular → PrimeNG → custom → alphabetical

---

## 10. User-Facing Text

- **Spanish** for all user-visible strings (labels, buttons, messages, toasts)
- **English** for class names, variables, properties, file names, comments

```typescript
this.messageService.add({
  severity: 'error',
  summary: 'Error de autenticación',
  detail: 'Credenciales incorrectas.',
});
```

---

## 11. What is NOT Allowed

- Single `.ts` files combining template + styles inline
- Hardcoded custom CSS colors, fonts, sizes
- `console.log()` for debugging
- TODOs without context
- `print()` statements
- `Component`/`Service`/`Manager` suffixes in class names
- Inline styles (`style=""`) except for dynamic token-based values

---

## 12. Skeleton Components

Skeleton loaders display while data is loading. Every interface that fetches from an API should use skeletons during loading state.

### 12.1 When to Use Skeletons

- Any component that loads data from an API on init or via service call
- Lists, tables, stats panels, detail views
- Use `@if (isLoading()) { <app-xxx-skeleton /> }` pattern

### 12.2 Skeleton Architecture

```
shared/skeletons/          # Reusable across features
├── table-skeleton.ts      # Generic table rows
└── value-skeleton.ts      # Single value placeholder

features/*/skeletons/      # Feature-specific skeletons
└── feature-skeleton.ts    # Matches exact layout of feature
```

### 12.3 Skeleton Naming

| Skeleton | Selector | File |
|----------|----------|------|
| Stats | `app-stats-skeleton` | `stats-skeleton.ts` |
| Orders List | `app-orders-list-skeleton` | `orders-list-skeleton.ts` |
| Day Menu | `app-daymenu-skeleton` | `daymenu-skeleton.ts` |

### 12.4 Responsive Variants

Feature-specific skeletons must support `variant` input:

```typescript
variant = input<'mobile' | 'tablet' | 'desktop'>('desktop');
```

- **mobile** — Card-based layouts, touch-friendly sizing
- **tablet** — Intermediate sizing, side-by-side when needed
- **desktop** — Full density, table-friendly sizing

### 12.5 Template Usage

```html
@if (isLoading()) {
  <app-stats-skeleton variant="mobile" />
} @else {
  <!-- real content -->
}
```

### 12.6 Skeleton Design Rules

- Use `p-skeleton` from PrimeNG
- Match exact dimensions of real content (width, height)
- Use `borderRadius` for badges/tags
- Use `shape="circle"` for avatars
- Keep skeletons visually similar to loaded content

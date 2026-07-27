# Conventions

> Style rules, naming, and structure. Follow exactly.

---

## 1. File Naming (kebab-case everywhere)

### 1.1 Todo archivo dentro de una carpeta

**No existen archivos sueltos.** Cada archivo `.ts` debe estar dentro de su propia carpeta:

```
✅ Correcto:
services/products/get-all.ts
services/products/create.ts
components/login-form/login-form.ts

❌ Incorrecto:
services/product-image.ts          # Suelto, sin carpeta
services/products/product.ts       # Correcto en carpeta pero nombre genérico
```

### 1.2 Naming por tipo

| Element | Folder | File Name | Example |
|---------|--------|-----------|---------|
| Component | `nombre/` | `nombre.ts` | `login-form/login-form.ts` |
| Service (use case) | `entidad/` | `verbo-entidad.ts` | `products/get-all.ts`, `products/create.ts` |
| Guard | `nombre/` | `nombre.ts` | `auth/auth.ts` (guard suffix allowed) |
| Model/DTO | `nombre/` | `nombre.ts` | `orders/order-response.ts` |
| Pipe | `nombre/` | `nombre.ts` | `money/money.ts` |
| Skeleton | `nombre/` | `nombre.ts` | `table-skeleton/table-skeleton.ts` |

### 1.3 Sufijos prohibidos

**No usar** `*.component.ts`, `*.service.ts`, `*.model.ts` en nombres de archivo.

### 1.4 Servicios: nombrar por caso de uso

Los archivos de servicio **declaran en su nombre qué hacen**, usando el patrón `verbo-que-hace`:

```
services/products/
├── get-all.ts          # class GetAll  — obtener todos los productos
├── get-by-id.ts        # class GetById — obtener un producto por ID
├── create.ts           # class Create  — crear un producto
├── update.ts           # class Update  — actualizar un producto
├── delete.ts           # class Delete  — eliminar un producto
└── upload-image.ts     # class UploadImage — subir imagen de producto
```

Cada archivo contiene **una sola clase** que hace **una sola cosa**.

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

## 6. Service Naming (Use-Case Pattern)

### 6.1 Principio

Los servicios se agrupan por **entidad** (carpeta) y se nombran por **caso de uso** (archivo). Cada servicio hace **una sola cosa**.

```
core/services/
├── products/              # Entidad: productos
│   ├── get-all.ts         #   class GetAll     — listar productos
│   ├── get-by-id.ts       #   class GetById    — obtener uno
│   ├── create.ts          #   class Create     — crear producto
│   ├── update.ts          #   class Update     — actualizar producto
│   ├── delete.ts          #   class Delete     — eliminar producto
│   └── upload-image.ts    #   class UploadImage— subir imagen
├── orders/                # Entidad: órdenes
│   ├── get-all.ts         #   class GetAll     — listar órdenes
│   ├── get-by-id.ts       #   class GetById    — obtener una
│   ├── create.ts          #   class Create     — crear orden
│   └── update-status.ts   #   class UpdateStatus— cambiar estado
├── auth/                  # Entidad: autenticación
│   ├── login.ts           #   class Login      — iniciar sesión
│   ├── logout.ts          #   class Logout     — cerrar sesión
│   ├── change-password.ts #   class ChangePassword— cambiar contraseña
│   └── verify-2fa.ts      #   class Verify2fa  — verificar 2FA
└── inventory/
    ├── get-all.ts         #   class GetAll     — listar inventario
    └── adjust-stock.ts    #   class AdjustStock— ajustar stock
```

### 6.2 Convención de nombres

| Parte | Regla | Ejemplo |
|-------|-------|---------|
| Carpeta | Nombre de la entidad en plural o singular (`products/`, `auth/`) | `products/` |
| Archivo | `verbo-[que-hace].ts` en kebab-case | `get-all.ts`, `upload-image.ts` |
| Clase | PascalCase del archivo | `GetAll`, `UploadImage` |

### 6.3 Reglas

- **Un archivo = una clase = una responsabilidad**
- **No mezclar** queries (lectura) con commands (escritura) en el mismo archivo
- Si un caso de uso crece demasiado, se divide en más archivos (nunca se fusionan)
- Los servicios que son solo cache (`*-cache`) se consideran un caso de uso aparte y van en su propio archivo (ej. `get-cached.ts`)

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

## 12. Reutilización antes de implementar

> **Regla de oro: antes de crear cualquier componente, verifica si ya existe.**

### 12.1 Paso obligatorio antes de implementar

Siempre que necesites crear un componente, directiva, pipe o servicio:

1. **Busca en `shared/`** — Revisa `shared/components/`, `shared/pipes/`, `shared/lib/` para ver si lo que necesitas ya existe.
2. **Busca en otras features** — Un componente similar puede estar en otra área o feature y ser reusable.
3. **Si existe pero no es exacto** — Evalúa extraerlo a `shared/` con `Input()`/`Output()` para hacerlo genérico, en lugar de duplicarlo.
4. **Si podría servir a otra área** — Crea el componente en `shared/`, no dentro de una feature específica.

### 12.2 Criterios para decidir

| Pregunta | Decisión |
|----------|----------|
| ¿Es específico de una sola vista? | Queda en la feature |
| ¿Podría usarlo otra feature o área? | Va a `shared/components/` o `shared/lib/` |
| ¿Ya existe algo similar? | Extiéndelo, no lo dupliques |
| ¿Es un patrón visual/técnico genérico? | Crea componente genérico en `shared/` |

### 12.3 Shared directory map

```
shared/
├── components/          # Componentes reutilizables (13 actuales)
│   ├── current-date/
│   ├── dark-mode-button/
│   ├── datepicker/
│   ├── form/
│   ├── header/
│   ├── logo/
│   ├── order-detail-dialog/
│   ├── order-dock/
│   ├── product-card/
│   ├── product-options-modal/
│   ├── restricted-banner/
│   ├── sidebar/
│   └── waiter-status-badge/
├── pipes/               # Pipes reutilizables
│   ├── money/
│   │   ├── money.ts
│   │   └── money.spec.ts
│   ├── metric-value/
│   │   ├── metric-value.ts
│   │   └── metric-value.spec.ts
│   ├── option-names/
│   │   └── option-names.pipe.ts
│   └── table-number/
│       └── table-number.pipe.ts
├── lib/                 # Utilidades puras
│   └── http-error-mapper.ts
├── features/            # Features compartidas (con estado o lógica propia)
│   ├── habeas-data/
│   ├── orders/
│   └── settings/
├── skeletons/           # Skeleton loaders genéricos
├── layout/              # Layouts reutilizables
└── models/              # DTOs y modelos compartidos
```

---

## 13. Skeleton Components

Skeleton loaders display while data is loading. Every interface that fetches from an API should use skeletons during loading state.

### 13.1 When to Use Skeletons

- Any component that loads data from an API on init or via service call
- Lists, tables, stats panels, detail views
- Use `@if (isLoading()) { <app-xxx-skeleton /> }` pattern

### 13.2 Skeleton Architecture

```
shared/skeletons/          # Reusable across features
├── table-skeleton.ts      # Generic table rows
└── value-skeleton.ts      # Single value placeholder

features/*/skeletons/      # Feature-specific skeletons
└── feature-skeleton.ts    # Matches exact layout of feature
```

### 13.3 Skeleton Naming

| Skeleton | Selector | File |
|----------|----------|------|
| Stats | `app-stats-skeleton` | `stats-skeleton.ts` |
| Orders List | `app-orders-list-skeleton` | `orders-list-skeleton.ts` |
| Day Menu | `app-daymenu-skeleton` | `daymenu-skeleton.ts` |

### 13.4 Responsive Variants

Feature-specific skeletons must support `variant` input:

```typescript
variant = input<'mobile' | 'tablet' | 'desktop'>('desktop');
```

- **mobile** — Card-based layouts, touch-friendly sizing
- **tablet** — Intermediate sizing, side-by-side when needed
- **desktop** — Full density, table-friendly sizing

### 13.5 Template Usage

```html
@if (isLoading()) {
  <app-stats-skeleton variant="mobile" />
} @else {
  <!-- real content -->
}
```

### 13.6 Skeleton Design Rules

- Use `p-skeleton` from PrimeNG
- Match exact dimensions of real content (width, height)
- Use `borderRadius` for badges/tags
- Use `shape="circle"` for avatars
- Keep skeletons visually similar to loaded content

# Architecture

> What "good work" means in this project.

---

## 1. Overall Structure

```
src/
├── environments/            # Angular environment files + theme tokens
├── app/
│   ├── core/                # Singleton services, guards, interceptors, cache
│   ├── shared/              # Reusable components, models/DTOs, pipes, layouts
│   └── areas/               # Layout shells grouped by view type
│       ├── auth/            #   Authentication & account setup
│       │   └── features/    #     login, password-recovery, setup-account, two-factor
│       ├── admin/           #   Admin dashboard & management
│       │   └── features/    #     dashboard, manage, analytics, orders, chat, …
│       └── worker/          #   Worker views (waiter, kitchen, etc.)
│           └── features/    #     waiter, kitchen, my-schedule
└── index.html, styles.css, …
```

---

## 2. Areas

Areas are **layout shells** that define the chrome (header, sidebar, footer) for a group of related views.

Each area:
- Has a **shell component** with `<router-outlet>` for its child features
- Is **lazy-loaded** via `loadComponent` from the root routes
- Handles **role-based access** via guards

| Area | Route Prefix(es) | Guards | Description |
|------|-----------------|--------|-------------|
| `auth` | `/login`, `/forgot-password`, `/reset-password`, `/login/verify`, `/setup-account` | `RedirectGuard` | Public pages: login, password recovery, 2FA, account setup |
| `admin` | `/admin/*` | `AuthGuard` + `RoleGuard` (ADMIN) | Management dashboard, orders, restaurant config, analytics |
| `worker` | `/worker/*` | `AuthGuard` + `RoleGuard` (WORKER) + `AreaGuard` per child | Waiter order-taking, kitchen view, personal schedule |

---

## 3. Features

Features are **lazy-loaded modules** that implement a single, specific responsibility.

### 3.1 Single Responsibility Principle

Every feature must do **one thing only**. Examples:

| Feature | Responsibility |
|---------|---------------|
| `login` | Authenticate the user |
| `dashboard` | Show restaurant overview KPIs |
| `products` | CRUD the product catalogue |
| `orders` | List and manage today's orders |
| `kitchen` | Display the kitchen order queue |

If a feature needs to do more than one thing, it becomes a **composite feature** (see §3.3).

### 3.2 Simple Feature Structure

A simple feature is one component (or a component with helpers):

```
areas/<area>/features/feature-name/
├── feature-name.ts        # Lazy-loaded component
├── feature-name.html
├── feature-name.css
├── component-a/           # Optional helpers scoped to this feature
│   ├── component-a.ts
│   ├── component-a.html
│   └── component-a.css
└── models/
    ├── dto-request.ts
    └── dto-response.ts
```

### 3.3 Composite Features (Features with Sub-Features)

When a view must handle multiple distinct responsibilities (e.g. "Manage restaurant" needs products, categories, tables, inventory, etc.), the feature becomes a **shell** with a `<router-outlet>` and its own `features/` sub-folder:

```
areas/<area>/features/parent-feature/
├── parent-feature.ts       # Shell component with <router-outlet>
├── parent-feature.html
├── parent-feature.css
└── features/
    ├── entity-a/
    │   ├── entity-a.ts
    │   ├── entity-a.html
    │   └── entity-a.css
    ├── entity-b/
    │   ├── entity-b.ts
    │   ├── entity-b.html
    │   └── entity-b.css
    └── ...
```

Each sub-feature inside `features/` is also lazy-loaded and must follow the **single-responsibility rule**.

**Examples in the codebase:**

| Composite feature | Sub-features |
|------------------|--------------|
| `admin/features/manage` | `products`, `categories`, `tables`, `areas`, `combos`, `workers`, `inventory`, `schedules`, `time-logs`, `supplies` |
| `admin/features/analytics` | `prime-cost`, `menu-engineering`, `operations`, `cohort`, `alerts` |

Imports from other files use path aliases:
```typescript
import('@areas/admin/features/manage/features/products/products')
```

---

## 4. Core

Singletons registered at root level:

```
core/
├── services/          # Servicios agrupados por entidad (use-case pattern)
│   ├── products/      #   get-all.ts, create.ts, update.ts, delete.ts, …
│   ├── orders/        #   get-all.ts, create.ts, update-status.ts, …
│   ├── auth/          #   login.ts, logout.ts, change-password.ts, …
│   ├── inventory/     #   get-all.ts, adjust-stock.ts, …
│   └── …              #   (una carpeta por entidad)
├── cache/             # ResourceCache — base class para cache
│   └── resource-cache.ts
├── directives/        # Directivas standalone reutilizables
│   └── lazy-load.directive.ts
├── guards/            # Route guards (auth, role, area, redirect)
├── interceptors/       # HTTP interceptors (jwt, error)
└── models/            # Shared domain models (pocos, la mayoría en shared/)
```

---

## 5. Shared

Cross-cutting components used by multiple features:

```
shared/
├── components/        # Reusable UI components
├── models/            # Shared DTOs and domain models
└── pipes/             # Custom pipes
```

---

## 6. Routing Strategy

Areas and features are lazy-loaded via `loadComponent` from `src/app/app.routes.ts`.

```
/login{,/verify}         → auth area (RedirectGuard — redirects authenticated users away)
/forgot-password         → auth area (no guard)
/reset-password          → auth area (no guard)
/setup-account           → auth area (no guard)
/admin/*                 → admin area (AuthGuard + RoleGuard ADMIN)
  /admin                 → dashboard
  /admin/orders          → orders
  /admin/manage/*        → manage (shell with sub-features)
    /admin/manage/products
    /admin/manage/categories
    /admin/manage/tables
    /admin/manage/areas
    /admin/manage/combos
    /admin/manage/workers
    /admin/manage/inventory
    /admin/manage/orders-create
  /admin/analytics/*     → analytics (shell with sub-features)
    /admin/analytics/prime-cost
    /admin/analytics/menu-engineering
  /admin/create-product  → product-creation
  /admin/profile         → settings
/worker/*                → worker area (AuthGuard + RoleGuard WORKER + AreaGuard)
  /worker/waiter         → waiter-dashboard
  /worker/kitchen        → kitchen
  /worker/my-schedule    → my-schedule
  /worker/profile        → settings
```

**Guards:**

| Guard | Role |
|-------|------|
| `RedirectGuard` | Redirects authenticated users away from public pages |
| `AuthGuard` | Ensures user is authenticated |
| `RoleGuard` | Ensures user has required role (`ADMIN` / `WORKER`) |
| `AreaGuard` | Ensures worker has access to the specific area (waiter, kitchen, etc.) |

Backend returns `role: 'ADMIN' | 'WORKER'` and the user's `areas` array determines worker type (`service`, `waiter`, `kitchen`, etc.). Angular redirects to the appropriate area after login.

---

## 7. Component Structure

Each component uses **separate files** (no inline templates or styles):

```
component-name/
├── component-name.ts      # Class + decorator
├── component-name.html    # External template
└── component-name.css     # Component-scoped styles
```

---

## 8. State Management

- Use Angular **signals** for local component state
- Use **services with signals** for shared state
- No external state management library unless explicitly required

---

## 10. Data Loading Strategy (ResourceCache)

### 10.1 Overview

Use `ResourceCache<T>` for all data fetching to enable:
- **Lazy loading**: Data loads only when needed
- **Caching**: Avoid repeated API calls
- **Stale-while-revalidate**: Fresh data without blocking UI
- **Signals integration**: Reactive state management

### 10.2 Architecture

```
src/app/
├── core/
│   ├── cache/
│   │   └── resource-cache.ts       # Base cache class
│   └── directives/
│       └── lazy-load.directive.ts  # Viewport-triggered loading
└── areas/<area>/features/<feature-name>/
    └── <feature>-cache.ts          # Domain-specific cache service
```

### 10.3 ResourceCache API

```typescript
class ResourceCache<T> {
  // Signals (read-only)
  readonly data: Signal<T | null>
  readonly isLoading: Signal<boolean>
  readonly hasData: Signal<boolean>
  readonly error: Signal<Error | undefined>

  // Methods
  load(): void                    // Force fresh fetch
  loadIfStale(): void             // Load only if expired/empty
  refresh(): void                 // Reload with stale-while-revalidate
  invalidate(): void              // Mark as stale
  reset(): void                   // Clear all data
}
```

### 10.4 Cache Service Pattern

Create one cache service per domain:

```typescript
@Injectable({ providedIn: 'root' })
export class ProductCacheService {
  private readonly http = inject(HttpClient);

  // Different TTLs for different data types
  readonly products = new ResourceCache<Product[]>(
    () => this.http.get<Product[]>('/api/products'),
    { ttlMs: 2 * 60 * 1000 }  // 2 minutes
  );

  readonly categories = new ResourceCache<Category[]>(
    () => this.http.get<Category[]>('/api/categories'),
    { ttlMs: 30 * 60 * 1000 } // 30 minutes
  );

  readonly productDetail = (id: number) => {
    // Per-ID cache using Map
    if (!this.detailCaches.has(id)) {
      this.detailCaches.set(id, new ResourceCache(
        () => this.http.get<Product>(`/api/products/${id}`),
        { ttlMs: 5 * 60 * 1000 }
      ));
    }
    return this.detailCaches.get(id)!;
  }
}
```

### 10.5 Component Usage

**Template:**
```html
<!-- Lazy load when visible -->
<div [appLazyLoad]="cache.products" class="h-full">
  @if (cache.products.data(); as products) {
    <p-table [value]="products" />
  } @else {
    <p-skeleton height="400px" />
  }
</div>
```

**Component:**
```typescript
export class Products {
  readonly cache = inject(ProductCacheService);
  
  // Access data via computed signals
  products = computed(() => this.cache.products.data());
  isLoading = computed(() => this.cache.products.isLoading());
}
```

### 10.6 Lazy Loading Directive

The `appLazyLoad` directive triggers loading when element enters viewport:

```html
<!-- With default 200px margin (preloads before visible) -->
<div [appLazyLoad]="cache">
  <p-table [value]="cache.data()" />
</div>

<!-- Custom margin -->
<div [appLazyLoad]="cache" [appLazyLoadMargin]="'100px'">
```

### 10.7 Cache Invalidation

Invalidate caches on mutations:

```typescript
// After creating/updating/deleting
async onSave() {
  await this.http.post('/api/products', data).toPromise();
  this.cacheService.products.invalidate();
}

// WebSocket push invalidation
constructor() {
  this.ws.on('products:updated').subscribe(() => {
    this.cacheService.products.invalidate();
  });
}
```

### 10.8 Best Practices

1. **Separate critical vs reference data:**
   - Critical: Short TTL (1-2 min), loads immediately
   - Reference: Long TTL (30+ min), loads on demand

2. **Use computed signals for derived state:**
   ```typescript
   filteredProducts = computed(() => {
     const all = this.cache.products.data() ?? [];
     return all.filter(p => p.active);
   });
   ```

3. **Never expose ResourceCache directly to templates:**
   ```typescript
   // Bad: template accesses cache directly
   <p-table [value]="cache.products.data()" />

   // Good: use computed property
   products = computed(() => this.cache.products.data());
   <p-table [value]="products()" />
   ```

4. **Handle loading states:**
   ```typescript
   @if (cache.isLoading() && !cache.hasData()) {
     <p-skeleton />
   } @else {
     <p-table [value]="cache.data()" [loading]="cache.isLoading()" />
   }
   ```

5. **Use computed signals for derived state from cache:**
   ```typescript
   // Component with cache pattern (like products.ts or menu.ts)
   export class Feature {
     readonly cache = inject(CacheService);

     // Expose cache data as computed signals
     items = computed(() => this.cache.items.data() ?? []);
     isLoading = computed(() => this.cache.items.isLoading());

     // For computed derived values (filtering, searching)
     filteredItems = computed(() => {
       const all = this.items();
       const search = this.searchText().toLowerCase();
       if (!search) return all;
       return all.filter(item => item.name.toLowerCase().includes(search));
     });
   }
   ```

6. **Initialize cache in constructor, not ngOnInit:**
   ```typescript
   constructor() {
     // Initialize cache immediately in constructor
     this.cache.items.load();
     this.loadRelatedData();
   }
   ```

7. **Shared caches across components (Dashboard + Manage):**
   ```typescript
   // daymenu-cache.service.ts
   @Injectable({ providedIn: 'root' })
   export class DayMenuCacheService {
     readonly currentMenu = new ResourceCache<DayMenuResponse | null>(
       () => this.dayMenuService.getCurrentDayMenu(),
       { ttlMs: 2 * 60 * 1000, staleWhileRevalidate: true }
     );
   }

   // Both components use the SAME cache instance
   export class Dashboard {
     readonly cache = inject(DayMenuCacheService);
     dayMenu = computed(() => this.cache.currentMenu.data());
   }

   export class MenuManage {
     readonly cache = inject(DayMenuCacheService);
     dayMenu = computed(() => this.cache.currentMenu.data());

     assign() {
       // Update triggers cache invalidation for ALL consumers
       this.cache.currentMenu.refresh();
     }
   }
   ```

### 10.9 Paginated Queries — Obligatorio

> **Nunca** obtener todos los registros de una colección sin paginación.

#### Reglas

1. **Toda consulta GET a una lista debe incluir `size`** (page size).
2. **Page size por defecto: 50**. Excepciones justificadas hasta 500.
3. **Usar `HttpParams`** para construir parámetros de consulta.
4. **El backend siempre responde con `{ items: T[], total?: number, page?: number }`**.

```typescript
// ✅ Correcto: paginado explícito
private queryOrders(params: Record<string, string | number>): Observable<OrderResponse[]> {
  let httpParams = new HttpParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== '') {
      httpParams = httpParams.set(key, String(value));
    }
  }
  return this.http.get<{ items: OrderResponse[] }>('v1/orders', { params: httpParams })
    .pipe(map(page => page.items));
}

getOrders(): Observable<OrderResponse[]> {
  return this.queryOrders({ size: 50, sort: 'date,desc' });
}
```

#### Page size por tipo de dato

| Tipo | Size máximo | TTL sugerido |
|------|------------|--------------|
| Listas maestras (productos, categorías, áreas) | 200 | 30 min |
| Órdenes del día | 500 | 2 min |
| Historial de órdenes | 50 por página | No cache (consulta directa) |
| Empleados | 200 | 5 min |
| Inventario | 200 | 5 min |
| Analytics | Depende del periodo | 10 min |

### 10.10 Cache Policies

| Recurso | TTL | staleWhileRevalidate | Estrategia |
|---------|-----|---------------------|------------|
| Datos críticos (órdenes activas, mesas ocupadas) | 1-2 min | `true` | `load()` en constructor + `refresh()` post-mutación |
| Datos de referencia (productos, categorías) | 30 min | `true` | `loadIfStale()` con `appLazyLoad` |
| Datos analíticos | 10 min | `true` | `loadIfStale()` al entrar a la ruta |
| Catálogos pequeños (< 50 items) | 30 min | `true` | `load()` una vez, invalidar solo tras mutación |
| Sesión / usuario autenticado | Sesión | — | No cache (servicio singleton con señal) |

#### Invalidación obligatoria

Siempre que se cree, actualice o elimine un recurso:

```typescript
async onSave(): Promise<void> {
  await firstValueFrom(this.http.post('/api/products', data));
  this.cache.invalidate();   // ✅ Marca la entrada como stale
  // o
  this.cache.refresh();      // ✅ Recarga inmediata en background
}
```

### 10.11 Lazy Loading — Obligatorio

#### Reglas

1. **Toda feature es lazy-loaded** vía `loadComponent` en las rutas. No hay módulos eager fuera de `core/` y `shared/`.
2. **Datos pesados usan `appLazyLoad`** para cargar solo cuando el componente entra en el viewport.
3. **Skeletons siempre acompañan** a datos lazy-loaded.

#### Cuándo usar `appLazyLoad`

| Situación | Usar |
|-----------|------|
| Tabla debajo del fold | ✅ `[appLazyLoad]="cache"` |
| Stats panel visible al cargar | ✅ `loadIfStale()` en constructor (no necesita directiva) |
| Pestaña no visible inicialmente | ✅ `[appLazyLoad]="cache"` en el contenido de la pestaña |
| Diálogo modal | ✅ `loadIfStale()` al abrir el diálogo |

#### Patrón correcto

```html
<!-- Tabla lazy: carga solo cuando es visible -->
<div [appLazyLoad]="productCache.products" class="h-full">
  @if (productCache.products.data(); as products) {
    <p-table [value]="products" [loading]="productCache.products.isLoading()" />
  } @else {
    <p-skeleton height="400px" />
  }
</div>
```

```typescript
// Stats visibles: cargar inmediatamente
export class Dashboard {
  private cache = inject(DayMenuCacheService);

  constructor() {
    this.cache.currentMenu.load();  // ✅ Datos visibles arriba del fold
  }

  dayMenu = computed(() => this.cache.currentMenu.data());
}
```

---

## 9. Project Goals

Every decision must contribute to building:

> **"Robust, scalable frontend application that delivers an intuitive and accessible interface for restaurant operations management, enabling real-time data visualization and seamless user interactions."**

This means:
- **Robust**: Production-ready, error handling, edge cases covered
- **Scalable**: Modular architecture, lazy loading, maintainable code
- **Intuitive**: Clear UX, consistent patterns, PrimeNG components
- **Accessible**: WCAG compliance, keyboard navigation, screen reader support
- **Real-time**: WebSocket integration, live updates, reactive UI
- **Seamless**: Smooth transitions, optimistic UI, no friction workflows

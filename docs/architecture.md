# Architecture

> What "good work" means in this project.

---

## 1. Overall Structure

```
src/app/
├── core/                    # Singleton services, guards, interceptors
├── shared/                  # Reusable components, models, DTOs
├── areas/                   # Layout wrappers (shell components)
│   ├── admin-area/
│   ├── login-area/
│   ├── worker-kitchen/
│   └── worker-waiter/
└── features/                # Feature modules (lazy-loaded)
    ├── auth/
    ├── admin/
    ├── kitchen/
    ├── waiter/
    └── orders/
```

---

## 2. Areas

Areas are layout wrappers. Each area:
- Contains a routing module with `loadChildren` to its features
- Has a shell component with `<router-outlet>`
- Handles role-based access via guards

| Area | Route Prefix | Role Guard |
|------|-------------|------------|
| `login-area` | `/login` | None |
| `admin-area` | `/admin` | ADMIN |
| `worker-kitchen` | `/worker/kitchen` | KITCHEN |
| `worker-waiter` | `/worker/waiter` | WAITER |

---

## 3. Features

Features are lazy-loaded modules. Each feature folder contains:

```
feature-name/
├── feature-name.ts        # Routing module + component
├── component-a/
│   ├── component-a.ts
│   ├── component-a.html
│   └── component-a.css
├── component-b/
│   ├── component-b.ts
│   ├── component-b.html
│   └── component-b.css
└── models/
    ├── dto-request.ts
    └── dto-response.ts
```

---

## 4. Core

Singletons registered at root level:

```
core/
├── services/          # API services (one file per domain)
├── guards/            # Route guards (auth, role)
├── interceptors/       # HTTP interceptors (jwt, error)
└── models/            # Shared domain models
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

```
/login                    → login-area (no guard)
/admin/*                 → admin-area (ADMIN guard)
/worker/kitchen/*        → worker-kitchen-area (KITCHEN guard)
/worker/waiter/*         → worker-waiter-area (WAITER guard)
```

Backend returns `role: 'ADMIN' | 'KITCHEN' | 'WAITER'`. Angular redirects to the appropriate area after login.

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
└── features/
    └── feature-name/
        └── feature-cache.service.ts # Domain-specific cache service
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

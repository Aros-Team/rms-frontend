# Session History

> Append-only log of completed sessions/activities.

> **2026-07-14 note:** Older entries (lines 5-136 prior to today) were lost during a write/replace mishap; reconstructing best-effort from commit messages. Please fill in detail if needed.

## 2026-07-31 — search-input-component (feat, id 21)

Componente compartido `<app-search-input>` con debounce de 500ms que estandariza los buscadores de las páginas de manage. Es el primer entregable de la migración a búsqueda server-side (10 de los 11 endpoints de manage aún no soportan search en el backend; este componente deja lista la pieza de UI para que cuando el backend exponga el parámetro `search`, la conexión en cada módulo sea un cambio mecánico).

- `src/app/shared/components/search-input/search-input.ts` + `.html`: Inputs `placeholder` (default 'Buscar...') + `debounceMs` (default 500). Output `searchChange` (string). Internal `Subject<string>` pipeado `debounceTime` → `map(trim)` → `distinctUntilChanged` → `EventEmitter`. `takeUntilDestroyed(this.destroyRef)`. Visual: `p-iconfield` con `pi pi-search` + `p-inputtext` + botón limpiar condicional. Standalone, OnPush, sin estilos inline.
- `src/app/shared/components/search-input/search-input.spec.ts`: 5 tests (debounce, distinct, trim, clear, signal update) con TestHost pattern estilo `product-card.spec.ts`. `vi.useFakeTimers` correctamente cerrados en `afterEach`.
- `docs/server-side-search.md`: guía de migración — problema + comportamiento esperado + API del componente + contrato backend (search/name, parcial, case-insensitive, paginado, totalElements, índices DB) + tabla de estado de los 11 endpoints (1 listo, 10 pendientes) + plan de migración por módulo + checklist.
- Revisión (implementation-reviewer): APPROVED, 8/8 criterios con evidencia.
- Harness verde: lint OK, build OK, 541 tests (47 archivos). No commit.

## 2026-08-01 — migrate-server-side-search (feat, id 22)

Migración de los 10 módulos de manage del filtro client-side a búsqueda server-side. Todos los endpoints del backend ahora soportan `search`/`name`.

- **10 services** modificados: `product.ts`, `supply.ts`, `table.ts`, `worker.ts`, `area.ts`, `category.ts`, `option-category.ts`, `supplier.ts`, `purchase.ts`, `order.ts` — cada uno acepta `search?: string` y lo pasa como `HttpParams`.
- **6 caches** modificados: `product-cache.ts`, `inventory-cache.ts`, `tables-cache.ts`, `workers-cache.ts`, `categories-cache.ts` — cada uno propaga `search` al service y reinicia paginación a `page: 0` (donde aplica).
- **7 componentes** modificados: `products.ts`, `inventory.ts`, `tables.ts`, `workers.ts`, `areas.ts`, `categories.ts`, `orders-table.ts` — cada uno usa `<app-search-input>` y conecta `(searchChange)` al cache/service.
- **7 templates** modificados: inputs nativos reemplazados por `<app-search-input>` con placeholder contextual.
- **Eliminados**: `filteredProducts` computed (products), `filteredSupplies` computed (inventory), bloque de filtrado client-side por id/tableId/productName en `orders-table.ts` `applyFilters()`.
- **5 specs** actualizados/creados: `product-cache.spec.ts`, `inventory-cache.spec.ts`, `categories-cache.spec.ts`, `products.spec.ts`.
- `docs/server-side-search.md` actualizado: tabla de endpoints todos en "Listo".
- Revisión (implementation-reviewer): APPROVED, 11/11 criterios.
- Harness verde: lint OK, build OK, 551 tests (48 archivos). No commit.

## 2026-08-01 — improve-product-wizard-step1 (feat, id 23)

Rediseño del Paso 1 (Datos básicos) del wizard de crear/editar producto: layout 2 columnas con la zona de imagen (35%) a la izquierda y los campos (65%) a la derecha. La imagen ahora se gestiona desde el Paso 1 (ya no aparece duplicada en Paso 5). En modo create, el producto se auto-crea como borrador al entrar al Paso 1 para que la imagen tenga un `id` estable desde el inicio; en modo edit el producto ya existe. Al cancelar antes del Paso 5 en modo create, el borrador se hard-deletea para no dejar productos huérfanos.

### Cambios

**`products.ts`**

- Importa `Injector` y `EffectRef` desde `@angular/core`.
- Inyecta `Injector` (`private injector = inject(Injector)`).
- Nuevos signals `isCreatingDraft = signal(false)` (feedback visual) y `private draftEffectRef?: EffectRef` (effect autodestructible que espera el reference data).
- `showCreationModal()` ahora: tras los resets existentes, abre el modal, marca `isCreatingDraft=true` y llama a `tryCreateDraftProduct()`. Si las `categories()`/`areas()` están vacías (reference data aún cargando), registra un `effect` que reintenta cuando el signal `cache.referenceData.data()` actualice sus valores, y se autodestruye al crear el borrador.
- Nuevo `tryCreateDraftProduct(): boolean` privado: emite `POST /v1/products` con `{ name: 'Nuevo producto', basePrice: 0, categoryId: cats[0]?.id ?? 1, areaId: ars[0]?.id ?? 1, recipe: [], optionIds: [] }`. En éxito patchea `baseForm.id` y baja `isCreatingDraft`. En error muestra toast "No se pudo crear el producto", cierra el modal (`modalIsOpen=false`), limpia `createdProduct` y baja `isCreatingDraft`.
- `closeModal()` ahora: si `modalMode==='create' && createdProduct?.id && currentStep < 5` → `productService.deleteProduct(draftId)` (fire-and-forget con `catchError(() => of(null))`). Reset de `createdProduct` y `wizardProductImages`. Si había un `draftEffectRef` pendiente, lo destruye y baja `isCreatingDraft`.
- `submitStep1()` ahora: si ya existe `createdProduct()` en modo create, solo avanza al Paso 2 (sin volver a POSTear). La rama legacy (reference data nunca llegó) se conserva como fallback.
- Nuevo `triggerFileInput(fu)` helper: hace `fu.basicFileInput?.nativeElement?.click()` para abrir el file picker del `<p-fileupload mode="basic">` oculto.

**`products.html`**

- Reemplazado el bloque del Paso 1 (líneas 148-243 anteriores) por la estructura 2 columnas del plan: grid `md:grid-cols-[35%_1fr]`, izquierda = zona de upload con borde dashed + estados empty/uploading/preview + `progressBar` indeterminate para `isCreatingDraft`/`isUploadingImage`; derecha = `<form [formGroup]="baseForm">` con grid 2-col y orden `Nombre` → `Categoría`+`Área` → `Tiempo estimado` → `Descripción`.
- Botón "Estimar tiempo": ahora icon-only (`pi pi-stopwatch`, `[rounded][outlined][text]` + tooltip "Estimar tiempo"). Estado renderizado con `<p-tag>` ("Sin estimar" severity=secondary; "X min" severity=info).
- Select de Área ahora tiene `placeholder="Selecciona un área"`.
- Cuadro de imagen con `tabindex="0"`, `role="button"`, `aria-label="Subir imagen del producto"` y handlers `(keydown.enter)` + `(keydown.space)` para accesibilidad (lint `click-events-have-key-events` + `interactive-supports-focus`).
- Eliminada la sección duplicada "Imágenes" en el Paso 5 (líneas 735-773 anteriores) — la imagen solo se gestiona desde Paso 1.

**`products.spec.ts`**

- +8 tests en 3 nuevos `describe`: `auto-create draft on Step 1 entry (create mode)` (auto-create con reference data listo, error toast + modal cerrado cuando falla el POST, patch de `baseForm.id`), `closeModal cleanup of draft product` (delete en create+step<5, NO delete en edit, NO delete en create+step===5, NO delete si no hay draft), `submitStep1 advances without re-creating when draft exists` (no re-POST cuando ya hay borrador).
- Total: 50 tests en `products.spec.ts` (eran 42).

### Verificación

- Lint pasa (`npm run lint:check`): 0 errors.
- Build dev OK (`ng build --configuration=development`).
- Harness completo verde: 559 tests (48 archivos), sin commits.
- Notas de diseño: la imagen se muestra con `object-contain` (no `cover`) para no recortar imágenes verticales del producto; el `<p-button>` de eliminar imagen usa `styleClass="!absolute !top-2 !right-2"` (utility-prefixed override del `position: relative` del padre).

## 2026-07-31 — products-toggle-inactive (feat, id 20)

La Carta de Productos ahora tiene un toggle "Mostrar inactivos" en el caption de la tabla y un botón "Activar" en lugar de "Eliminar" cuando el toggle está activo.

- `product-cache.ts`: `productListParams` incluye `includeInactive: boolean`; `setProductListParams` lo acepta; se pasa como 3er arg a `getProductsPaginated` (sin hardcode `false`).
- `products.ts`: nuevo `setIncludeInactive(value)` (signal + cache.setProductListParams({includeInactive, page:0})); `filteredProducts` filtra client-side a `!p.active` cuando `includeInactive()` es true; `confirmDeleteProduct` ahora dice "¿Estás seguro de desactivar ...?"; toast de éxito "Producto desactivado"; nuevos `confirmEnableProduct` + private `enableProduct` (PUT /api/v1/products/{id}/enable + ws invalidation `products/update` + refreshProducts + toast "Producto activado").
- `products.html`: quitado `<th>Estado</th>` + celda Activo/Inactivo; agregado `p-toggleswitch` "Mostrar inactivos" en caption; colspan 6→5 en loadingbody/emptymessage/skeleton; empty message contextual ("No hay productos inactivos" vs "No hay productos registrados"); el botón trash se reemplaza por `@if (includeInactive())` con un botón "Activar" (`pi pi-check-circle`, severity success, tooltip "Activar", `confirmEnableProduct`).
- `product.ts` (service): nuevo `enableProduct(id): Observable<object>` → `http.put('v1/products/' + id + '/enable', {})` espejado de `disableProduct`.
- Specs: nuevo `product-cache.spec.ts` (3 tests de plumbing); `products.spec.ts` extendido con cacheStub.setProductListParams + productStub.enableProduct + describe "Mostrar inactivos toggle" + describe "Activar inactivos" (3 tests); `product.spec.ts` con `describe('enableProduct')`.
- OpenAPI: el backend agregó `PUT /api/v1/products/{id}/enable` (confirmado por el usuario; el OpenAPI servido aún no lo reflejaba al momento de la implementación — el código asumirá el endpoint activo en runtime).
- Revisión (implementation-reviewer): APPROVED, 10/10 criterios con evidencia.
- Harness verde: lint OK, build OK, 536 tests (46 archivos). No commit.

## 2026-07-31 — remove-manage-section-subtitles (chore, id 19)

Se quitaron los subtítulos descriptivos (`<p>` bajo el título de sección) en los 7 módulos de `/admin/manage`. Solo queda el título.

- `categories.html` (línea 5) y `categories.ts` (línea 44): quitado `<p>{{ description }}</p>` y el campo `description = 'Gestiona las categorías de productos del restaurante';`. `title` se mantiene.
- `products.html` (línea 6) y `products.ts` (línea 119): quitado `<p>{{ description }}</p>` (el `<div class="min-w-0">` envolvente se conserva con solo el `<h1>`) y el campo `description`. `title` se mantiene.
- `tables.ts` (línea 58): quitado solo el campo `description = 'Configura las mesas del restaurante';` (no se usaba); `title` se mantiene porque `{{ title }}` se sigue renderizando.
- `workers.html` (línea 6) y `workers.ts` (líneas 102-103): quitado `<p>Gestiona los trabajadores y sus asignaciones del restaurante</p>` (hardcoded) y AMBOS campos `title`/`description` (ninguno se usaba; el `<h1>` es hardcoded).
- `time-logs.html` (línea 6): quitado `<p>Historial de ingresos de los trabajadores</p>` (hardcoded).
- `areas.html` (línea 5): quitado `<p>Gestiona las áreas donde trabajan los empleados</p>` (hardcoded).
- `schedules.html` (línea 8): quitado `<p>Gestiona las plantillas de turnos</p>` (hardcoded).
- NO tocados: `combos/combo-editor.ts` (`description = signal('')` es form state del combo) y `schedules/assignments/schedule-assignments.html` (su `<p>` muestra el nombre dinámico del horario seleccionado, no un subtítulo).
- Revisión (implementation-reviewer): APPROVED, 8/8 criterios de aceptación con evidencia. Sin regresiones visuales (alineación de botones preservada en headers con acción a la derecha).
- Harness verde: lint OK, build OK, 526 tests (45 archivos). No commit.

## 2026-07-31 — supply-categories-to-categories-module (feat, id 18)

Se trasladó la gestión de categorías de insumo desde el módulo Inventario al módulo Categorías (`/admin/manage/categories`), que ahora tiene una tercera sección "Categorías de insumo" (listado + creación; sin toggle/delete porque el backend no lo soporta — `GET/POST /api/v1/supplies/categories` → `SupplyCategoryResponse { id, name }`, request `{ name }`).

- `categories-cache.ts`: nuevo `supplyCategories = ResourceCache<SupplyCategoryResponse[]>(() => supplyService.getCategories(), { ttlMs: 30min, staleWhileRevalidate: true })`; inyectado `Supply`; `invalidateAll()` también invalida `supplyCategories`.
- `categories.ts`: computed `supplyCategories`, signals/estado del dialog (`supplyCategoryDialogOpen`, `supplyCategoryForm`, `supplyCategorySaved/Error`), `openSupplyCategoryDialog()`/`saveSupplyCategory()` (llama `Supply.createCategory`, refresca caché, toast "Categoría creada"), ngOnInit/onVisible cargan/refrescan como product/option categories.
- `categories.html`: tercera card `lg:col-span-2` "Categorías de insumo" (chips pi-tag + nombre, sin toggle) + `p-dialog` "Nueva categoría de insumo" (input nombre + footer Cancelar/Guardar), patrón clonado de las cards existentes.
- `inventory.ts`: eliminados `newCategoryDialogOpen`, `newCategorySubmitting`, `newCategoryForm`, `openCategoryDialog()`, `closeCategoryDialog()`, `submitNewCategory()`. Se mantiene `confirmCategory()` del wizard (crea categoría inline) y la señal `categories()`.
- `inventory.html`: quitado el `p-button` "Nueva categoría" del caption y todo el bloque `<!-- ===== New category dialog ===== -->`. Botones restantes ("Nuevo insumo", "Transferir a cocina") intactos.
- Specs: nuevo `categories-cache.spec.ts` (2 tests: load GET v1/supplies/categories + invalidateAll marca stale sin limpiar data); `supply.spec.ts` suma `getCategories`/`createCategory`. Grep confirma 0 referencias al dialog eliminado.
- Revisión (implementation-reviewer): APPROVED, 8/8 criterios de aceptación con evidencia.
- Harness verde: lint OK, build OK, 526 tests (45 archivos). No commit.

## 2026-07-31 — fix-products-pagination (fix, id 13)

La tabla de productos solo mostraba una página. Root cause: backend `GET /api/v1/products` devuelve `{ content, page: { size, number, totalElements, totalPages } }` (metadatos anidados), pero `Product.getProductsPaginated` no mapeaba la respuesta y `PaginatedProductsResponse` esperaba `totalPages`/`totalElements` planos → en runtime eran `undefined` → paginator `totalRecords=0` → 1 página.

- `product.ts`: nueva interfaz `PagedProductsApiResponse` (shape raw) y `map()` en `getProductsPaginated` que aplana `page` → `PaginatedProductsResponse` (`content ?? []`, `totalElements ?? 0`, `totalPages ?? 0`, `page: page?.number ?? 0`, `size: page?.size ?? 0`).
- `product.spec.ts`: 2 tests nuevos para `getProductsPaginated` (flattening del payload anidado + defaults cuando falta `page`; verifica query params page/size/includeInactive/includeSelections).
- `combo-reference-cache.spec.ts`: 3 flush sites actualizados al contrato anidado real (`{ content, page }`) — sin debilitar aserciones.
- Harness verde: lint OK, build OK, 517/517 tests (43 archivos).
- Pendiente: confirmar en browser que el paginator muestra varias páginas (verificación manual). No commit.

## 2026-07-31 — fix-products-page-display (fix, id 14)

Follow-up: al pasar a la página 2+ la tabla quedaba vacía aunque la consulta retornaba productos. Root cause: PrimeNG p-table con `[paginator]` y lazy=false renderiza `value.slice(first, first + rows)` (primeng-table.mjs `dataToRender`). `value` solo tiene la página actual (6 items); en página 2 first=6 → slice(6,12) sobre 6 elementos → vacío.

- `products.html`: `[lazy]=true` + `[first]="currentPage() * pageSize()"` (patrón server-side del alerts.html). En lazy, `dataToRender` usa first=0 → renderiza el value directo. Se quitó `sortMode="multiple"` y los `pSortableColumn`/`p-sortIcon` de 4 columnas (backend sin sort param; en lazy el sort era no-op que además reseteaba la página). `onPage` y `product-cache` sin cambios.
- `filterCategories`/`filterProducts` (override no paginado) no están conectados al template → modo server-paginated siempre activo, lazy seguro.
- Harness verde: lint OK, build OK, 517/517 tests (43 archivos).
- Pendiente: verificación manual en browser (página 2+ muestra productos). No commit.

## 2026-07-31 — fix-products-excess-requests (fix, id 15)

Al cargar la página de productos se hacían 7 consultas: auth + products (esperadas) + 5 de reference data (areas, categories, option-categories, variants, product-options) que la tabla no usa (products ya devuelve areaName/categoryName; el resto solo se ve al abrir el wizard/detalle).

- `products.ts`: ngOnInit ya no fuerza `referenceData.refresh()` (se quitó el bloque). Reference data se carga on-demand vía `loadIfStale()` en showCreationModal (~L381), showModificationModal (~L404) y NewOptionDialog (~L84).
- `products.html`: `[loading]="referenceDataLoading()"` en los 7 p-select del wizard que dependen de reference data (categories, areas, supplyVariantOptions ×3, optionCategories, optionsByCategory) para feedback en la primera carga lazy.
- Se mantiene el `referenceData.refresh()` tras crear opción (products.ts:1115, new-option-dialog.ts:161).
- Harness verde: lint OK, build OK, 517/517 tests (43 archivos).
- Pendiente: verificación manual en browser (solo 2 requests al cargar la página; wizard carga reference data al abrir). No commit.

## 2026-07-31 — fix-new-option-dialog-eager-load (fix, id 16)

Las 5 consultas de reference data seguían disparándose al cargar la página pese al activity 15. Root cause: `<app-new-option-dialog>` se renderiza SIEMPRE en products.html (sin @if) y `NewOptionDialog.ngOnInit()` llamaba `loadReferenceData()` → `cache.referenceData.loadIfStale()` al instanciarse, aunque el dialog nunca se abra.

- `new-option-dialog.ts`: eliminados `ngOnInit()`, `loadReferenceData()` y `implements OnInit` (y `OnInit` del import). Se mantiene `referenceDataEffect` (aplica la data cuando llega).
- `products.ts` `openNewOptionDialog()`: ahora llama `cache.referenceData.loadIfStale()` antes de abrir (mismo patrón que showCreationModal/showModificationModal).
- Harness verde: lint OK, build OK, 517/517 tests (43 archivos).
- Pendiente: verificación manual en browser (2 requests al cargar; 5 solo al abrir wizard o dialog de nueva opción). No commit.

## 2026-07-14 — special-selections-ui-migration (feat/chore)

Migrate frontend from legacy day-menu API to new special-selections (combos) system. See progress/current.md for full detail.

## 2026-07-12 — fix-waiter-product-images (fix)

Surface backend 409/400 errors as specific toasts, invalidate tables cache after order mutations, validate table selection before submit, add table picker UI, fix diner removal safety + stale snapshot, toast consistency, day-menu validation, today-orders bugs, carta race, PrimeNG templates, skeletons.

## 2026-07-12 — refactor(auth): rename login to auth

Rename login area to auth area, flatten features folder, sync terms checkbox with habeas-data modal, remove inline dialog, add global link styles, mobile padding, replace AROS logo with project logo, redesign login page.

## 2026-07-12 — feat(employee-settings-redesign) (id 2)

Redesign employee module for accessibility, move schedule CRUD to settings, merge schedule assignments and time-logs into employees module, redesign settings as comprehensive hub (accessibility, logout, schedules, account info), remove settings button from admin header (keep for worker), remove floating accessibility button.

## 2026-07-12 — chore(styling-consistency) (id 1)

Enforce design-token uniformity, remove exaggerated shadows and black text (#000, black), create DESIGN.md, update harness to validate against it.

## 2026-07-12 — chore(karma-test-fix)

Fix karma test issue.

## 2026-07-12 — feat(employee-ui-fixes-round-1) (id 3)

Fix 5 user-reported issues: (1) contrast mode not working visually + reduce accent color usage in accessibility UI, (2) redesign change-password as modal dialog, (3) debug and fix workers table not loading in users tab, (4) redesign schedule form for bulk day selection instead of day-by-day + remove 'Asignar trabajadores' button from schedules table, (5) redesign worker list as cards with profile images/initials, name, area, shifts, action button.

**Task a — Contrast mode + accessibility UI** (`styles.css`, `accessibility-settings.ts`):

- Added CSS for `[data-contrast='high']` globally (focus rings, borders, text contrast)
- Removed `bg-primary-50` from accessibility-settings buttons, switched to design tokens

**Task b — Change-password modal** (`change-password.ts/.html`):

- Rewrote as PrimeNG `p-dialog` modal, triggered from settings button

**Task c — Workers table not loading** (`user.ts`, `users.ts`):

- Root cause: `GET /api/v1/users/employees` endpoint does not exist in backend (only `GET /api/v1/users` exists)
- Fix: `getEmployees()` now calls `v1/users` (valid), and `users` computed filters by `role === 'WORKER'`

**Task d — Schedule bulk day selection** (`schedules.ts/.html`):

- Removed "Asignar trabajadores" button from schedules table
- Replaced day-by-day shift entry with "Bloques de Turnos": checkboxes for days (Lun-Sun) + one time range per block
- Blocks expand to individual shifts on save (API contract preserved)
- Live preview panel shows expanded shift list

**Task e — Worker cards** (`worker-card.ts/.html` created, `users.ts/.html` modified):

- Created standalone `WorkerCard` component with deterministic-color initial letters avatar
- Cards show: name, email, document, area, schedule count, status, action buttons
- Added view toggle (table/cards) with pi-table/pi-th-large icons

Harness green — lint, build, tests, style validation all pass.

## 2026-07-14 — dev-theme-profile-wiring (chore, id 4)

**Goal:** Wire `src/environments/theme.development.ts` so `ng serve` / `ng build --configuration development` actually loads dev colors. Production keeps `theme.ts`.

**Changes:**

- `src/environments/theme.development.ts` — rewrote as full standalone theme (no self-import to avoid circular fileReplacements). `primary.500 = '#A65403'`, full 50–950 ramp generated around it. semantic + surface inlined.
- `angular.json` — added `fileReplacements` entry under `client.build.configurations.development` swapping `theme.ts` → `theme.development.ts` (mirrors existing `environment.ts` swap).

**Result:** dev build now compiles with custom primary; prod untouched. Harness all green (env, files, activities, lint, prod build, DESIGN.md, tests).

## 2026-07-14 — theme-dev-basecolor-derive (chore, id 5)

**Goal:** `theme.development.ts` reads `environment.baseColor` from `environment.development.ts` and auto-derives primary 50–950 scale. User changes only `environment.baseColor` to retheme dev.

**Changes:**

- `src/environments/theme.development.ts` — added inline `hexToRgb` / `rgbToHex` / `mix(color, toward, amount)` utilities. Reads `environment.baseColor`, builds full ramp: 50-400 lighter toward white, 500 = baseColor, 600-950 darker toward black. semantic + surface inlined.
- `src/environments/environment.development.ts` already exports `baseColor` (`#5E7D1C`).

**Result:** changing `baseColor` + saving triggers HMR rebuild with new palette. Harness all green.

## 2026-07-14 — theme-dark-mode-and-hc-driven (chore, id 6)

**Goal:** (1) dark-mode primary visible for any baseColor; (2) high-contrast section theme-driven (no hardcoded gold hex).

**Changes:**

- `src/environments/theme.development.ts` — tuned primary ramp mix amounts so 400 is visibly brighter than 500 on dark backgrounds (key: 400 went 0.10 → 0.35 toward white). All 10 slots adjusted.
- `src/styles.css` — replaced prod-gold hex (`#c69409`, `#eab308`, `#F9BB0B`, `#b8860b`) inside both `[data-contrast="high"]` blocks with `color-mix(in srgb, var(--p-primary-500), black|white N%)`. Light HC darkens toward black; Dark HC lightens toward white. Grep confirms zero prod-gold hex remain.

**Derived ramp for baseColor `#5E7D1C`:**

```
50=#e7ecdd 100=#c7d2b0 200=#a6b882 300=#8ea460 400=#96ab6b 500=#5E7D1C
600=#506a18 700=#425814 800=#34450f 900=#212c0a 950=#0e1304
```

**Result:** dark-mode buttons using `Primary.400` now read clearly on dark surfaces for any baseColor. High-contrast adapts to theme. Harness all green (env, files, activities, lint, build, DESIGN.md, tests).

## 2026-07-16 — combo-builder-03-admin-wizard (feat)

Complete admin guided Combo Builder wizard with PrimeNG Timeline shell, 4 step components (general, per-category group, questions, pricing), and submission wiring.

### What was built

- **CB-03-01** — Signal-based `ComboWizardState` with localStorage draft versioning, restore/discard/hydrate
- **CB-03-02** — PrimeNG vertical Timeline shell with active/completed/inactive markers, 4 slot types, guarded nav, dynamic per-category steps
- **CB-03-03** — General info step: name, description, basePrice, areaId, active, baseRecipeEnabled, schedulingRequired, UI-only category multi-select generating groups
- **CB-03-04** — Reusable `ProductCard` with lazy thumbnail, currency, selected/disabled/unavailable states, keyboard support
- **CB-03-05** — Per-category group step with available/selected product grid, CDK drag/drop, debounced search, min/max enforcement, keyboard navigation
- **CB-03-06** — Pure-function `groupValidation` with 6 error types, progression gating, eligible-product filtering
- **CB-03-07** — Questions step with add/remove edit, required toggle, displayOrder reindexing, skip behavior
- **CB-03-08** — Pricing step with cost breakdown, margin-based suggested-price API integration, manual price override
- **CB-03-09** — `ComboSubmission` service: buildRequest mapping, create/update routing, displayOrder renumbering, error mapping with Spanish toasts
- **CB-03-10** — 312 tests across 23 files covering all steps, validation, submission, integration flows
- **CB-03-11** — Final review PASS: all conventions, design tokens, Spanish text, no hardcoded colors

### Key fixes

- Replaced dynamic `[select]` with 4 static `<ng-content>` + `@switch` for correct content projection
- Replaced `contentChildren` with DOM-based `hasSlotContent()` for placeholder detection
- Removed `TODO-10b` comment, replaced hardcoded `text-red-500`/`border-green-500` with design tokens
- Removed stale result files (cb-03-01/02/02-04-results.md)

### Verification

- 23 test files, 312 tests — all green
- Lint, build, DESIGN.md validation — all green
- Activity `combo-builder-03-admin-wizard` marked `done`

## 2026-07-17 → 2026-07-20 — analytics-section (admin profile) — feat

Implement the `/admin/analytics` section end-to-end following `docs/analytics.md` + `docs/contracts/analytics.yaml` (saved at `docs/analytics.yaml`). 9 activities, 38 tasks.

### Plan (recorded in `activities.json`)

1. `analytics-foundation` — 12 DTOs (`Money/MetricValue/Period/DataCompleteness/TimeBucket` + per-module report types + `Alert/AlertsPage/ProblemDetail`), full HTTP service, `AnalyticsCache` with 5 `ResourceCache` instances, `AnalyticsPeriodState`, `MoneyPipe` + `MetricValuePipe`, period-key utility, 42 foundation tests.
2. `analytics-shell` — refactor `analytics.ts` to parent shell with `<router-outlet>`, 5 child routes (`/admin/analytics/{prime-cost,menu-engineering,operations,cohort,alerts}`), `AnalyticsNav` (5 tabs, design tokens, accessibility), `PeriodSelector` (bucket + Desde/Hasta + Aplicar/Restablecer + inline validation), 34 shell tests.
3. `analytics-prime-cost` — stat cards (ventas netas / costo primo / costo primo % / margen bruto), trend line chart of `primeCostPct`, COGS-by-category + labor-by-area doughnut charts + breakdown tables, notes banner, 9 tests.
4. `analytics-menu-engineering` — 4 stat cards (productos / contribución total / volumen mediana / margen mediana), bubble BCG matrix, paginated/sortable `p-table` with numeric Money sort + quadrant tags, category filter, banner with retry, 24 tests (after rework for auto-load + a11y + O(n²) fix).
5. `analytics-operations` — RevPASH / Ventas netas / Rotación global / Ocupación media stat cards, bar chart of `turns/covers` per day part, day-part Spanish labels, banners, 11 tests.
6. `analytics-cohort` — 4 KPI cards (nuevos / recurrentes / total pedidos / tasa de recurrencia), doughnut "Nuevos vs recurrentes", ticket medio (por pedido / por cubierto), fingerprintStrategy Spanish banner, 10 tests.
7. `analytics-alerts` — 4 summary cards (Abiertas/Rojas/Amarillas/Info), status + severity filters, paginated `p-table` with severity/status PrimeNG tags, mark-read PATCH with optimistic local flip + toast, 10 tests.
8. `analytics-pre-harness-chore` — fixed the 12 pre-existing combo lint errors so `node scripts/harness.js` exits green.
9. `analytics-review-hardening` — final cross-module review caught a critical defect (PrimeCost had no `loadIfStale()` on mount); fixed inline + added spec.

### Final state

- **443/443 tests passing** (was 302 before this session; +141 new tests across 11 new spec files)
- **Lint: 0 errors** (was 12 pre-existing combo errors; all cleared in AN-CH-01)
- **Build: green**
- **`node scripts/harness.js`: exit 0, all 8 blocks green**

### Architectural decisions

See `docs/analytics-decisions.md` for full register. Highlights:

- `AnalyticsCache` uses `ResourceCache<T>` per module with TTLs (600s/1800s/300s/600s/120s).
- Period changes invalidate the 4 period-bound caches via an `effect` on `AnalyticsPeriodState.period`. `alerts` is filter-bound (period-unbound).
- `alerts` endpoint uses direct `api.listAlerts()` calls from the component instead of `ResourceCache` because filters live in component signals.
- Charts via PrimeNG `p-chart` (chart.js), types: line, doughnut, bar, bubble.
- Banner split: PARTIAL → amber "Datos parciales"; EMPTY → blue "Sin datos en el periodo"; both render notes list + Reintentar button.
- All five module pages auto-load on mount via `cache.<m>.loadIfStale()` (or `fetch()` for alerts).

### Conventions enforced

- File names: kebab-case, no `.component.ts/.service.ts/.model.ts` suffix
- External templates + styles per file, no inline
- Spanish user-facing text, English class names + variables
- Design tokens only, no shadows, surface layering (header surface-100, content `bg-primary-contrast`, nested surface-50)
- Money pipe: COP no decimals, es-CO locale, null/NaN → em dash
- OnPush change detection + signals throughout
- Accessibility: `<figure>`+sr-only `<figcaption>` on charts, `role="status" aria-live="polite"` on skeletons, `aria-label` on nav tabs and action buttons, label `for`/`id` pairs on filter inputs

### Open follow-ups (non-blocking)

- Hardcoded chart palettes (4 modules) — tokenization candidate
- `setBucket('yearly'|'daily'|'weekly')` keeps monthly-shaped range — flag for separate decision
- Orphan `top-selling-chart/` folder — cleanup candidate

All 9 analytics activities marked `done` in `activities.json`. Harness is green and ready for next session.

## 2026-07-28 — restrict-time-bucket-to-monthly (chore, id 8)

Simplify analytics time ranges: only monthly bucket. Removed daily/weekly/yearly from TimeBucket, analytics-utils, AnalyticsPeriodState, PeriodSelector UI. Moved PeriodSelector to bottom dock. All tests updated. Bugfix NG0955 (track $index + dedupe topItems by name).

## 2026-07-28 — me-quadrant-ux (feat, id 9)

Redesign Menu Engineering quadrant cards and table:

- BCG labels renamed to Spanish: STAR→Excelente (pi-star-fill), PLOWHORSE→Populares (pi-thumbs-up), PUZZLE→Oportunidad (pi-lightbulb), DOG→A revisar (pi-flag)
- Quadrant cards are now clickable buttons: click filters table to that quadrant, click again clears filter
- Chip with icon+label + "Limpiar" button shown in table header when filter active
- Table columns reorganized: Producto, Categoría, Unidades, Costo por unidad (recipeCost), Precio de venta (revenue/unitsSold), Margen % (gpPerUnit/sellPrice*100), Ganancia total, Cuadrante (icono+label)
- Guards for unitsSold=0 (null price/margin, no division by zero)
- Custom numeric sort for Money fields via moneyAmount() helper; new sort keys: recipeCost, sellPricePerUnit, marginPercent
- 39 new tests: quadrant click toggle, quadrant+category combined filter, sellPricePerUnit/marginPercent helpers, fmtPercent, sort by new keys, quadrantMeta, selectedQuadrantMeta, aria-pressed, quadrant chip rendering
- All 464 tests pass (1 pre-existing prime-cost chart count mismatch)

## 2026-07-29 → 2026-07-30 — product-deep-edit (feat, id 10)

Deep product editing in admin: from the products table, the pencil button now opens the wizard in edit mode (replace the small `ProductEditModal` that had a data-loss bug — `save()` sent `recipe: []` and `optionIds: []` wiping existing associations).

**What was built**

- `ProductCostResponse` + `CostItem` DTOs and `Product.getCost(id)` calling `GET /v1/products/{id}/cost` (backend computes material = recipe qty × unit cost; labor = avg hourly rate × estimatedPrepMinutes; breakdown by type MATERIAL/LABOR).
- Pencil button + detail-dialog Edit button wired to the existing but unwired `showModificationModal(id)`; `openEditModal()` deleted from products.ts.
- Wizard step 2: existing recipe rows now editable in place (quantity input + supply-variant select with category filter), not just delete-only. Stable row-id map keeps the per-row category filter consistent across remove.
- Wizard step 1: added `description` (textarea) and `estimatedPrepMinutes` (minutes input). `submitStep3` now sends the full `ProductRequest` (name, description, basePrice, categoryId, areaId, recipe, optionIds, estimatedPrepMinutes).
- `submitStep3` recipe merge changed from `Object.assign([], existing, base)` to a `Map<number, RecipeItemRequest>` keyed by `supplyVariantId` (dedupes when same variant is in both arrays; baseItems wins on conflict).
- Cost panel rendered in step 2 (edit mode) and step 4 (confirmation): material/labor/total formatted via existing `currencyFormat`, breakdown rows with `pi-box` (MATERIAL) / `pi-clock` (LABOR) icons, loading skeleton + error alert.
- `ProductEditModal` component + folder deleted. `editModalVisible` and `editingProductId` signals removed. `onProductUpdated()` retained (still wired to `<app-product-detail-dialog>` image updates).
- 18 new tests: DTOs, `getCost` service, existing-recipe edit mode, description/prepMinutes patching + submit, cost panel success/error/load-on-edit.

**Verification**

- All 482 tests pass; lint, build, and DESIGN.md style checks green via `node scripts/harness.js`.

**Out of scope (documented for future activity)**

- Editing existing option recipes: backend `GET /v1/product-options/{id}` response omits recipe; adding it requires backend changes.
- Dead fields on Product DTOs (`selectionType`, `baseRecipeEnabled`, `schedulingRequired`): actually live for combos/orders/special-selections — left untouched despite being absent from the backend `ProductRequest`.

## 2026-07-30 — product-deep-edit-followups (chore, id 11)

Applied 4 LOW-severity follow-ups from the activity 10 exhaustive review:

- **Race guard in cost panel** (`products.ts` `loadProductCost`): now `if (c) this.cost.set(c)` — catchError `of(null)` no longer wipes a previously valid `cost` if a late response arrives after error.
- **State reset on modal open** (`showModificationModal`): now resets `cost`/`costLoading`/`costError` at the top, before the `findProduct` call, so closing+reopening doesn't flash the prior product's cost.
- **Split submitStep3 error handling** (two-layer catchError chain): `updateProduct` failure → red toast "No se pudo guardar el producto con sus opciones" (real failure). `findProduct` failure after a successful update → amber `warn` toast "Guardado con observaciones" (save did succeed; just a refetch glitch).
- **Drop dead DTO fields** (`selectionType?`, `baseRecipeEnabled?`, `schedulingRequired?` removed from `ProductCreateRequest`/`ProductUpdateRequest`; `baseRecipeEnabled?`/`schedulingRequired?` removed from `ProductListResponse`/`ProductResponse`; `id` removed from `ProductUpdateRequest` and from the submitStep3 payload). `selectionType` kept on responses (backend returns it). `SpecialSelectionRequest`/`Response` untouched. Touched `combo-submission.ts` to remove the dead fields from the `ProductCreateRequest` literal at line 52 (combo's `SpecialSelectionRequest` body, lines 71–106, unchanged). Removed now-stale type assertions in `combo-foundation-contracts.spec.ts`.
- **Prune unused PrimeNG imports** (`products.ts`): `MultiSelectModule`, `ConfirmDialogModule`, `GalleriaModule` removed (verified via grep: zero `p-multiselect` / `p-confirmDialog` / `p-galleria` in `products.html`). `ConfirmationService` and `ConfirmPopupModule` kept (in use).

**Verification**: 489/489 tests pass; harness green (lint, build, DESIGN.md).

**Out of scope (separate investigation needed)**

- `ProductResponse` and `ProductListResponse` declare `thumbnailUrl?` but the backend returns `imageUrl` (verified via `/v3/api-docs`). This makes `product-card.html` and `product-options-modal.html` (which both read `product.thumbnailUrl`) likely show placeholder images. Two consumers are broken-ish; needs backend field-mapping confirmation or a frontend rename. Logged for a future activity.
- Live spec has no `ProductListResponse` schema — list endpoint returns `ProductResponse` items inside `PagedModelProductResponse`. The frontend's standalone `ProductListResponse` is a legacy DTO kept for `Product.getAllProducts()`; separate consolidation possible later.

## 2026-07-31 — fix-inventory-pagination (fix, id 17)

Inventory table now uses server-side pagination + lazy loading, mirroring the products table pattern (activities 13–16). Committed as `d441804`.

**Backend (delivered by user 2026-07-31):** `GET /api/v1/supplies/variants` ALWAYS returns `PagedModelSupplyVariantResponse` `{ content, page: { size, number, totalElements, totalPages } }` — no array fallback. Params: `page` (default 0), `size` (default 20, max 100), `supplyId` (optional). No `categoryId`, no `name`. Illegal pagination → 400. Stock fetched only for current-page variant ids (`findByStorageLocationIdAndSupplyVariantIdIn`).

**Frontend changes:**

- `supply.ts`: `PaginatedSuppliesResponse` (flat) + `PagedSuppliesApiResponse` (raw) interfaces; `getSupplyVariantsPaginated(page, size)` flattens `{ content, page }` via `map()` (fallback 0). `getSupplyVariants()` adapted to always-paginated backend: requests `size=100` + unwraps `.content` (fallback `[]`) so `product-cache.ts:53` pickers and `inventory-cache.ts:31` full-list keep an array. Deleted dead `getVariantsByCategory()`.
- `inventory-cache.ts`: new `suppliesPage` ResourceCache<PaginatedSuppliesResponse> + `setSuppliesListParams({page, size})` (reset+load, products `setProductListParams` pattern); `invalidateSupplies()`/`invalidateAll()` also invalidate `suppliesPage`. Full `supplies` list kept for zero-cost warning, purchase picker, transfer dialog, WS updates.
- `inventory.ts`: `currentPage`/`pageSize`/`tableSearch` signals; `pageSupplies`/`totalElements` computeds; `filteredSupplies` searches current page only; `onPage()` → `setSuppliesListParams`; `ngOnInit` only force-loads `suppliesPage` (eager referenceData/purchases removed); `onVisible()` loadIfStale on all 4 caches; `clearFilters()`.
- `inventory.html`: p-table `[paginator] [rows] [totalRecords] [lazy] [first] (onPage)`; removed `sortMode="multiple"`, `[globalFilterFields]`, all `pSortableColumn`/`p-sortIcon`; `[appLazyLoad]` bound to `cache.suppliesPage`.
- `supply.spec.ts` (NEW): 5 tests covering paginated flattening + params + missing-metadata fallback + optional-param omission, and `getSupplyVariants` unwrap (size=100 + content extraction + fallback []).

**Decisions:**

- Category filter REMOVED from the inventory table (user decision): backend `/variants` doesn't support `categoryId`, so the server-side filter was a silent no-op. Deleted caption `p-select`, `filterByCategory()`, `selectedCategoryId`, and `categoryId`/`name` params from `getSupplyVariantsPaginated`/`setSuppliesListParams`.
- `getSupplyVariants()` caps pickers at 100 variants (same limitation products' combo-reference accepts).

**Verification:** harness green — lint OK, build OK, DESIGN.md OK, 44 test files / 522 tests pass.

## 2026-09-10 — quality-fix-harness-cleanup (chore)

Fix 39 lint errors and 18 test failures that had accumulated in the harness.

**Lint fixes (39 errors → 0):**

- `product-option-groups.spec.ts` (32 errors): Rewrote entire spec to test the actual component API (`onNodeExpand`/`onNodeCollapse`/`chartData`) instead of non-existent methods (`toggleProduct`, `isProductExpanded`, `treeNodes`, `getGroupsForProduct`, `getOptionsForGroup`). Fixed HTTP mock matching to use request predicate `r => r.url === 'v1/products'` instead of exact string (component sends query params). Fixed paginated response shape to `{ content, page }` matching `getProductsPaginated`.
- `product-option-groups.ts` (6 errors): Wrapped `number` template literal expressions in `String()` calls (`product-${String(product.id)}`) to satisfy `restrict-template-expressions`.
- `products.ts` (1 error): Removed unused `NewOptionDialog` import (component deleted in earlier activity but import survived).

**Test fixes (18 failures → 0):**

- `product-option-groups.spec.ts` (17 → 0): Tests now correctly mock `ngOnInit` request flush with paginated response, use `httpMock.expectOne(r => ...)` predicate matching, and test real component methods.
- `cost-breakdown-panel.spec.ts` (1 → 0): Changed `baseCost: undefined` (invalid state causing template crash) to `baseCost: { amount: 0, currency: 'COP' }`.

**Verification:** harness green — 62 test files / 755 tests pass, lint 0 errors, build OK.

---

## Activity 37 — p0-money-and-auth-hardening ✅ DONE (2026-11-10)

Origin: impeccable critique `.impeccable/critique/2026-11-10T14-42-57Z__src-app-whole-web-app-auth-admin-worker.md` (19/40). Only the two P0s were in scope; passes 3-7 remain queued in that snapshot.

### Contract decision (backend owned by another agent)

Inspected live `/v3/api-docs` + real responses. Findings that shaped the work:

- Money is a bare JSON number, no currency field anywhere.
- 401/403 are **bodiless** (`Content-Length: 0`), no RFC 7807, spec declares errors using success models.
- Three pagination dialects: `{items,total,total_pages}`, HATEOAS `{content,page{}}`, bare arrays.
  Chosen approach: tolerant frontend contract layer (normalize at the wire boundary), branch on HTTP status only, never parse error bodies.

### Delivered

- `money` pipe accepts `Money | number | string | null | undefined`; `DEFAULT_CURRENCY='COP'`; 14 template sites migrated; 11 dashboard `$ {{ }}` hardcodes removed; zero `USD` outside spec fixtures.
- `orders-table`: fixed `??`-before-pipe precedence bug, `extraCharge` folded into a single-sourced total.
- New `unwrapPage()` adapter (3 dialects + arrays), wired into `master-data` and `order`; `size: 500` firehose removed.
- Auth matrix: 401 → one refresh → else `/login?returnUrl=`; 403 → new `/forbidden` page; only 5xx/0 → `/server-error`. Single-flight refresh, no loops, returnUrl round-trip closed. Replay failures split from refresh failures.
- Paging data-loss class closed in `today-orders`, `dashboard`, `kitchen` (3 columns) and the notification READY poll; any residual cap is surfaced in the UI (`· vista limitada: mostrando N de M`).

### Reviewer round

4 blockers raised, all fixed: waiter truncation at >50 orders, unbounded `expand` when the backend echoes `page: 0`, replay 403/5xx wrongly logging out, missing specs for `orders-table`/`dashboard`. Reports: `progress/explore/lane-a-money.md`, `lane-b-auth.md`, `lane-c-kitchen.md`, `progress/review/activity-37.md`.

### Result

`node scripts/harness.js` exit 0 — lint, build, DESIGN validation, **836 tests / 76 files** (was 688).

---

## Activity 34 — implement-payroll-endpoints ✅ DONE (2026-11-10)

### Contrato (verificado en spec; backend estaba DOWN parte del tiempo)

- Endpoints reales: `GET/POST /v1/payroll`, `PATCH/DELETE /v1/payroll/{id}`, `GET /v1/payroll/{year}/{month}`, `GET /v1/payroll/worker/{userId}[/{year}/{month}]`, `POST /v1/payroll/events`, `GET /v1/payroll/events/{userId}/{year}/{month}`, `DELETE /v1/payroll/events/{id}`, `POST /v1/payroll/events/calculate`, `POST /v1/payroll/settle`, `GET /v1/payroll/settlements/{userId}/{year}/{month}`.
- El plan (`docs/plans/payroll-plan.md`) estaba desactualizado: los nombres reales son `PayrollSettlementRequest` / `PayrollCalculateRequest`, `PayrollEventRequest` no lleva `amount`, y existen `createdBy`/`settledBy`.

### Entregado

- **Fundación:** DTOs por wire-type + unions (`PayrollEventType`, `SettlementType`, `PayrollStatus`), servicio `Payroll` (13 métodos), `PayrollCache` sobre `ResourceCache` (2m TTL, SWR, `invalidateAll`).
- **UI:** `app-payroll-panel` standalone montado como tercera pestaña en Workers (lazy, markup/a11y copiado de las pestañas existentes, `workers.ts` no creció). Resumen, selector de período, tabla de eventos + modal con "calcular sugerido", modal de liquidación, historial de liquidaciones.

### Reviewer round

2 bloqueantes, ambos corregidos:

1. `formatIsoDate` sobre un `Instant` renderizaba `15T18:00:00/06/2026` → nuevo `shared/lib/date-format` con `formatInstant` (dd/mm/aaaa HH:mm) y test con string exacto.
2. Monto de liquidación libre sin referencia a `pendingAmount`: ahora muestra la base, calcula la divergencia en vivo y exige confirmación explícita en sobrepago. Se bloquean montos no positivos/no finitos.
   Nits: skeleton 7 columnas, focus trap + Escape desde overlays con `appendTo="body"`, regresión de la pestaña time-logs en `workers.spec.ts`, imports muertos, asserts débiles reemplazados por exactos.

### Resultado

`node scripts/harness.js` exit 0 — lint, build, DESIGN, **964 tests / 87 archivos**.

### Riesgo residual

La UI nunca se ejercitó contra el backend real (estuvo caído durante el desarrollo). Falta una pasada manual con sesión válida.

---

## Activity 35 — fix-test-policy-violations ✅ DONE (2026-11-10)

El audit `docs/TEST_POLICY_VIOLATIONS.md` estaba obsoleto (decía 60/60 archivos con violaciones, incluidos headers). Re-auditoría real: los 86 specs YA tenían header; el trabajo real era otro.

### Corregido

- `httpMock.verify()`: solo faltaba en `categories-cache.spec.ts` (HIGH).
- `resetTestingModule`: agregado a los 15 suites que llaman `configureTestingModule`; deliberadamente NO en 7 suites de funciones puras/helpers que nunca configuran módulo (sería ruido).
- Asserts débiles: eliminados todos los `toBeTruthy`/`toBeDefined` sueltos y los `toContain` como único assert de render en analytics, combos (general/group/pricing/questions), guard-badge, removable-chip, search-input, product-card, skeletons, caches.
- `NO_ERROR_PATHS` (HIGH): `option-selection-type-mapper` pasó de 6 a 12 tests con casos de fallback ausente, undefined, nombre interno y rechazo por case/whitespace.
- `pricing-step` / `wizard-integration`: fixtures con forma `Money` y expectations numéricas exactas (450 / 405, NaN-free) en vez de sumas auto-computadas.

### Nota

Este round importó porque tres bugs pasaron en verde durante la misma sesión (truncación de pedidos a 1 página, totales `NaN` por `MoneyDto`, `Instant` formateado como fecha). Todos por asserts que no podían fallar. La regla que queda escrita en el doc: **afirmar el valor renderizado/agregado exacto y construir fixtures con la forma real del wire**.

### Resultado

`node scripts/harness.js` exit 0 — **972 tests / 87 archivos**.

---

## Activity 39 — contract-followups ⏸ PARCIAL (2026-11-10)

Cerrada en todo lo que dependía del frontend. Queda `blocked` solo por la tarea (f): regenerar `/v3/api-docs`, que es del equipo backend.

### Migración MoneyDto completada

Campos que el backend ya enviaba como `MoneyDto` y el frontend tipaba como `number`:

- `SupplyVariantResponse.unitCost`, `PurchaseItemResponse.unitPrice`, `PurchaseResponse.totalAmount`
- `SalaryHistoryEntry.old/newSalary`, `WorkerResponse.salary`
- `ProductResponse.basePrice` (+ `ProductListResponse`), `SpecialSelectionResponse.basePrice`
- `UserResponse.salary`

Fix real encontrado: el wizard de producto hacía `Money * number` en `recipeCost`, `getUnitCost` y el `partial` de cada fila → `NaN`. Todo pasa por `toAmount()`. `suggestedSalePrice` (×1.3) igual en las dos pantallas de producto. Eliminados `currencyFormat`/`formatMoney`/`formatSalary` y `Intl.NumberFormat` ad-hoc; el render va por el pipe `money`.

### ProblemDetail surfaced

Nuevo `shared/lib/problem-detail` con `extractProblemDetail(err)` (tolera bodyless, no-objeto, vacío, HTML; cap de 300 chars, se renderiza como texto). Cableado en login (401 y 400/422), reset-password, two-factor, setup-account, change-password. El interceptor NO se tocó: sigue ramificando solo por status porque los 401 de filtro siguen sin body.

Antes el login descartaba el `detail` del servidor y mostraba un genérico "Invalid credentials".

### Resultado

`node scripts/harness.js` exit 0 — **1011 tests / 91 archivos**.

### Riesgo residual

Nada de esto se vio en navegador contra el backend real (caído intermitentemente durante la sesión). Falta pasada manual, en especial payroll y las pantallas de worker.

---

## Activity 40 — modern-web-audit ✅ (2026-11-12)

Auditoría completa del frontend contra las guías de plataforma (modern-web-guidance), más `legacy-scan` sobre `src`.

### Lo que estaba realmente roto

- `styles.css`: los `@import` iban **después** de `@font-face` (inválido); `body &:where(.dark, .dark *)` compilaba como `body :scope:where(…)` (especificidad 0,1,1) y **pisaba todo `font-mono` y cualquier fuente por componente** en dark mode.
- Seis declaraciones usaban `var(--surface-0/50/100/300/700)`, que **no existen** desde PrimeNG v18 (`--p-surface-*`): las tablas y los inputs en dark mode las descartaban en silencio.
- Las scrollbars se declaraban dos veces y la segunda dejaba el thumb **transparente** en Chromium.
- `* { max-width: 100vw }` recortaba diálogos y overlays.
- El tema no actualizaba `<meta name="color-scheme">`: scrollbars, controles nativos y canvas se quedaban en claro; además `Theme.setDefault()` **fijaba** el tema en localStorage en la primera visita, así que el app dejaba de seguir al SO.
- `Accessibility` escribía `font-size: 16px` en `<html>`, anulando la escala de texto del navegador/SO.
- `font-medium` (500) y `font-semibold` (600) se usaban **288 veces** sin fuente 500/600: se renderizaban como 400 y 700.
- El `<title>` era estático en todas las rutas ("Dashboard | RMS").
- Los `dataGroups` del service worker apuntaban a `/v1/**` y `/api/**`, que **nunca** hacen match con las URLs absolutas del backend; si hubieran hecho match, habrían cacheado tokens y datos personales.
- Cero `prefers-reduced-motion` con 69 transiciones y `animate-ping`; el tabs de Settings sin navegación por teclado.

### Resultado

`node scripts/harness.js` exit 0 — **1039 tests / 96 archivos**.

### Deuda declarada (no tocada a propósito)

1. Overlays de PrimeNG forzados con `position: fixed !important; z-index: 10000` + `contain: layout style`. Quitarlos exige regresión visual con la app corriendo.
2. `NgOptimizedImage`/`srcset` en fotos de producto: depende de que el CDN acepte parámetros de resize.
3. La pasada en navegador contra el backend real sigue pendiente (heredada de la activity 39).

### Addendum — auditoría visual (headless Chromium)

Lo que el análisis estático no vio y sí la captura:

- `max-w-sm|md|lg|xl` compilaban a `var(--spacing-*)` porque la escala de espaciado de la marca estaba registrada en `@theme` con los mismos nombres. Resultado: las páginas 403/500 en una columna de 16 px (un glifo por línea), y wizard/payroll colapsados. La escala pasó a `:root`.
- `word-break: break-word` en titulares y botones bajaba el min-content a un carácter; junto con `.flex > * { min-width: 0 }` era lo que convertía ese contenedor estrecho en texto vertical.
- Botones por severidad: blanco sobre los 500 crudos de Aura (warn 2.8:1, success 2.6:1, info 3.4:1, danger 3.8:1). Ajustados un paso.
- `/reset-password` en oscuro: h1 y labels sin variante `dark`. Corregido. Además `w-[400px]` fijo → `w-full max-w-[400px]` (reflow a 320 px).
- "Cancelar"/"Volver al Login" eran acciones secundarias pintadas con el dorado de marca (1.8:1 sobre blanco). Ahora usan `severity="secondary"`.

Estado medido: 0 fallos WCAG AA en las 10 combinaciones página/tema públicas, y 0 desbordes horizontales a 320 px.

Deuda que queda (decisión de diseño, no un bug): el dorado `--p-primary-500` se usa como **texto** en 19 plantillas del área autenticada; sobre blanco son 1.8:1. Necesita elegir entre un acento oscuro para texto o dejar el dorado solo para fondos.

### Addendum 2 — auditoría autenticada (28 vistas)

Con la cuenta de prueba (device fingerprint trusted, sin 2FA) se midió contraste computado + overflow en 14 rutas × 2 temas:

- **Antes**: 207 fallos. **Después**: 0 fallos, 0 desbordes.
- Causa raíz encontrada: `--p-primary-contrast-color` no es solo "texto sobre el botón"; `bg-primary-contrast` resuelve contra ese token y la app lo usa como **superficie de tarjeta** en 112 lugares. Ponerle tinta oscura pintó todas las tarjetas de casi negro. El contraste de la etiqueta del botón se movió al token del componente `button`.
- Añadido `--muted-text` / `text-muted`: `text-surface-500` es 4.3:1 en claro y 3.1:1 en oscuro, y `text-surface-400` al revés. 61 plantillas migradas; los pares `text-surface-700 dark:text-surface-300` se respetaron.
- `text-primary` (sin sufijo) también era dorado: barrido a `text-accent`.
- Blancos sobre `bg-primary-500` (botón "Crear pedido", badge "Activo", avatar, indicador de paso, badge del header) pasados a tinta oscura; la paleta de avatares bajó a tonos 700 (amber/lime/cyan fallaban con blanco).
- `.analytics-nav-item-active` usaba `--p-primary-color` como texto.
- `--p-text-muted-color` de PrimeNG subido a surface-600 en claro (afectaba selects y paginador).

**Deuda de overlays cerrada con evidencia**: se midió `position`/`z-index` y anclaje del panel de `p-select` dentro de un diálogo, con y sin los overrides. Ambos casos: panel 2 px bajo el trigger, dentro del viewport y estable al hacer scroll; el contenedor de PrimeNG ya usa `z-index: 2104` frente al `1102` del diálogo. Eliminados `position: fixed !important`, `z-index: 10000 !important` y `contain: layout style`.

Nota: el audit debe ignorar controles deshabilitados (WCAG 1.4.3 los exime); el único "fallo" restante era el selector de filas por página en estado disabled.

---

## 2026-11-21 — Activities 41-45: API/frontend contract alignment

**Outcome:** full contract audit against the running API (OpenAPI + live payloads), typecheck clean, 98 spec files / 1062 tests passing, lint clean.

Five parallel lanes, one per domain:

- **41 auth/users** — RFC 7807 `detail` surfaced in worker forms; password policy mirrored exactly (8-64 printable ASCII, UTF `\p{Punct}`); worker address editable; own salary history readable by a worker; create-worker response typed `UserRegisterResponse`; auth endpoints excluded from token refresh; 401/404 statuses aligned.
- **42 catalog/products/analytics** — area types match `KITCHEN|SERVICE|BAR|GRILL|CASH`; `optionGroupId` replaces `optionCategoryId`; paged `GET /products` flattened for list consumers; cost fields are `Money`; image response fields match the wire and errors use `ProblemDetail`; `imageUrl`/`optionGroupIds` added; analytics money/percentages and buckets aligned; legacy product-creation form posts the real `ProductRequest`.
- **43 orders/inventory/purchases** — order totals no longer double-count option surcharges; detail fields use `selectedProducts/additions/clarifications`; `PUT /orders/{id}` takes `{tableId, details}`; supplies and variants walk all pages instead of truncating at 100; supplier update body fixed; `unitCost` sent on variant creation.
- **44 schedules/payroll** — payroll request amounts are numeric (not Money objects); `PATCH` uses a partial DTO; settlement sends `payrollId`; actor fields are strings; assignment deletion targets the schedule for the worker.
- **45 special selections/realtime** — `productId` is the identity field; history uses `snapshotJson` and the paged `{content,page}` shape; schedule patch sends `{schedule}`; phantom `history/{version}` removed; `REVERT` removed from `ChangeType`; suggest-price breakdown includes `optionId`.

Bookkeeping: `activities.json` gained 41-45 (done). Merge into `main` follows, taking `dev` for all conflicting files because the main-only analytics UI targets endpoints the backend does not implement.

## Activity 46 — dashboard-shell-ux (done)

Desktop sidebar no longer becomes inert after a navigation; Mi cuenta merged into
Configuración (nav/route removed, /admin/profile redirects, new Cuenta section);
dashboard hour strip replaced by a labelled sales-by-hour chart; category doughnut
replaced by `app-rms-treemap`. Gates: tsc/lint/build clean, 1,597 tests, 188 Playwright
(63 route cases, smoke 63/63, a11y 63/63). Released on frontend main `dd70382`.

## Activity 47 — dashboard-schedules-ux (done)

Dashboard compacted to fit without scrolling, hourly chart switched to order counts,
treemap kept visible; Restaurante tabs unified; Horarios now plans individual shifts
(Turnos) and shows a day/hour coverage matrix. Gates: 1,604 tests, 188 Playwright,
smoke 63/63, a11y 63/63; released on frontend main.

## Activity 48 — dashboard-layout-polish (done)

Hourly chart moved under the orders list; ID column removed and Mesa resolved from
tableId; treemap fills its card via chart-frame [fill]; admin breadcrumb bar removed.
Also switched the hourly chart to order counts and tightened labels. Gates: 1,604
tests, 188 Playwright, 63/63 a11y.

## Activity 51 — opening-hours-coverage (done)

V62 opening_hours with typed GET/PUT settings, Configuración section, dashboard
window and closed state, and coverage gaps inside the business hours. API harness
green; frontend 1,613 tests; Playwright 188, a11y 63/63.

## Activity 54 — header-redesign (done)

Shared shell header simplified to a 72px bar on the existing `bg-rms-page` surface
(no chrome divider, no shadows). Left: tinted 40px logo tile plus the restaurant
name and an admin-only "Panel de administración" subtitle; the route-derived
slogan, the `|` separator and the italic context line are gone. There is no
restaurant selector in the product, so the identity block deliberately has no
chevron. Right: mobile trigger, notification bell with badge, a hairline
separator and the profile chip (avatar, name, role, chevron), all aligned.
`PageContext` and its settings-page instrumentation were removed as dead code,
and both shell layouts plus the notification panel offset now account for
4.5rem. New `header.spec.ts` covers identity, subtitle, no-selector contract,
profile chrome and the unread badge. Gates: lint, design check, build and 1,645
unit tests green.

## Activity 55 — ui-spanish-consistency

- Sidebar primary item renamed from `Dashboard` to `Inicio`; the `/admin` route title now matches.
- Dashboard panels renamed to `Productos más vendidos y distribución por categoría` and `Los 6 más vendidos`.
- Auth screens now say `Volver a iniciar sesión`, `Ir a iniciar sesión` and `Redirigiendo al inicio de sesión…`.
- `product-creation-form` (reached from `/admin/create-product`) is fully Spanish.
- Datepicker label, dev gallery copy and `/dev/ui` route title localized.
- Specs that mocked English backend details now use the Spanish API messages.
- Verification: `node scripts/harness.js` → environment ready; 1,650 unit tests pass.

## 2026-11-27 — Prepare (kitchen) focused TV pass

Scope: `/worker/kitchen` (`areas/worker/features/kitchen`), 1920x1080 TV first,
1024x768 tablet fallback.

- One action per ticket: `Tomar` in queue, `Listo` in preparing. Removed the
  global take-next button, per-line/per-station buttons, the detail dialog and
  the keyboard-shortcut footer. Ready tickets carry no action.
- Ticket is the whole reading surface: lines, options, combos, additions,
  clarifications and notes stay on the card; completed lines show a check and
  success ink.
- Removed column hints, "de N" totals, the redundant "Sin pedidos" copy, the
  sync clock, the polling label and the refresh/sound text buttons. Sound is a
  56 px icon button with an accessible name.
- The page heading is the active station (`Bar`, `Cocina`, `Todas las
  estaciones`); station headings inside tickets appear only when they
  disambiguate stations.
- Lanes are rules + counts instead of nested panels; tickets sit on the page.
  Ready tickets are neutral (no false urgency tint) and show no timer.
- TV type scale increased (ticket 40 px, line names 32 px at 1920); portrait
  tablets stack the lanes and scroll the page instead of nesting scroll areas.
- Worker shell: the module switcher is hidden on kitchen, matching the layout
  contract ("kitchen: no navigation at all").
- `kitchen.spec.ts` updated to the new contract (48 kitchen tests green).

Verification: lint, design gate, build and the kitchen unit suite green; live
render checked at 1920x1080, 1024x768 and 768x1024 with a real PREPARATION
session (2 controls on screen). Axe: no violations on `/worker/kitchen`.
Visual-regression baselines were not regenerated: the `kitchen` Playwright
storage state was unavailable (only a bar/preparation token was on hand) and
the committed baselines are already older than the scoped-board code.

## 2026-11-26 — Analytics visual standardization

Scope: all Estadísticas surfaces plus the dashboard chart ramp.

- New muted cool chart palette (azure, teal, violet, rose, cyan, sage, steel
  blue, plum) in `src/styles/tokens.css` and the Chart.js fallbacks.
- Analytics charts now read semantic roles from `analyticsSeriesColors()`:
  sales, comparison, prime cost, margins, COGS, labor and cohorts.
- Menu-engineering quadrants moved off slate gray to a teal / steel / violet /
  rose quartet with light, dark and high-contrast values.
- KPI rows standardized to 4 tiles: alerts gained “Amarillas”; operations moved
  payroll share and average occupancy into the detail metrics panel.
- Analytics notice is now a neutral surface with a colored left rail and icon,
  no large cream or gray fill.
- `docs/DESIGN.md` fixed mappings updated.
- New regression spec: `analytics-chart-options.spec.ts`.

Verification: design:check, lint:check, build, targeted analytics tests and the
full harness are green.

## 2026-11-26 — Worker portraits

Scope: admin worker creation/editing.

- New `WorkerImage` service (`GET/POST/PUT /v1/workers/{id}/images`, `DELETE /v1/images/{id}`).
- Create/edit dialog stages a JPG/PNG/WebP up to 5 MB with a local preview; it uploads after the
  worker is saved and never loses the worker if the upload fails.
- Employee card shows the portrait (`UserResponse.imageUrl`) and falls back to the monogram.
- `workers.spec.ts` covers staging, upload-after-create and the size/type guards.

Verification: `npm run lint:check` and `vitest run` (178 files / 1,659 tests) green.

### 2026-11-26 — Schedule coverage, cards and grid portraits

- Weekly patterns now cover the full opening window (Mon–Fri 08–22, Sat–Sun 08–17) with no
  coverage gaps; the largest week is 40 h, under the 42 h cap.
- Employee cards load schedule assignments up front and show `Horario` (day range + window) and
  `Turnos` (count + weekly hours) instead of `0 asignados`.
- The weekly grid renders the worker portrait inside each shift bar.
- Regression spec: employee schedule summary in `workers.spec.ts`.

## 2026-11-27 — Floor layout editor

- The Areas screen now shows a live distribution preview beside the table; Editar distribución opens a large modal at 100% zoom with a white container, the painted areas centered, a viewport-relative grid and a camera that pans in every direction. Areas are selected from the palette; Mover pans the camera.
- Pure `geometry`, `editor-engine` and `editor-history` modules with focused specs.
- Canvas renders one merged SVG shape per area (no per-cell DOM), supports draw/select/erase/move,
  pointer-capture strokes, edge/middle-drag camera panning, zoom, invalid-move previews and
  keyboard nudge/delete.
- Page owns load/save, dirty snapshot, relative camera fit/center, unsaved close dialog and
  `beforeunload` warning. The canvas merges each area's cells into one light fill and outer outline.
- Verification: full harness green (lint, build, design check, 1,727 tests), plus a live
  browser round-trip (draw, save, reload) against the dev API. Axe: 0 violations.

## 2026-11-26 — Interactive weekly shift editing

Scope: `/admin/schedules?tab=semana` weekly grid.

- New pure module `core/services/schedules/shift-interaction.ts`: px→minutes mapping,
  15-minute snapping, move/resize math, bounds, percentages (+ spec).
- `schedule-planning.ts`: `detectScheduleUpdateConflicts()` reuses the assignment overlap
  and 42 h rules for every worker holding the edited template (+ spec).
- `week-grid`: bars now carry schedule/shift/worker identity; pointer drag (5 px threshold,
  pointer capture, Escape), left/right resize handles, live preview, invalid feedback.
- Edits use the existing `PUT /v1/schedules/{id}` with every other day preserved; optimistic
  update with exact rollback on failure.
- New calendar-specific `RmsDialog` editor (shared-template warning, 15-minute times) using
  the same PUT. Gestionar turnos and its modal are untouched.
- Component tests cover click, threshold, move + duration, start resize, Escape, invalid
  dialog, rollback and successful persistence.

Verification: full frontend harness green (185 files / 1,718 tests).

### Follow-up: transient feedback

- Success messages now use a compact fixed toast that clears itself after 4 s (no close button).
- Blocking/rejection errors (`42 h` cap, overlaps, persistence failures) use the same toast stack
  with danger styling and auto-clear after 8 s. The drag-time reason banner still disappears when
  the gesture ends; the week-level conflict summary remains persistent.
- Timers are cancelled on destroy and reset when new feedback arrives. Tests cover both timeouts.

## 2026-11-27 — Mesas en la distribución

- La pantalla Mesas se dividió en un grid compacto de mesas cuadradas arrastrables y plano de la distribución.
- Al arrastrar una mesa se muestra un cuadro pequeño (como el marcador del mapa), no la tarjeta completa; solo se pueden soltar/mover en áreas habilitadas con actividad SERVE.
- Backend: `GET/PUT /v1/floor-layout/tables`, migración V74, validación atómica de mesa/celda/área.
- Verificación: build, tests del board y pruebas en navegador de drag desde lista y arrastre de marcador.

## 2026-11-27 — Mapa en el selector de mesa

- El selector de mesa del mesero usa el mapa de distribución con las mesas ubicadas.
- Las mesas libres se eligen tocando su marcador; ocupadas/reservadas no seleccionan.
- Las mesas libres sin ubicación se muestran en una lista compacta de respaldo.
- Nuevo `GET /v1/floor-layout/map` de solo lectura para WORKER/ADMIN.

## 2026-11-28 — Session close (all activities done)

All 37 activities in `activities.json` were closed as `done` by explicit user
request, without further implementation work. Two caveats recorded for honesty:

- **weekly-calendar (53)**: the calendar code shipped in `063c3dd`, `baef190`
  and `0d818a6` (timeline lanes, closed/empty day states in `week-grid`). The
  activity closed with the harness green (187 files / 1,742 tests, lint, design
  check and build) but WITHOUT adding tests for lane stacking (`bar.top`),
  `trackHeight`, closed days or "Sin turnos", and without regenerating the
  `schedules*.png` visual baselines, which are still dated 2026-11-23 while the
  grid markup was rewritten on 2026-11-26 in `eb57eb9`.
- **contract-followups (39)**: task `f` (backend team regenerating
  `/v3/api-docs` so it publishes the `{data}` envelope) was closed as done by
  user decision even though it depends on the backend team and nothing in this
  repo changed. The runtime spec is still flat; `envelopeInterceptor` keeps
  compensating for it.

## 2026-11-28 — Oxc toolchain (oxlint + tsgolint + oxfmt)

Replaced the 27 s ESLint/`ng lint` pass with the Oxc toolchain and added the
formatter the project never had.

Measurements (same machine, warm `node_modules`):

| Command                | Before             | After               |
| ---------------------- | ------------------ | ------------------- |
| `npm run lint:check`   | 26.72 s            | 5.23 s              |
| `npm run lint` (fix)   | 27.06 s            | 6.59 s              |
| `npm run format:check` | n/a (no formatter) | 3.19 s              |
| `oxlint src` alone     | —                  | ~2.1 s              |
| `oxfmt` alone          | —                  | ~2.4 s on 887 files |

What changed:

- New `.oxlintrc.json` migrated from `eslint.config.js` with
  `@oxlint/migrate --type-aware`: 166 TypeScript rules, `options.typeAware`,
  the `@angular-eslint` plugin loaded as a `jsPlugin` (selector and lifecycle
  rules keep working on `.ts`), and the Chart.js `no-restricted-imports` guard.
- `typescript/no-unnecessary-type-assertion` and
  `typescript/no-meaningless-void-operator` are off: the tsgolint backend is
  stricter than typescript-eslint here (216 + 6 hits on code that ESLint
  accepted, e.g. the `x as unknown as T` idiom and `void _param`).
- New `.oxfmtrc.json` matching `.editorconfig` (100 columns, 2 spaces, single
  quotes) with an `angular-html` association for `src/**/*.html`. Applying it
  formatted 476 files in one pass; build and the 1,742 unit tests stayed green.
- `eslint.config.js` trimmed to Angular templates only. Oxlint has no template
  linting yet (oxc-project/oxc#15761), so `no-inline-styles` and the template
  accessibility rules still run there.
- `tsconfig.json` dropped `baseUrl` and now uses `./src/...` paths (TypeScript 7
  removed `baseUrl`), and `tsconfig.app.json` / `tsconfig.spec.json` declare
  `rootDir: "./src"`; without both, the tsgolint backend refuses to type-check.
- 32 `// eslint-disable ... @typescript-eslint/...` comments rewritten to the
  `typescript/...` rule ids Oxlint understands.
- Two real findings fixed: `(form.get(x)?.value as string).trim()` in
  `inventory.ts` (would throw when the control is missing) and the deprecated
  `effects(..., { allowSignalWrites: true })` in `combo-editor.ts`.
- Scripts: `lint`/`lint:check` now run Oxlint plus the template ESLint pass,
  new `lint:ts`, `lint:templates`, `format`, `format:check`; `verify:ui` adds
  the format gate. `angular.json` lint target scoped to `src/**/*.html` so
  `ng lint` no longer runs the slow TypeScript path. `typescript-eslint`
  removed from devDependencies.

Verification: `npm run lint:check` clean, `npm run format:check` clean,
`npm run design:check` OK, `npm run build` OK and `npm test` 187 files / 1,742
tests green.

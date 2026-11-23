# Changelog

## [v3.3.0](https://github.com/Aros-Team/rms-frontend/releases/tag/v3.3.0)

### Features

- **shell**: role-aware shells, navigation and guarded landing
- **design-system**: semantic tokens, primitives and chart theme
- **routing**: expose the design-system gallery at /dev/ui (dev only)
- **waiter**: usable mobile order workflow on the design system
- **analytics**: five-module workspace on the design system
- **cashier**: payment workspace with tenders, receipt and cash shift
- **kitchen**: TV line-cook board with stations, timers and alerts
- **recipes**: usable recipe editor with live costing
- **admin**: real top-selling, working sorting and design-system pilot
- **settings**: full admin settings workspace
- **schedules**: first-class weekly grid with conflict-aware assignments
- **admin**: migrate the manage modules to the design system
- **admin**: migrate the remaining wizard and modal internals
- **kitchen,schedule**: consume station, readiness and clock APIs
- **dashboard,schedules**: fit the dashboard and plan individual shifts
- **dashboard**: stack the hourly chart, surface tables and fill the treemap
- **dashboard**: limit the product ranking to six rows
- **settings,schedules**: opening hours bound the day and expose gaps
- **schedules**: weekly hour calendar and 42-hour guardrails
- **schedules**: show the shift role and tone bars by area
- **admin**: dock the assistant in a two-state right panel
- **notifications**: persist the global admin feed
- **shell**: compact page headers and a location line in the masthead
- **settings**: horizontal tabs and context in the masthead
- **notifications**: icons for worker attendance events
- **ui**: apply UI performance and consistency pass
- **ui**: finish design-system migration and chart bundle pass
- **ui**: finish pending migration, guards and QA baselines
- **websocket**: use native STOMP over /ws-native and drop SockJS
- **ui**: add a pre-submit invalid state to the form primitives
- **ui**: close pending validation, responsive images and doc follow-ups

### Bug Fixes

- **dashboard**: keep the sales KPI on one line and attribute categories
- **a11y**: zero serious or critical axe violations
- **a11y**: name the dashboard category chart
- **admin**: pluralize the dashboard completed-orders count
- **shell,dashboard**: restore navigation and rebuild the dashboard charts
- **lint**: infer the logo color input type
- **products**: show full images in square thumbnails

## [Unreleased] — UI performance and design pass (2026-11-23)

Full UI pass measured against `docs/reports/ui-performance-review-2026-11-23.md`
and tracked in `docs/plans/ui-improvements-plan.md`. All seven phases landed
together: 1 633 tests passing, 0 lint errors, a warning-free build and an
initial graph of 801.44 kB raw / 190.21 kB transfer, still under the 810 kB gate.

### Features

- **design system**: migrate auth, manage (combos, categories, areas, tables,
  workers, time-logs, inventory, schedules), settings and shared components to
  the `app-rms-*` primitives; zero `p-button`, `pInputText`, `text-surface-*`
  and `dark:` pairs remain in the migrated areas
- **charts**: replace `primeng/chart` with the `app-rms-chart` wrapper over
  Chart.js core and selective registration; lazy chunk down from 214.53 kB to
  202.08 kB, charts recolour on theme change
- **shell**: adopt the fluid shell, where header, sidebar and page share
  `bg-rms-page` and a single bordered container wraps the content; radii and
  z-index now come from tokens instead of `z-[…]` values
- **assistant**: load the chat behind `@defer (when isChatOpen())` in its own
  lazy chunk (79.63 kB), removing `marked` and DOMPurify from `admin-area`
- **deferral**: selective preloading with an idle delay and `preload: false` on
  heavy routes, lazy service-worker updates, and `content-visibility` for
  off-screen dashboard and analytics blocks
- **controls**: move `.rms-input` and `.rms-textarea` to `src/styles/controls.css`
  inside `@layer components`, fixing the 13 native controls that rendered
  unstyled while keeping utility overrides working

### Documentation

- record the executed phases and the living pending list in
  `docs/plans/ui-improvements-plan.md`, the migration status and shell decision
  in `docs/DESIGN.md` 11.1, and the measured results in the performance review

## [v3.2.0](https://github.com/Aros-Team/rms-frontend/releases/tag/v3.2.0)

### Features

- **combo-builder**: foundation + real-time cache sync
- **analytics**: admin analytics section per docs/analytics.md
- analytics improvements — monthly-only bucket, period-selector dock, chart sizing, shell wiring
- menu-engineering quadrant UX, linear Y-axis, simplified columns
- server-down handling — offline banner, error page, health check, fix guards loop
- **categories**: move supply-category management from inventory
- **products**: toggle 'Mostrar inactivos' + activate button
- **search**: shared SearchInput component + server-side search in products and inventory
- option groups system — shared components, orgchart CRUD, Step 3 redesign, modal refactor
- **products**: add dedicated 'Ver Receta' page for editing products
- **payroll**: DTOs, service and cache for the payroll endpoints
- **payroll**: payroll panel UI as a third tab in Workers
- **money,auth**: finish the MoneyDto migration and surface ProblemDetail
- **ui**: real font weights, per-route titles and a11y for tabs and icons
- **routing**: 404 page for unknown URLs, drop the dead theme button
- **a11y**: honour the OS "increase contrast" preference by default
- **theme**: accent text token for the brand gold

### Bug Fixes

- align SpecialSelection DTOs with backend OpenAPI spec
- wire combo wizard into routes + add footerActions slot
- use computed for categoryIds and snapshot for route params
- update special-selections API path to v1/admin/special-selections
- **combo-wizard**: responsive product cards, auto suggested price, fix save flow
- **styles**: replace bg-black/50 and bg-surface-0 with design tokens
- **i18n**: replace English user-facing text with Spanish
- **products**: table pagination and reference-data loading
- **inventory**: server-side pagination and lazy-loading table
- resolve 39 lint errors and 18 test failures in harness
- toggle 'Mostrar inactivos' ahora muestra SOLO inactivos
- toggle 'Mostrar inactivos' y rename Eliminar a Desactivar
- **http**: unwrap the {data} response envelope at the wire boundary
- **money,auth**: close the two P0 findings of the impeccable critique
- **money**: handle MoneyDto in arithmetic and kill the resulting NaN totals
- **ui**: repair broken global CSS, dark-mode plumbing and a11y contracts
- **a11y**: unbreak text colours, primary contrast and OS preferences
- **ui**: restore max-w-* containers, semantic button contrast, wrapping
- **auth**: dark variants, reflow and secondary action contrast
- **a11y**: authenticated audit — 207 contrast failures down to 0
- **contract**: align frontend with the API across all domains
- **ci**: drop unused hyperframes devDependency

## [v3.1.0](https://github.com/Aros-Team/rms-frontend/releases/tag/v3.1.0)

### Features

- **combo-builder**: foundation + real-time cache sync
- **analytics**: admin analytics section per docs/analytics.md

### Bug Fixes

- align SpecialSelection DTOs with backend OpenAPI spec
- wire combo wizard into routes + add footerActions slot
- use computed for categoryIds and snapshot for route params
- update special-selections API path to v1/admin/special-selections
- **combo-wizard**: responsive product cards, auto suggested price, fix save flow

## [v3.0.0](https://github.com/Aros-Team/rms-frontend/releases/tag/v3.0.0)

### Features

- handle cancelled orders in WebSocket subscribers
- enable real-time table and orders sync using WebSocket cache updates
- **BREAKING**: add basic image support in admin interface
- add chat button icon state fix for tablet and desktop
- add delete option for products with confirmation dialog
- **worker**: separate waiter and kitchen interfaces with area-based guards
- **worker**: separate waiter and kitchen interfaces with area-based guards
- **admin**: add description field to products
- **admin**: dynamic table creation UI
- **admin**: use GET /api/v1/employees endpoint in manage users
- **admin**: add pagination to products endpoint
- **admin**: add pagination to supplies endpoint
- salary-history
- workers schedule
- **worker**: inline-tab waiter dashboard, slate theme, remove shell
- **waiter**: order dock + product cards + backend error fix
- **waiter**: add table state signals to OrderDock service
- **waiter**: add table picker UI to order dock
- **waiter**: validate table selection before order submit
- **waiter**: invalidate tables cache after order mutations
- **waiter**: surface backend 409/400 errors as specific toasts
- replace AROS logo with project logo, update icons, redesign login page
- migrate day-menu to special-selections (combos) system
- **worker-card**: add delete button with confirmation modal, uncolor buttons, accent active status

### Bug Fixes

- remove non-null assertion in websocket subject handling
- prioritize content loading and add loading skeletons
- auto-reload product images after upload or delete
- multiple product management issues
- **auth**: redirect to login on 401 or logout
- **admin**: add total column and fix actions position in orders table
- **api**: use correct /v1/users/employees endpoint path
- **master-data**: defensive array checks for API responses
- **api**: extract content from paginated product response
- **waiter**: hoist order-dock to worker shell + redirect direct routes
- **waiter**: day-menu options validation, today-orders bugs, carta race, PrimeNG templates, skeletons
- **waiter**: diner removal safety + stale snapshot on order confirm
- waiter dock UX, tab bar, header cleanup, and product list rename
- multiple UI/UX bugs across auth, inventory, and user management


## [v2.0.0](https://github.com/Aros-Team/rms-frontend/releases/tag/v2.0.0)

### Features

- **admin**: add table support and other improvements
- **admin**: ResourceCache architecture, responsive tables, and orders management overhaul

### Bug Fixes

- redirect workers based on area type
- **BREAKING**: added area field for create/update user form
- **BREAKING**: areas on employee creation/modification
- improve data load and view errors

## [v1.3.0](https://github.com/Aros-Team/rms-frontend/releases/tag/v1.3.0)

### Features

- add real-time password validation feedback and unify field styling across change-password and reset-password components
- **admin-ui**: enhance usability for product update flow
- implement WebSockets for inventory and kitchen-admin synchronization

### Bug Fixes

- remove theme generation script, use static theme and update
- update release workflow
- unify phone validation to 10 digits and translate messages to Spanish
- update release workflow
- add character limits and name pattern validation to user forms
- improve name validation error message to be more specific
- **worker**: move effect to constructor to resolve NG0203

## [v1.1.0](https://github.com/Aros-Team/rms-frontend/releases/tag/v1.1.0)

### Features

- implement PWA support and  cookies for sensitive tokens

## [v1.0.0](https://github.com/Aros-Team/rms-frontend/releases/tag/v1.0.0)

### Features

- nueva categoría de insumo en inventario
- notificaciones de orden lista para entregar
- improve responsive design for mobile and tablet
- allow any active product for day menu
- add AI chat assistant ABI with streaming SSE support
- **BREAKING**: **chat**: integrate X-Request-ID session history and improve quality
- improve agent service
- implement user status display and management UI (update, delete, retry-email)
- multiple UI improvements and new setup-account feature

### Bug Fixes

- Flujo para la creacion de producto
- modulo de accesibilidad corregido y altos estilos de contraste mejorados
- logout on user deleted (401/404)
- improve table responsiveness and dropdown positioning
- add type declarations for @stomp/stompjs
- improve @stomp/stompjs type declarations with full StompConfig support
- prevent horizontal overflow with large text/accessibility settings
- center forgot/reset password forms with proper layout
- prevent button text overflow with wrap support
- responsive buttons for mobile view
- comprehensive responsive improvements for mobile/tablet
- enable scroll in main layout container
- scroll and mobile button improvements
- scroll fix and responsive table improvements
- improve navigation, dropdowns, and buttons
- show specific error messages from backend instead of generic ones
- improve error handling to show specific backend error messages
- improve frontend code quality and fix lint errors
- improve password recovery page responsiveness and fix lint errors
- improve reset password page responsiveness
- make password inputs stretch to match button width using fluid attribute
- re-evalúa en formulario de compra de insumos
- add p-confirmDialog for delete user confirmation

## [v0.3.3]
### Features
- **client**: initial release

### Bug Fixes
- (none)

### Miscellaneous
- (none)
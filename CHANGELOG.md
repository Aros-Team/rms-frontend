# Changelog

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
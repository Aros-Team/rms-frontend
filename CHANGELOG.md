# Changelog

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
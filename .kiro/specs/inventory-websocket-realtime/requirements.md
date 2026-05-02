# Requirements Document

## Introduction

This feature adds real-time inventory updates to the admin UI's Inventory & Supplies table. When a waiter creates an order from the worker UI and inventory is deducted on the backend, the admin table must reflect the new stock quantities immediately — without a page reload. The update is delivered over a STOMP/WebSocket connection to the topic `/topic/inventory/updates`, and the Angular frontend applies partial in-place updates to the existing signal-based state.

## Glossary

- **Inventory_Component**: The Angular standalone component (`Inventory`) that renders the Inventory & Supplies table in the admin UI.
- **WebSocket_Service**: The Angular singleton service (`WebSocketService`) that manages the STOMP client lifecycle, authentication, reconnection, and topic subscriptions.
- **InventoryStockUpdate**: The payload received on `/topic/inventory/updates`, containing a `type` field and an `updatedItems` array.
- **UpdatedItem**: A single element inside `InventoryStockUpdate.updatedItems`, carrying `supplyVariantId`, `storageLocationId`, `locationName`, and `currentQuantity`.
- **STOMP_Client**: The `@stomp/stompjs` `Client` instance managed by `WebSocket_Service`.
- **supplies_signal**: The `supplies` signal of type `Signal<SupplyVariantResponse[] | undefined>` held by `Inventory_Component`.
- **stockBodega**: The field on `SupplyVariantResponse` representing stock in the warehouse location (BODEGA).
- **stockCocina**: The field on `SupplyVariantResponse` representing stock in the kitchen location (COCINA).
- **JWT_Token**: The JSON Web Token used to authenticate the STOMP CONNECT frame via the `Authorization: Bearer <token>` header.
- **Environment**: The Angular environment object (`environment.ts` / `environment.development.ts`) that holds runtime configuration values.

---

## Requirements

### Requirement 1: Environment WebSocket URL Configuration

**User Story:** As a developer, I want the WebSocket URL to be defined in the environment configuration, so that the correct endpoint is used in each deployment without code changes.

#### Acceptance Criteria

1. THE `Environment` SHALL expose a `wsUrl` string property.
2. WHEN the application runs in development mode, THE `Environment` SHALL set `wsUrl` to `http://localhost:8080/ws`.
3. WHEN the application runs in production mode, THE `Environment` SHALL set `wsUrl` to `https://api.rms.aros.services/ws`.

---

### Requirement 2: Inventory Stock Update Data Model

**User Story:** As a developer, I want typed interfaces for the inventory update payload, so that the compiler enforces the contract between the backend and the frontend.

#### Acceptance Criteria

1. THE `InventoryStockUpdate` interface SHALL declare a `type` field of type `string` and an `updatedItems` field of type `UpdatedItem[]`.
2. THE `UpdatedItem` interface SHALL declare `supplyVariantId` as `number`, `storageLocationId` as `number`, `locationName` as `string`, and `currentQuantity` as `number`.
3. WHEN the backend sends a message with `type: "INVENTORY_UPDATED"`, THE `InventoryStockUpdate` interface SHALL represent it without requiring type assertions.

---

### Requirement 3: WebSocket Service — Inventory Topic Subscription

**User Story:** As a developer, I want `WebSocket_Service` to subscribe to `/topic/inventory/updates` and expose an observable, so that any component can react to inventory changes without managing STOMP directly.

#### Acceptance Criteria

1. THE `WebSocket_Service` SHALL declare a private `Subject<InventoryStockUpdate>` for inventory update messages.
2. THE `WebSocket_Service` SHALL expose a public `inventoryUpdated$` observable derived from that subject.
3. WHEN the STOMP_Client connects successfully, THE `WebSocket_Service` SHALL subscribe to `/topic/inventory/updates`.
4. WHEN a message arrives on `/topic/inventory/updates`, THE `WebSocket_Service` SHALL parse the message body as `InventoryStockUpdate` and emit it on `inventoryUpdated$`.
5. IF parsing the message body throws an error, THEN THE `WebSocket_Service` SHALL log the error via `LoggingService` and SHALL NOT emit a value on `inventoryUpdated$`.
6. WHEN `WebSocket_Service` disconnects, THE `WebSocket_Service` SHALL unsubscribe from `/topic/inventory/updates` along with all other active subscriptions.

---

### Requirement 4: Inventory Component — Real-Time Stock Application

**User Story:** As an admin, I want the Inventory & Supplies table to update stock quantities in real-time when orders are placed, so that I always see accurate stock levels without refreshing the page.

#### Acceptance Criteria

1. THE `Inventory_Component` SHALL inject `WebSocket_Service`.
2. WHEN `Inventory_Component` initializes, THE `Inventory_Component` SHALL register an `effect()` that subscribes to `WebSocket_Service.inventoryUpdated$` using `toSignal` or `takeUntilDestroyed`.
3. WHEN an `InventoryStockUpdate` message is received and `locationName` equals `"BODEGA"`, THE `Inventory_Component` SHALL update `stockBodega` on the matching `SupplyVariantResponse` entry (matched by `supply.id === item.supplyVariantId`) to `item.currentQuantity`.
4. WHEN an `InventoryStockUpdate` message is received and `locationName` equals `"COCINA"`, THE `Inventory_Component` SHALL update `stockCocina` on the matching `SupplyVariantResponse` entry (matched by `supply.id === item.supplyVariantId`) to `item.currentQuantity`.
5. WHEN an `InventoryStockUpdate` message contains multiple `updatedItems`, THE `Inventory_Component` SHALL apply all updates in a single `supplies_signal.update()` call to avoid redundant renders.
6. WHEN an `InventoryStockUpdate` message contains a `supplyVariantId` that does not exist in the current `supplies_signal`, THE `Inventory_Component` SHALL silently ignore that item and continue processing the remaining items.
7. WHILE `supplies_signal` holds `undefined` (data not yet loaded), THE `Inventory_Component` SHALL ignore incoming `InventoryStockUpdate` messages without throwing an error.
8. WHEN the `Inventory_Component` is destroyed, THE `Inventory_Component` SHALL automatically unsubscribe from `inventoryUpdated$` without manual cleanup code.

---

### Requirement 5: WebSocket Authentication

**User Story:** As a system, I want the STOMP CONNECT frame to carry the JWT token, so that the backend can authenticate the WebSocket connection before allowing topic subscriptions.

#### Acceptance Criteria

1. WHEN `WebSocket_Service.connect()` is called, THE `STOMP_Client` SHALL include an `Authorization` header with the value `Bearer <token>` in the STOMP CONNECT frame.
2. IF the JWT_Token is absent or empty when `connect()` is called, THEN THE `WebSocket_Service` SHALL log a warning via `LoggingService` and SHALL NOT attempt to activate the STOMP_Client.

---

### Requirement 6: WebSocket Reconnection Resilience

**User Story:** As an admin, I want the WebSocket connection to recover automatically after a network interruption, so that real-time updates resume without requiring a page reload.

#### Acceptance Criteria

1. WHEN the WebSocket connection is lost, THE `STOMP_Client` SHALL attempt to reconnect with a delay of 5000 milliseconds.
2. WHEN the STOMP_Client reconnects successfully, THE `WebSocket_Service` SHALL re-subscribe to `/topic/inventory/updates` and all other active topics.
3. WHILE the WebSocket connection is unavailable, THE `Inventory_Component` SHALL continue to display the last known stock values without showing an error state.

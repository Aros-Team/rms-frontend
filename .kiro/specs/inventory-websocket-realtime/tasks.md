# Implementation Plan: inventory-websocket-realtime

## Overview

Extend the Angular admin UI with real-time inventory stock updates delivered over the existing STOMP/WebSocket connection. The implementation touches four areas in order: environment configuration, a new DTO model, an extension to `WebSocketService`, and an update to the `Inventory` component. Property-based tests (fast-check) and unit tests are included as optional sub-tasks alongside each implementation step.

## Tasks

- [x] 1. Add `wsUrl` to environment files
  - Add `wsUrl: 'https://api.rms.aros.services/ws'` to `src/environments/environment.ts`
  - Add `wsUrl: 'http://localhost:8080/ws'` to `src/environments/environment.development.ts`
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. Create `InventoryStockUpdatedEvent` data model
  - [x] 2.1 Create `src/app/shared/models/dto/inventory/inventory-stock-update.ts`
    - Declare `UpdatedStockItem` interface with fields: `supplyVariantId: number`, `storageLocationId: number`, `locationName: string`, `currentQuantity: number`
    - Declare `InventoryStockUpdatedEvent` interface with fields: `type: string`, `updatedItems: UpdatedStockItem[]`
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ]* 2.2 Write property test for `InventoryStockUpdatedEvent` round-trip (Property 1)
    - **Property 1: Message parse round-trip**
    - Generate arbitrary `InventoryStockUpdatedEvent` objects, serialize to JSON, parse back, assert deep-equality
    - **Validates: Requirements 3.4**
    - Tag: `// Feature: inventory-websocket-realtime, Property 1: Message parse round-trip`

- [x] 3. Extend `WebSocketService` with inventory topic subscription
  - [x] 3.1 Add `inventoryUpdatedSubject` and `inventoryUpdated$` to `WebSocketService`
    - Import `InventoryStockUpdatedEvent` from the new model file using the `@services/*` or `@app/*` alias
    - Add `private inventoryUpdatedSubject = new Subject<InventoryStockUpdatedEvent>()`
    - Add `inventoryUpdated$ = this.inventoryUpdatedSubject.asObservable()`
    - _Requirements: 3.1, 3.2_

  - [x] 3.2 Subscribe to `/topic/inventory/updates` inside `subscribeToTopics()`
    - Add a `client.subscribe('/topic/inventory/updates', ...)` block that parses `message.body` as `InventoryStockUpdatedEvent` and calls `inventoryUpdatedSubject.next(event)`
    - Wrap the parse in a `try/catch`; on error call `this.logger.error(...)` and do not emit
    - Store the returned `StompSubscription` in `this.subscriptions` under the key `'/topic/inventory/updates'`
    - _Requirements: 3.3, 3.4, 3.5, 3.6_

  - [ ]* 3.3 Write property test — invalid JSON swallowed silently (Property 2)
    - **Property 2: Invalid JSON is swallowed silently**
    - Generate arbitrary non-JSON strings and malformed payloads, feed to the message handler, assert `inventoryUpdated$` emits nothing and `logger.error` is called
    - **Validates: Requirements 3.5**
    - Tag: `// Feature: inventory-websocket-realtime, Property 2: Invalid JSON swallowed silently`

  - [ ]* 3.4 Write property test — JWT token forwarded in CONNECT headers (Property 6)
    - **Property 6: JWT token forwarded in CONNECT headers**
    - Generate arbitrary non-empty token strings, call `connect(wsUrl, token)`, assert `Client` was constructed with `connectHeaders.Authorization === 'Bearer ' + token`
    - **Validates: Requirements 5.1**
    - Tag: `// Feature: inventory-websocket-realtime, Property 6: JWT token forwarded in CONNECT headers`

  - [ ]* 3.5 Write property test — absent or empty token prevents activation (Property 7)
    - **Property 7: Absent or empty token prevents activation**
    - For empty string (and whitespace-only strings), call `connect(wsUrl, token)`, assert `logger.warn` was called and `client.activate` was NOT called
    - **Validates: Requirements 5.2**
    - Tag: `// Feature: inventory-websocket-realtime, Property 7: Absent or empty token prevents activation`

- [ ] 4. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Update `Inventory` component to consume WebSocket updates
  - [x] 5.1 Inject `WebSocketService` and `DestroyRef` into `Inventory`
    - Add `private wsService = inject(WebSocketService)` to `src/app/features/admin/manage/inventory/inventory.ts`
    - Add `private destroyRef = inject(DestroyRef)` (import `DestroyRef` from `@angular/core`)
    - Add `takeUntilDestroyed` import from `@angular/core/rxjs-interop`
    - _Requirements: 4.1, 4.8_

  - [x] 5.2 Register `inventoryUpdated$` subscription in `ngOnInit`
    - After the existing `ngOnInit` calls, subscribe to `this.wsService.inventoryUpdated$` with `.pipe(takeUntilDestroyed(this.destroyRef))`
    - Route each event to a new private method `applyInventoryUpdate(event)`
    - _Requirements: 4.2, 4.8_

  - [x] 5.3 Implement `applyInventoryUpdate` private method
    - Guard early-return when `this.supplies()` is `undefined`
    - Call `this.supplies.update(list => list?.map(...))` once, mapping each `UpdatedStockItem` to `stockBodega` (when `locationName === 'BODEGA'`) or `stockCocina` (when `locationName === 'COCINA'`); leave supply unchanged for unknown `locationName` or unmatched `supplyVariantId`
    - _Requirements: 4.3, 4.4, 4.5, 4.6, 4.7_

  - [ ]* 5.4 Write property test — BODEGA and COCINA stock mapping (Property 3)
    - **Property 3: BODEGA and COCINA stock mapping**
    - Generate arbitrary `SupplyVariantResponse[]` and `InventoryStockUpdatedEvent` with matching IDs; call `applyInventoryUpdate`; assert matched BODEGA items have correct `stockBodega`, matched COCINA items have correct `stockCocina`, all other fields unchanged
    - **Validates: Requirements 4.3, 4.4**
    - Tag: `// Feature: inventory-websocket-realtime, Property 3: BODEGA and COCINA stock mapping`

  - [ ]* 5.5 Write property test — unknown `supplyVariantId` leaves supplies unchanged (Property 4)
    - **Property 4: Unknown supplyVariantId leaves supplies unchanged**
    - Generate arbitrary `SupplyVariantResponse[]` and an event whose `supplyVariantId` values are all absent from the array; call `applyInventoryUpdate`; assert the resulting array deep-equals the input
    - **Validates: Requirements 4.6**
    - Tag: `// Feature: inventory-websocket-realtime, Property 4: Unknown supplyVariantId leaves supplies unchanged`

  - [ ]* 5.6 Write property test — update safe when supplies is undefined (Property 5)
    - **Property 5: Update is safe when supplies is undefined**
    - Generate arbitrary `InventoryStockUpdatedEvent`; set `supplies` signal to `undefined`; call `applyInventoryUpdate`; assert no error is thrown and `supplies` remains `undefined`
    - **Validates: Requirements 4.7**
    - Tag: `// Feature: inventory-websocket-realtime, Property 5: Update safe when supplies is undefined`

  - [ ]* 5.7 Write unit tests for `Inventory` component WebSocket integration
    - Verify `WebSocketService` is injected
    - Emit a multi-item event, verify `supplies.update()` is called exactly once
    - Simulate component destruction, verify subscription is no longer active
    - Verify last-known stock values are retained when connection drops (no error state)
    - _Requirements: 4.1, 4.2, 4.5, 4.8_

- [ ] 6. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Property tests use [fast-check](https://fast-check.io/) integrated into Karma + Jasmine spec files, minimum 100 iterations each
- Each property test must carry the tag comment `// Feature: inventory-websocket-realtime, Property N: <text>`
- The `disconnect()` method in `WebSocketService` already iterates `this.subscriptions` and unsubscribes all entries — no extra cleanup code is needed for the inventory subscription
- Use path aliases (`@app/*`, `@services/*`, `@models/*`) for all imports per project conventions
- `standalone: true` must NOT be set in `@Component` decorators (Angular v20+ default)

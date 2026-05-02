# Design Document — inventory-websocket-realtime

## Overview

This feature extends the existing Angular admin UI to receive real-time inventory stock updates over the already-established STOMP/WebSocket connection. When a waiter places an order and the backend deducts stock, the admin's Inventory & Supplies table reflects the new quantities immediately — no page reload required.

The approach is deliberately minimal: no new STOMP client, no new connection lifecycle, no visual flash. The existing `WebSocketService` gains one new `Subject` and one new topic subscription; the `Inventory` component subscribes to the resulting observable and applies partial in-place updates to its `supplies` signal.

### Key Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| STOMP client | Extend existing `WebSocketService` | Avoids a second connection; reuses auth, reconnect, and lifecycle logic already in place |
| State update | Single `supplies.update()` call per event | Prevents redundant Angular change-detection cycles when a batch of items arrives |
| Location mapping | `locationName === 'BODEGA'` → `stockBodega`, `'COCINA'` → `stockCocina` | Matches the backend's storage location naming convention |
| Subscription cleanup | `takeUntilDestroyed()` in the component | Angular-idiomatic; no manual `ngOnDestroy` needed |
| Visual feedback | None (silent update) | Agreed requirement; avoids distraction in a busy admin view |
| Token guard | Warn + skip activation when token is absent | Prevents unauthenticated STOMP CONNECT frames reaching the backend |

---

## Architecture

The feature fits entirely within the existing layered architecture. No new layers or modules are introduced.

```mermaid
flowchart TD
    Backend["Backend\n/topic/inventory/updates"]
    WS["WebSocketService\n(singleton)"]
    Inv["Inventory Component\n(admin feature)"]
    Sig["supplies signal\nSignal<SupplyVariantResponse[] | undefined>"]

    Backend -->|STOMP message| WS
    WS -->|inventoryUpdated$ Observable| Inv
    Inv -->|supplies.update()| Sig
    Sig -->|Angular change detection| Template["Inventory Table\n(DOM)"]
```

### Data Flow

1. Backend publishes an `InventoryStockUpdatedEvent` JSON payload to `/topic/inventory/updates`.
2. `WebSocketService.subscribeToTopics()` receives the raw STOMP message, parses the body as `InventoryStockUpdatedEvent`, and calls `inventoryUpdatedSubject.next(event)`.
3. `Inventory` component's `takeUntilDestroyed` subscription fires; the handler calls `supplies.update()` once, mapping each `UpdatedStockItem` to the correct `stockBodega` or `stockCocina` field.
4. Angular's signal graph propagates the change; `filteredSupplies` computed signal re-evaluates; the table re-renders only the affected rows.

---

## Components and Interfaces

### 1. Environment Files

Both environment files gain a single new property:

```typescript
// environment.ts (production)
wsUrl: 'https://api.rms.aros.services/ws'

// environment.development.ts
wsUrl: 'http://localhost:8080/ws'
```

The existing `WebSocketService.connect()` call sites already pass a `wsUrl` argument; they will be updated to read from `environment.wsUrl`.

### 2. New Model — `inventory-stock-update.ts`

Path: `src/app/shared/models/dto/inventory/inventory-stock-update.ts`

```typescript
export interface UpdatedStockItem {
  supplyVariantId: number;
  storageLocationId: number;
  locationName: string;       // 'BODEGA' | 'COCINA'
  currentQuantity: number;
}

export interface InventoryStockUpdatedEvent {
  type: string;               // e.g. 'INVENTORY_UPDATED'
  updatedItems: UpdatedStockItem[];
}
```

Naming follows the existing DTO convention (`*Response`, `*Request`, or descriptive noun). The `type` discriminator field is kept as `string` (not a union literal) to remain forward-compatible with future event types the backend may introduce.

### 3. `WebSocketService` — additions

File: `src/app/core/services/websocket/websocket.service.ts`

New private field:
```typescript
private inventoryUpdatedSubject = new Subject<InventoryStockUpdatedEvent>();
```

New public observable:
```typescript
inventoryUpdated$ = this.inventoryUpdatedSubject.asObservable();
```

Addition inside `subscribeToTopics()`:
```typescript
const inventorySub = this.client.subscribe('/topic/inventory/updates', (message) => {
  try {
    const event: InventoryStockUpdatedEvent = JSON.parse(message.body);
    this.inventoryUpdatedSubject.next(event);
  } catch (error) {
    this.logger.error('WebSocket: Error parsing inventory update', error);
  }
});
this.subscriptions.set('/topic/inventory/updates', inventorySub);
```

The existing `disconnect()` method already iterates `this.subscriptions` and calls `sub.unsubscribe()` on each entry, so the inventory subscription is cleaned up automatically.

The existing `connect()` method already validates the token presence (logs a warning and returns early if absent), satisfying Requirement 5.2 without additional changes.

### 4. `Inventory` Component — additions

File: `src/app/features/admin/manage/inventory/inventory.ts`

New injection:
```typescript
private wsService = inject(WebSocketService);
```

New `destroyRef` for `takeUntilDestroyed`:
```typescript
private destroyRef = inject(DestroyRef);
```

Subscription registered in `ngOnInit` (after existing init calls):
```typescript
this.wsService.inventoryUpdated$
  .pipe(takeUntilDestroyed(this.destroyRef))
  .subscribe((event) => this.applyInventoryUpdate(event));
```

New private handler method:
```typescript
private applyInventoryUpdate(event: InventoryStockUpdatedEvent): void {
  const current = this.supplies();
  if (current === undefined) return;

  this.supplies.update((list) => {
    if (list === undefined) return list;
    return list.map((supply) => {
      const match = event.updatedItems.find((item) => item.supplyVariantId === supply.id);
      if (!match) return supply;
      if (match.locationName === 'BODEGA') {
        return { ...supply, stockBodega: match.currentQuantity };
      }
      if (match.locationName === 'COCINA') {
        return { ...supply, stockCocina: match.currentQuantity };
      }
      return supply;
    });
  });
}
```

Key properties of this implementation:
- The `undefined` guard at the top satisfies Requirement 4.7.
- The single `supplies.update()` call satisfies Requirement 4.5.
- Unknown `supplyVariantId` values fall through the `find` returning `undefined`, leaving the supply unchanged (Requirement 4.6).
- Unknown `locationName` values (neither `BODEGA` nor `COCINA`) return the supply unchanged — forward-compatible.
- `takeUntilDestroyed(this.destroyRef)` handles cleanup automatically (Requirement 4.8).

---

## Data Models

### `InventoryStockUpdatedEvent` (incoming WebSocket payload)

```
InventoryStockUpdatedEvent
├── type: string                    // discriminator, e.g. "INVENTORY_UPDATED"
└── updatedItems: UpdatedStockItem[]
    └── UpdatedStockItem
        ├── supplyVariantId: number   // matches SupplyVariantResponse.id
        ├── storageLocationId: number // backend storage location PK
        ├── locationName: string      // "BODEGA" | "COCINA"
        └── currentQuantity: number   // new absolute stock value
```

### `SupplyVariantResponse` (existing, unchanged)

```
SupplyVariantResponse
├── id: number
├── supplyName: string
├── stockBodega: number   ← updated when locationName === 'BODEGA'
├── stockCocina: number   ← updated when locationName === 'COCINA'
└── ... (other fields unchanged)
```

### Mapping rule

```
UpdatedStockItem.locationName  →  SupplyVariantResponse field
─────────────────────────────────────────────────────────────
"BODEGA"                       →  stockBodega
"COCINA"                       →  stockCocina
anything else                  →  (ignored, supply unchanged)
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Message parse round-trip

*For any* valid `InventoryStockUpdatedEvent` object, serializing it to a JSON string and passing that string through the `WebSocketService` message handler should result in an equivalent event being emitted on `inventoryUpdated$`.

**Validates: Requirements 3.4**

---

### Property 2: Invalid JSON is swallowed silently

*For any* string that cannot be parsed as a valid `InventoryStockUpdatedEvent` (malformed JSON, wrong shape, etc.), the `WebSocketService` message handler should not emit any value on `inventoryUpdated$` and should call `LoggingService.error`.

**Validates: Requirements 3.5**

---

### Property 3: BODEGA and COCINA stock mapping

*For any* non-empty `supplies` array and any `InventoryStockUpdatedEvent`, after `applyInventoryUpdate` is called:
- Every supply whose `id` matches an `updatedItem` with `locationName === 'BODEGA'` has its `stockBodega` set to `item.currentQuantity`.
- Every supply whose `id` matches an `updatedItem` with `locationName === 'COCINA'` has its `stockCocina` set to `item.currentQuantity`.
- All other fields on every supply remain unchanged.

**Validates: Requirements 4.3, 4.4**

---

### Property 4: Unknown supplyVariantId leaves supplies unchanged

*For any* `supplies` array and any `InventoryStockUpdatedEvent` where all `supplyVariantId` values are absent from the supplies array, calling `applyInventoryUpdate` should return a supplies array that is structurally identical to the input (no supply is modified, no error is thrown).

**Validates: Requirements 4.6**

---

### Property 5: Update is safe when supplies is undefined

*For any* `InventoryStockUpdatedEvent`, calling `applyInventoryUpdate` while `supplies` holds `undefined` should not throw an error and should leave `supplies` as `undefined`.

**Validates: Requirements 4.7**

---

### Property 6: JWT token is forwarded in CONNECT headers

*For any* non-empty token string, calling `WebSocketService.connect(wsUrl, token)` should configure the STOMP `Client` with `connectHeaders.Authorization === 'Bearer ' + token`.

**Validates: Requirements 5.1**

---

### Property 7: Absent or empty token prevents activation

*For any* absent or empty token value (empty string), calling `WebSocketService.connect()` should call `LoggingService.warn` and should not call `client.activate()`.

**Validates: Requirements 5.2**

---

**Property Reflection — redundancy check:**

- Properties 3 and 4 are complementary, not redundant: Property 3 covers the "match found" path; Property 4 covers the "no match" path.
- Properties 5 and 4 are complementary: Property 5 covers the `undefined` signal state; Property 4 covers an empty/non-matching array.
- Properties 6 and 7 are complementary: Property 6 covers the happy path; Property 7 covers the guard path.
- No redundancy identified; all seven properties provide unique validation value.

---

## Error Handling

| Scenario | Handler | Behavior |
|---|---|---|
| STOMP message body is not valid JSON | `WebSocketService` catch block | `logger.error(...)` called; no emission on `inventoryUpdated$` |
| `supplyVariantId` not found in `supplies` | `applyInventoryUpdate` | Item silently skipped; remaining items processed normally |
| `supplies` signal is `undefined` at update time | `applyInventoryUpdate` early return | No-op; no error thrown |
| Token absent when `connect()` is called | Existing guard in `WebSocketService.connect()` | `logger.warn(...)` called; `client.activate()` not called |
| WebSocket connection drops | STOMP `reconnectDelay: 5000` | Automatic reconnect; `onConnect` fires again, re-subscribing all topics including `/topic/inventory/updates` |
| Unknown `locationName` in update item | `applyInventoryUpdate` fall-through | Supply returned unchanged; no error |

---

## Testing Strategy

### Unit Tests (Jasmine / Karma)

**`WebSocketService`**
- Verify `inventoryUpdated$` is exposed as a public observable.
- On `subscribeToTopics()`, verify `client.subscribe` is called with `/topic/inventory/updates`.
- On `disconnect()`, verify the inventory subscription is unsubscribed along with all others.
- Verify `reconnectDelay` is configured as `5000` on the STOMP `Client`.
- Simulate reconnect (call `onConnect` a second time), verify inventory topic is re-subscribed.

**`Inventory` component**
- Verify `WebSocketService` is injected.
- Verify `inventoryUpdated$` subscription is registered on `ngOnInit`.
- Emit a multi-item event, verify `supplies.update()` is called exactly once.
- Simulate component destruction, verify subscription is no longer active.
- Verify last-known stock values are retained when connection drops (no error state).

### Property-Based Tests (fast-check)

The project uses Karma + Jasmine. Property-based tests will use [fast-check](https://fast-check.io/) integrated into Jasmine spec files.

Each property test runs a minimum of **100 iterations**.

Tag format: `// Feature: inventory-websocket-realtime, Property N: <property_text>`

**Property 1 — Message parse round-trip**
Generate arbitrary `InventoryStockUpdatedEvent` objects (varying `type`, array length, `supplyVariantId`, `locationName`, `currentQuantity`). Serialize to JSON, feed to the message handler, assert the emitted value deep-equals the original.

**Property 2 — Invalid JSON swallowed silently**
Generate arbitrary strings that are not valid `InventoryStockUpdatedEvent` JSON (random strings, partial JSON, wrong-type fields). Feed to the message handler, assert `inventoryUpdated$` emits nothing and `logger.error` is called.

**Property 3 — BODEGA and COCINA stock mapping**
Generate an arbitrary `SupplyVariantResponse[]` and an arbitrary `InventoryStockUpdatedEvent` whose `updatedItems` reference IDs that exist in the array. Call `applyInventoryUpdate`. Assert: matched BODEGA items have correct `stockBodega`; matched COCINA items have correct `stockCocina`; all other fields are unchanged.

**Property 4 — Unknown supplyVariantId leaves supplies unchanged**
Generate an arbitrary `SupplyVariantResponse[]` and an `InventoryStockUpdatedEvent` whose `supplyVariantId` values are all absent from the array. Call `applyInventoryUpdate`. Assert the resulting array deep-equals the input.

**Property 5 — Update safe when supplies is undefined**
Generate an arbitrary `InventoryStockUpdatedEvent`. Set `supplies` to `undefined`. Call `applyInventoryUpdate`. Assert no error is thrown and `supplies` remains `undefined`.

**Property 6 — JWT token forwarded in CONNECT headers**
Generate an arbitrary non-empty string as token. Call `connect(wsUrl, token)`. Assert the `Client` constructor received `connectHeaders: { Authorization: 'Bearer ' + token }`.

**Property 7 — Absent or empty token prevents activation**
For each of `''` (and any whitespace-only string if applicable). Call `connect(wsUrl, token)`. Assert `logger.warn` was called and `client.activate` was not called.

### Integration / Smoke Tests

- Verify `environment.ts` has `wsUrl: 'https://api.rms.aros.services/ws'`.
- Verify `environment.development.ts` has `wsUrl: 'http://localhost:8080/ws'`.
- TypeScript compilation (`ng build`) validates all interface shapes (Requirements 2.1, 2.2, 2.3, 3.1, 3.2, 4.1).

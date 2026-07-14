# Special Selection — UI Changes Document

> Frontend-team-facing companion to `SPECIAL_SELECTION_IMPLEMENTATION.md`.
> Tracks every UI-visible change introduced by the migration. Status: **DRAFT — pending approval**.

---

## 1. Summary of Changes

| Category | Impact | Owner |
|----------|--------|-------|
| New admin screens | Combo creation, editing, history, price suggestion | Admin web app |
| New waiter screens | Real-time combo list (`/available-now`), combo detail | Waiter web/mobile app |
| Modified screens | Order creation (combo picker, group selector, addition picker, clarifications) | Waiter app |
| Removed screens | Day-menu admin & waiter screens | Admin + waiter apps |
| Real-time updates | New STOMP subscription `/topic/special-selections/updated` | All UIs |
| New product fields | `selectionType`, `baseRecipeEnabled`, `schedulingRequired` | Admin product editor |
| New supply-variant field | `unitCost` | Admin supply catalog |

---

## 2. New Endpoints (Admin UI)

All endpoints under `/api/v1/special-selections`.

### 2.1 Combo CRUD

| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | `/` | `SpecialSelectionRequest` (full graph) | `201` + `SpecialSelectionResponse` |
| PUT | `/{id}` | `SpecialSelectionRequest` | `200` + `SpecialSelectionResponse` |
| PATCH | `/{id}/schedule` | `{ entries: SpecialSelectionScheduleRequest[] }` | `200` + `SpecialSelectionResponse` |
| PATCH | `/{id}/price` | `{ basePrice: number }` | `200` + `SpecialSelectionResponse` |
| DELETE | `/{id}` | – | `204` |
| GET | `/{id}` | – | `200` + `SpecialSelectionResponse` |
| GET | `/` | – | `200` + `SpecialSelectionResponse[]` |
| GET | `/available-now` | – | `200` + `SpecialSelectionResponse[]` |

### 2.2 History

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/{id}/history?page=&size=` | Paginated history |
| GET | `/{id}/history/{version}` | Single snapshot |
| GET | `/{id}/history/range?from=&to=` | Snapshots active in range |
| POST | `/{id}/history/{version}/revert` | Restore older version |

### 2.3 Admin Aid

| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | `/{id}/suggest-price` | `{ marginPercent: number }` | `200` + `SuggestedPriceResponse` or `422` with list of variants needing `unitCost` |

### 2.4 New `SpecialSelectionRequest` shape

```jsonc
{
  "name": "Menú Almuerzo",
  "description": "Sopa + plato fuerte + bebida",
  "basePrice": 12.50,
  "active": true,
  "areaId": 1,
  "baseRecipeEnabled": false,
  "schedulingRequired": true,
  "groups": [
    {
      "name": "Sopa",
      "displayOrder": 1,
      "required": true,
      "minSelections": 1,
      "maxSelections": 1,
      "optionIds": [10, 11, 12]   // existing ProductOption IDs
    },
    {
      "name": "Plato Fuerte",
      "displayOrder": 2,
      "required": true,
      "minSelections": 1,
      "maxSelections": 1,
      "optionIds": [20, 21, 22]
    }
  ],
  "additions": [
    {
      "name": "Extra queso",
      "optionId": 30,
      "extraPrice": 1.50,
      "displayOrder": 1
    }
  ],
  "questions": [
    { "question": "¿Alguna alergia?", "required": true, "displayOrder": 1 }
  ],
  "schedule": [
    { "dayOfWeek": "MONDAY",    "startTime": "11:00", "endTime": "15:00" },
    { "dayOfWeek": "TUESDAY",   "startTime": "11:00", "endTime": "15:00" },
    { "dayOfWeek": "WEDNESDAY", "startTime": "11:00", "endTime": "15:00" },
    { "dayOfWeek": "THURSDAY",  "startTime": "11:00", "endTime": "15:00" },
    { "dayOfWeek": "FRIDAY",    "startTime": "11:00", "endTime": "15:00" }
  ]
}
```

### 2.5 `SpecialSelectionResponse` shape

Same as request, plus IDs and per-option metadata:

```jsonc
{
  "id": 7,
  "name": "Menú Almuerzo",
  "basePrice": 12.50,
  "active": true,
  "areaId": 1,
  "selectionType": "SPECIAL_SELECTION",
  "baseRecipeEnabled": false,
  "schedulingRequired": true,
  "groups": [
    {
      "id": 1, "name": "Sopa", "required": true, "minSelections": 1, "maxSelections": 1,
      "displayOrder": 1,
      "options": [
        { "id": 10, "name": "Lentejas",   "extraPrice": 0.00, "displayOrder": 1, "optionCategoryId": 5 },
        { "id": 11, "name": "Frijoles",   "extraPrice": 0.00, "displayOrder": 2, "optionCategoryId": 5 },
        { "id": 12, "name": "Verduras",  "extraPrice": 0.00, "displayOrder": 3, "optionCategoryId": 5 }
      ]
    }
  ],
  "additions": [
    { "id": 5, "name": "Extra queso", "optionId": 30, "optionName": "Queso cheddar", "extraPrice": 1.50, "displayOrder": 1 }
  ],
  "questions": [
    { "id": 7, "question": "¿Alguna alergia?", "required": true, "displayOrder": 1 }
  ],
  "schedule": [
    { "id": 20, "dayOfWeek": "MONDAY", "startTime": "11:00", "endTime": "15:00" }
  ]
}
```

### 2.6 Suggested-price response

```jsonc
{
  "suggestedPrice": 15.50,
  "totalCost":      10.85,
  "marginPercent":  30.0,
  "breakdown": [
    { "optionId": 10, "name": "Lentejas", "cost": 1.20 },
    { "optionId": 20, "name": "Pollo",    "cost": 4.50 }
  ]
}
```

422 response when `unit_cost` missing:
```jsonc
{
  "status": 422,
  "message": "Cannot compute suggested price: missing unit_cost on supply_variants",
  "missingVariants": [42, 87]
}
```

---

## 3. New Endpoints (Waiter UI)

`GET /api/v1/special-selections/available-now` is the only new waiter-facing endpoint.
It returns combos whose schedule covers the current moment.

The waiter app should:
- Refresh `available-now` every 60 seconds (or on focus), AND
- Subscribe to `/topic/special-selections/updated` to refresh immediately on admin changes.

`GET /api/v1/special-selections/{id}` gives the full configuration (groups, options, additions, questions) so the waiter UI can render the picker.

---

## 4. Modified Endpoints

### 4.1 `POST /api/v1/orders` and `PUT /api/v1/orders/{id}`

`OrderDetailRequest` now accepts:

```jsonc
{
  "productId": 7,
  "instructions": "Sin sal",
  "selectedOptionIds": [10, 22, 30],        // existing field, used for group choices
  "additionIds": [5],                       // NEW
  "clarifications": [                       // NEW
    { "questionId": 7, "answer": "Alergia a maní" }
  ]
}
```

Behavioural rules the waiter UI must reflect:
- All required groups must have a selection.
- Selections per group must be within `min`/`max`.
- A combo outside its schedule returns **409**; UI should show "Este menú no está disponible ahora".
- The price returned in `OrderResponse.unitPrice` is `basePrice + Σ addition.extraPrice`.

### 4.2 `GET /api/v1/products` (admin product list)

- Add `selectionType`, `baseRecipeEnabled`, `schedulingRequired` to the response payload.
- The list endpoint filters out `selection_type='SPECIAL_SELECTION'` by default.
- To create/edit a special selection, use the dedicated `/api/v1/special-selections` endpoints, not `/products`.
- A new filter param `?includeSelections=true` returns special selections too (admin use only).

### 4.3 `GET /api/v1/products/{id}` (admin product detail)

- Same 3 new fields.
- The detail endpoint still works for special selections (so the kitchen app can show the combo recipe).

### 4.4 `POST /api/v1/products` / `PUT /api/v1/products/{id}` (admin product create/update)

- Accept the 3 new fields. Admins setting `selectionType='SPECIAL_SELECTION'` here will get a warning recommending to use `/special-selections` instead; the field is exposed for completeness.

### 4.5 `POST /api/v1/supply-variants` / `PUT /api/v1/supply-variants/{id}` (admin supply catalog)

- New field `unitCost` (decimal). Defaults to `0.00` if omitted.
- Suggested-price tool depends on this field; UI should show a banner if any variant is missing the cost.

---

## 5. Removed Endpoints

| Method | Path | Replacement |
|--------|------|-------------|
| GET | `/api/v1/day-menu/current` | `GET /api/v1/special-selections/available-now` |
| PUT | `/api/v1/day-menu` | `POST`/`PATCH` on `/api/v1/special-selections` |
| GET | `/api/v1/day-menu/history` | `GET /api/v1/special-selections/{id}/history` |

All `/api/v1/day-menu/**` paths return **404** after deployment.

---

## 6. WebSocket / Real-Time

Subscribe on:
```
/topic/special-selections/updated
```

Payload format:
```jsonc
{
  "changeType": "UPDATE",          // CREATE | UPDATE | SCHEDULE_CHANGE | PRICE_CHANGE | DELETE | REVERT
  "productId": 7,
  "active": true,
  "selection": { /* full SpecialSelectionResponse or null when DELETE */ }
}
```

Behaviour:
- Waiter UI: re-fetch `/available-now` on every message.
- Admin UI: invalidate the affected combo's cached state and re-render.

---

## 7. New UI Screens (Frontend Spec Outline)

### 7.1 Admin — Combo list
- Table of all combos with: name, basePrice, schedule summary, active toggle, actions.
- "Nuevo combo" button → Combo editor.
- "Historial" button per row → Combo history timeline.
- "Precio sugerido" button (margin input → preview suggested price).

### 7.2 Admin — Combo editor
- Top: name, description, basePrice, area, active, baseRecipeEnabled toggles, schedulingRequired toggle.
- Tab "Grupos" — drag-and-drop list of groups; each group shows min/max badges and the options inside (with extra prices).
- Tab "Adiciones" — chip list; each chip shows name, extra price, and underlying option name.
- Tab "Preguntas" — form-builder style (question + required + order).
- Tab "Horario" — 7-day weekly grid (rows = day, columns = time ranges).
- Save = PUT full graph; quick save = individual PATCH endpoints.

### 7.3 Admin — Combo history
- Vertical timeline of versions with change type, author, timestamp, version number, "is current" badge.
- Per-version: collapsible JSON snapshot viewer.
- "Revertir a esta versión" button (admin only) on non-current rows.

### 7.4 Waiter — Menu
- Replace the day-menu widget with the "Combos disponibles ahora" panel.
- Each combo is a card showing name, price, components preview ("Elige: sopa, plato, bebida").
- Tap a card → Combo detail screen.

### 7.5 Waiter — Combo detail / order
- Renders each group as a section with min/max badges.
- Tap each option to select (single-select or multi-select per group's `maxSelections`).
- Render additions as a chip list with extra price.
- Render questions as text inputs (with required asterisk).
- Submit → POST /api/v1/orders with the new fields.

### 7.6 Kitchen ticket
- Shows combo name, quantity, price, then for each selected group: group name + chosen options, then additions, then clarifications/instructions.
- Backend delivers this via the existing `/topic/orders/created` STOMP topic; the kitchen app renders the new `SpecialSelectionDetailDto` fields when present.

---

## 8. Removed UI Elements

- Day-menu admin page (set / view current day menu).
- Day-menu waiter widget (if any).
- Any reference to the old `day_menu` API endpoints.

---

## 9. Error Handling Surfaced to the UI

| HTTP | When | Suggested UI message |
|------|------|----------------------|
| 400 | Group rule violation | "Completa los grupos requeridos: Sopa, Plato fuerte" |
| 400 | Required clarification empty | "Responde: ¿Alguna alergia?" |
| 409 | Combo outside schedule | "Este menú no está disponible en este horario" |
| 404 | Combo disabled mid-order | "Este menú ya no está disponible" |
| 422 | Suggested price + missing unitCost | Banner: "Configura el costo unitario de los insumos para obtener un precio sugerido" |
| 400 | Schedule invalid (start ≥ end) | "Horario inválido: la hora de inicio debe ser menor a la hora de fin" |

---

## 10. New Product Fields (UI)

Admin product editor must display:
- `selectionType` dropdown: `STANDARD` (default) | `SPECIAL_SELECTION` (admins should use `/special-selections` instead).
- `baseRecipeEnabled` checkbox (only meaningful for specials).
- `schedulingRequired` checkbox (only meaningful for specials).

These appear in:
- Product create form
- Product edit form
- Product detail view

---

## 11. New Supply-Variant Field (UI)

Admin supply catalog form:
- New field `unitCost` (decimal).
- Inline help: "Necesario para la herramienta de precio sugerido de combinaciones".

If any variant has `unitCost=0`, the admin should see a warning badge in the supply list.

---

## 12. Suggested-Price Tool UX Flow

1. Admin opens combo editor.
2. Types margin % (default 30) → clicks "Calcular precio sugerido".
3. UI calls `POST /api/v1/special-selections/{id}/suggest-price`.
4. If `200`: shows modal with suggested price, total cost, and a breakdown table.
5. If `422`: shows list of variants needing `unitCost`, with deep links to the supply catalog.
6. Admin copies suggested price into the basePrice field (or types their own).

---

## 13. Notification Subscription Pattern

```ts
// Pseudo-code for the waiter/admin apps
stompClient.subscribe('/topic/special-selections/updated', (message) => {
  const payload = JSON.parse(message.body);
  if (payload.changeType === 'DELETE') {
    cache.invalidate(payload.productId);
  } else {
    cache.set(payload.productId, payload.selection);
  }
  queryClient.invalidateQueries(['special-selections', 'available-now']);
});
```

The admin UI also subscribes so its combo list refreshes automatically.

---

## 14. Migration Checklist for the UI Team

- [ ] Remove day-menu admin page
- [ ] Remove day-menu waiter widget (if present)
- [ ] Add admin: combo list + editor + history screens
- [ ] Add waiter: combo picker + detail screens
- [ ] Modify order creation flow to handle additions + clarifications
- [ ] Update product list/detail/edit to expose 3 new fields
- [ ] Update supply variant form to include `unitCost`
- [ ] Subscribe to `/topic/special-selections/updated` everywhere
- [ ] Handle new error codes (409, 422) with friendly messages
- [ ] Add help text for the suggested-price tool
- [ ] Test on staging with V24+V25+V27 applied (V26 still pending)
- [ ] Test on staging with V26 applied (legacy UI gone)

---

## 15. Sample cURL Sequences (for QA)

### Create a combo
```bash
curl -X POST http://localhost:8080/api/v1/special-selections \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d @docs/samples/combo-create.json
```

### Order the combo
```bash
curl -X POST http://localhost:8080/api/v1/orders \
  -H "Authorization: Bearer $WORKER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tableId": 1,
    "details": [{
      "productId": 7,
      "selectedOptionIds": [10, 20, 25],
      "additionIds": [5],
      "clarifications": [{ "questionId": 7, "answer": "Sin picante" }]
    }]
  }'
```

### Get current combos
```bash
curl http://localhost:8080/api/v1/special-selections/available-now \
  -H "Authorization: Bearer $WORKER_TOKEN"
```

---

## 16. Sign-Off

- [ ] Frontend team reviewed
- [ ] Sample cURL payloads added to `docs/samples/`
- [ ] Story tickets created for each UI change
- [ ] Designer has wireframes for new screens
- [ ] i18n strings extracted (Spanish copy pending)

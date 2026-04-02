# Guía Frontend — Módulo de Compras y Reabastecimiento

## Base URL

```
http://localhost:8080/api/v1
```

Todos los endpoints requieren autenticación JWT en el header:

```
Authorization: Bearer <token>
```

---

## Reglas de negocio importantes

Antes de construir los formularios, entender estas reglas evita errores en runtime.

### 1. Distribuidores (Suppliers)

- Un distribuidor nuevo siempre se crea como **activo** (`active: true`). No se envía ese campo en el POST.
- Para **desactivar** un distribuidor se usa el PUT enviando `active: false`.
- Un distribuidor inactivo **no puede recibir órdenes de compra** — el backend responde 409.
- El campo `contact` es opcional (teléfono o email).

### 2. Orden de compra — ítems con productos dañados

Cada ítem tiene dos cantidades:

| Campo | Significado |
|---|---|
| `quantityOrdered` | Lo que dice la factura del distribuidor |
| `quantityReceived` | Lo que llegó en buen estado y entra al inventario |

**Regla crítica:** `quantityReceived` debe ser **≤ `quantityOrdered`**. Si se envía mayor, el backend responde 400.

Ejemplo válido: se pidieron 10 kg de carne, llegaron 8 kg en buen estado:
```json
{ "quantityOrdered": 10.000, "quantityReceived": 8.000 }
```

Solo los `quantityReceived` entran al stock de Bodega. El `totalAmount` de la orden refleja lo que realmente se pagó (negociado con el distribuidor).

### 3. Integración automática con inventario

Al registrar una orden de compra el backend **automáticamente**:
- Suma `quantityReceived` al stock de **Bodega** por cada ítem.
- Registra un movimiento de inventario tipo `ENTRY` por cada ítem.
- Todo ocurre en una sola transacción — si algo falla, nada se guarda.

El frontend **no necesita** llamar a ningún endpoint de inventario por separado.

### 4. `registeredById`

Es el ID del usuario que está registrando la compra. El frontend debe enviar el ID del usuario autenticado actualmente.

---

## Endpoints de Distribuidores

### POST `/api/v1/suppliers` — Crear distribuidor

**Request body:**
```json
{
  "name": "Distribuidora El Mayorista",
  "contact": "3001234567"
}
```

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `name` | string | ✅ | Nombre del distribuidor (máx 255 chars) |
| `contact` | string | ❌ | Teléfono o email de contacto (máx 255 chars) |

**Response 201:**
```json
{
  "id": 1,
  "name": "Distribuidora El Mayorista",
  "contact": "3001234567",
  "active": true
}
```

**Errores posibles:**

| Código | Cuándo |
|---|---|
| 400 | `name` vacío o supera 255 caracteres |

---

### PUT `/api/v1/suppliers/{id}` — Actualizar distribuidor

Usar también para **activar o desactivar** un distribuidor.

**Request body:**
```json
{
  "name": "Distribuidora El Mayorista",
  "contact": "3009876543",
  "active": false
}
```

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `name` | string | ✅ | Nombre actualizado |
| `contact` | string | ❌ | Contacto actualizado |
| `active` | boolean | ✅ | `true` para activar, `false` para desactivar |

**Response 200:**
```json
{
  "id": 1,
  "name": "Distribuidora El Mayorista",
  "contact": "3009876543",
  "active": false
}
```

**Errores posibles:**

| Código | Cuándo |
|---|---|
| 400 | Campos inválidos o `active` ausente |
| 404 | Distribuidor no encontrado |

---

### GET `/api/v1/suppliers` — Listar distribuidores

Sin parámetros. Devuelve todos, activos e inactivos.

**Response 200:**
```json
[
  {
    "id": 1,
    "name": "Distribuidora El Mayorista",
    "contact": "3001234567",
    "active": true
  },
  {
    "id": 2,
    "name": "Proveedor Inactivo S.A.",
    "contact": null,
    "active": false
  }
]
```

> Tip: filtrar en el frontend por `active: true` si solo se quieren mostrar los disponibles para una nueva compra.

---

## Endpoints de Órdenes de Compra

### POST `/api/v1/purchases` — Registrar orden de compra

**Request body:**
```json
{
  "supplierId": 1,
  "registeredById": 2,
  "purchasedAt": "2026-04-02T14:00:00",
  "totalAmount": 520000.00,
  "notes": "Compra de reabastecimiento abril",
  "items": [
    {
      "supplyVariantId": 1,
      "quantityOrdered": 20.000,
      "quantityReceived": 18.500,
      "unitPrice": 15000.00
    },
    {
      "supplyVariantId": 2,
      "quantityOrdered": 15.000,
      "quantityReceived": 15.000,
      "unitPrice": 12000.00
    }
  ]
}
```

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `supplierId` | number | ✅ | ID del distribuidor (debe existir y estar activo) |
| `registeredById` | number | ✅ | ID del usuario que registra la compra |
| `purchasedAt` | string ISO 8601 | ✅ | Fecha y hora real de la compra (`yyyy-MM-ddTHH:mm:ss`) |
| `totalAmount` | number | ✅ | Total pagado al distribuidor (≥ 0) |
| `notes` | string | ❌ | Observaciones opcionales |
| `items` | array | ✅ | Al menos un ítem requerido |

**Campos de cada ítem:**

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `supplyVariantId` | number | ✅ | ID de la variante de insumo |
| `quantityOrdered` | number | ✅ | Cantidad facturada (> 0) |
| `quantityReceived` | number | ✅ | Cantidad en buen estado (≥ 0, debe ser ≤ `quantityOrdered`) |
| `unitPrice` | number | ✅ | Precio unitario pagado (≥ 0) |

**Response 201:**
```json
{
  "id": 5,
  "supplierId": 1,
  "registeredById": 2,
  "purchasedAt": "2026-04-02T14:00:00",
  "totalAmount": 520000.00,
  "notes": "Compra de reabastecimiento abril",
  "createdAt": "2026-04-02T16:40:12",
  "items": [
    {
      "id": 10,
      "supplyVariantId": 1,
      "quantityOrdered": 20.000,
      "quantityReceived": 18.500,
      "unitPrice": 15000.00
    },
    {
      "id": 11,
      "supplyVariantId": 2,
      "quantityOrdered": 15.000,
      "quantityReceived": 15.000,
      "unitPrice": 12000.00
    }
  ]
}
```

**Errores posibles:**

| Código | Cuándo |
|---|---|
| 400 | Campos inválidos, lista de ítems vacía, o `quantityReceived > quantityOrdered` en algún ítem |
| 404 | `supplierId` o algún `supplyVariantId` no existe |
| 409 | El distribuidor existe pero está inactivo |

---

### GET `/api/v1/purchases` — Listar historial de compras

Sin filtros devuelve todas las órdenes. Acepta query params opcionales para filtrar.

**Sin filtros:**
```
GET /api/v1/purchases
```

**Filtrar por distribuidor:**
```
GET /api/v1/purchases?supplierId=1
```

**Filtrar por rango de fechas** (formato `yyyy-MM-dd`):
```
GET /api/v1/purchases?from=2026-01-01&to=2026-04-30
```

> Si se envía `supplierId`, el filtro de fechas se ignora. Los dos filtros son mutuamente excluyentes desde el frontend.

**Response 200** — array con el mismo formato que el POST 201, puede estar vacío `[]`.

**Errores posibles:**

| Código | Cuándo |
|---|---|
| 404 | `supplierId` no existe (al filtrar por distribuidor) |

---

### GET `/api/v1/purchases/{id}` — Detalle de una compra

```
GET /api/v1/purchases/5
```

**Response 200** — mismo formato que el POST 201.

**Errores posibles:**

| Código | Cuándo |
|---|---|
| 404 | Orden de compra no encontrada |

---

## Formato de errores

Todos los errores siguen la misma estructura:

```json
{
  "status": 404,
  "message": "Supplier not found: id=99"
}
```

Para errores de validación (400) el mensaje lista todos los campos inválidos separados por `;`:

```json
{
  "status": 400,
  "message": "name: Supplier name is required; items: At least one item is required"
}
```

---

## Flujo recomendado para el formulario de nueva compra

```
1. Cargar lista de distribuidores  →  GET /api/v1/suppliers
   Mostrar solo los activos (active: true) en el selector.

2. Cargar lista de insumos/variantes disponibles
   (endpoint existente del módulo de inventario)

3. Usuario completa el formulario:
   - Selecciona distribuidor
   - Ingresa fecha de compra
   - Agrega ítems con quantityOrdered, quantityReceived y unitPrice
   - El total puede calcularse en el frontend o ingresarse manualmente

4. Validar en el frontend antes de enviar:
   - quantityReceived <= quantityOrdered en cada ítem
   - Al menos un ítem
   - totalAmount >= 0

5. POST /api/v1/purchases
   - 201 → mostrar confirmación, el stock ya fue actualizado automáticamente
   - 409 → "El distribuidor seleccionado está inactivo"
   - 400 → mostrar mensaje de validación del campo específico
```

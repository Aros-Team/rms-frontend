# Guía Frontend: Productos y Menú del Día

## 1. Flujo para crear un producto

Antes de crear un producto, el frontend necesita cargar los datos de referencia. Estos son los
endpoints que debes consultar primero:

### 1.1 Datos de referencia necesarios

```
GET /api/v1/categories          → lista de categorías disponibles
GET /api/v1/areas               → lista de áreas de preparación (ej: Cocina, Bar)
GET /api/v1/supplies/variants  → lista de variantes de insumos (para la receta)
```

Ejemplo de respuesta de categorías:
```json
[
  { "id": 1, "name": "Platos principales", "enabled": true },
  { "id": 2, "name": "Bebidas", "enabled": true }
]
```

Ejemplo de respuesta de áreas:
```json
[
  { "id": 1, "name": "Cocina", "type": "KITCHEN", "enabled": true },
  { "id": 2, "name": "Bar", "type": "BAR", "enabled": true }
]
```

---

## 2. Producto con `hasOptions: false` (producto simple)

Un producto simple tiene un precio fijo y no permite personalización. El cliente lo pide tal cual.

**Ejemplos:** Agua mineral, Café americano, Pan de ajo.

### Request

```
POST /api/v1/products
Content-Type: application/json
Authorization: Bearer {token}
```

```json
{
  "name": "Agua Mineral 500ml",
  "basePrice": 2.50,
  "hasOptions": false,
  "categoryId": 2,
  "areaId": 2,
  "recipe": [
    { "supplyVariantId": 12, "requiredQuantity": 1.0 }
  ]
}
```

> `recipe` es opcional. Si el producto no consume insumos del inventario, envía `recipe: []` o
> simplemente omite el campo.

### Response `201 Created`

```json
{
  "id": 10,
  "name": "Agua Mineral 500ml",
  "basePrice": 2.50,
  "hasOptions": false,
  "active": true,
  "categoryId": 2,
  "categoryName": "Bebidas",
  "areaId": 2,
  "areaName": "Bar"
}
```

### Comportamiento en órdenes

Cuando `hasOptions: false`, al agregar este producto a una orden **no se muestran opciones de
personalización**. El item se agrega directamente con el `basePrice`.

---

## 3. Producto con `hasOptions: true` (producto personalizable)

Un producto personalizable permite que el cliente elija variantes (tamaño, toppings, extras, etc.).
Cada opción puede tener su propia receta de insumos.

**Ejemplos:** Hamburguesa (tamaño, término), Pizza (tamaño, ingredientes), Café (tamaño, leche).

### 3.1 Crear el producto base

```
POST /api/v1/products
Content-Type: application/json
Authorization: Bearer {token}
```

```json
{
  "name": "Hamburguesa Clásica",
  "basePrice": 12.50,
  "hasOptions": true,
  "categoryId": 1,
  "areaId": 1,
  "recipe": [
    { "supplyVariantId": 3, "requiredQuantity": 200.0 },
    { "supplyVariantId": 7, "requiredQuantity": 1.0 }
  ]
}
```

### Response `201 Created`

```json
{
  "id": 5,
  "name": "Hamburguesa Clásica",
  "basePrice": 12.50,
  "hasOptions": true,
  "active": true,
  "categoryId": 1,
  "categoryName": "Platos principales",
  "areaId": 1,
  "areaName": "Cocina"
}
```

### 3.2 Agregar opciones al producto

**IMPORTANTE:** Las opciones son entidades globales independientes de los productos. Primero debes crear las opciones (si no existen), y luego asociarlas al producto.

#### Paso 1: Crear opciones globales (si no existen)

Primero necesitas las categorías de opciones:

```
GET /api/v1/option-categories   → lista de categorías de opciones (ej: Tamaño, Extras)
```

Luego crea cada opción como entidad global (sin `productId`):

```
POST /api/v1/product-options
Content-Type: application/json
Authorization: Bearer {token}
```

```json
{
  "name": "Tamaño Grande",
  "optionCategoryId": 1,
  "recipe": [
    { "supplyVariantId": 3, "requiredQuantity": 350.0 }
  ]
}
```

**Response `201 Created`:**
```json
{
  "id": 10,
  "name": "Tamaño Grande",
  "optionCategoryId": 1,
  "optionCategoryName": "Tamaño"
}
```

#### Paso 2: Asociar opciones al producto

Al crear o actualizar un producto con `hasOptions: true`, incluye el array `optionIds` con los IDs de las opciones que quieres asociar:

```
POST /api/v1/products
Content-Type: application/json
Authorization: Bearer {token}
```

```json
{
  "name": "Hamburguesa Clásica",
  "basePrice": 12.50,
  "hasOptions": true,
  "categoryId": 1,
  "areaId": 1,
  "recipe": [
    { "supplyVariantId": 3, "requiredQuantity": 200.0 }
  ],
  "optionIds": [10, 11, 12]
}
```

**Nota:** Las opciones en `optionIds` deben existir previamente en la tabla `product_options`. El backend crea las asociaciones en la tabla `product_product_options`.

### 3.3 Consultar opciones de un producto

```
GET /api/v1/products/5/options
```

```json
[
  {
    "id": 1,
    "name": "Tamaño Grande",
    "optionCategoryId": 1,
    "optionCategoryName": "Tamaño"
  },
  {
    "id": 2,
    "name": "Tamaño Mediano",
    "optionCategoryId": 1,
    "optionCategoryName": "Tamaño"
  }
]
```

### Comportamiento en órdenes

Cuando `hasOptions: true`, al agregar este producto a una orden **el frontend debe mostrar un
selector de opciones** antes de confirmar el item. El cliente elige una o más opciones y el sistema
calcula el precio final.

---

## 4. Diferencias entre producto normal y Menú del Día

| Aspecto | Producto normal | Menú del Día |
|---|---|---|
| Tabla en BD | `products` | `day_menu` (referencia a `products`) |
| Requisito | `hasOptions` puede ser `true` o `false` | **Obligatorio** `hasOptions: true` |
| Cantidad activa | Muchos productos activos simultáneamente | **Exactamente uno** activo a la vez |
| Ciclo de vida | Se crea, actualiza o desactiva | Se reemplaza (el anterior se archiva) |
| Historial | No tiene historial automático | Historial completo en `day_menu_history` |
| Endpoint de creación | `POST /api/v1/products` | No se crea: se asigna un producto existente |
| Endpoint de actualización | `PUT /api/v1/products/{id}` | `PUT /api/v1/day-menu` |
| Quién lo gestiona | Administrador (catálogo) | Administrador (operación diaria) |

**En resumen:** el Menú del Día no es un tipo especial de producto. Es una *configuración* que
dice "hoy, este producto del catálogo es el menú del día". El producto sigue existiendo en el
catálogo independientemente.

---

## 5. Endpoints del Menú del Día

### 5.1 Actualizar el Menú del Día

Asigna un producto existente (con `hasOptions: true`) como el menú del día activo. El menú
anterior se archiva automáticamente.

```
PUT /api/v1/day-menu
Content-Type: application/json
Authorization: Bearer {token}
```

```json
{
  "productId": 5
}
```

**Response `200 OK`:**
```json
{
  "id": 3,
  "productId": 5,
  "productName": "Hamburguesa Clásica",
  "productBasePrice": 12.50,
  "validFrom": "2026-04-03T09:00:00",
  "createdBy": "admin@restaurante.com"
}
```

**Errores posibles:**

| Código | Causa |
|--------|-------|
| `400` | `productId` nulo, o el producto tiene `hasOptions: false` |
| `401` | Token no enviado o expirado |
| `404` | El `productId` no existe o el producto está inactivo |

---

### 5.2 Consultar el Menú del Día actual

```
GET /api/v1/day-menu/current
Authorization: Bearer {token}
```

**Response `200 OK`** (hay menú configurado):
```json
{
  "id": 3,
  "productId": 5,
  "productName": "Hamburguesa Clásica",
  "productBasePrice": 12.50,
  "validFrom": "2026-04-03T09:00:00",
  "createdBy": "admin@restaurante.com"
}
```

**Response `204 No Content`** (no hay menú configurado): cuerpo vacío.

> El frontend debe manejar el `204` mostrando un estado "Sin menú del día configurado" en lugar
> de intentar parsear un body vacío.

---

### 5.3 Consultar el historial del Menú del Día

```
GET /api/v1/day-menu/history?page=0&size=10
Authorization: Bearer {token}
```

**Parámetros:**
- `page`: número de página, empieza en `0` (default: `0`)
- `size`: registros por página, entre `1` y `100` (default: `10`)

**Response `200 OK`:**
```json
{
  "content": [
    {
      "id": 2,
      "productId": 3,
      "productName": "Pasta Carbonara",
      "productBasePrice": 14.00,
      "validFrom": "2026-04-02T09:00:00",
      "validUntil": "2026-04-03T09:00:00",
      "createdBy": "chef@restaurante.com"
    },
    {
      "id": 1,
      "productId": 7,
      "productName": "Ensalada César",
      "productBasePrice": 10.50,
      "validFrom": "2026-04-01T08:30:00",
      "validUntil": "2026-04-02T09:00:00",
      "createdBy": "admin@restaurante.com"
    }
  ],
  "totalElements": 2,
  "totalPages": 1,
  "size": 10,
  "number": 0,
  "first": true,
  "last": true
}
```

El historial siempre viene ordenado por `validUntil` descendente (el más reciente primero).

---

## 6. Flujo recomendado en el panel de administración

### Pantalla "Gestión de Productos"
1. `GET /api/v1/categories` → cargar selector de categorías
2. `GET /api/v1/areas` → cargar selector de áreas
3. `GET /api/v1/option-categories` → cargar categorías de opciones
4. `GET /api/v1/product-options` → cargar opciones globales existentes
5. `GET /api/v1/products` → listar productos existentes
6. Al crear producto con opciones:
   - Si el usuario selecciona opciones existentes: usar sus IDs directamente
   - Si el usuario crea nuevas opciones: `POST /api/v1/product-options` (sin `productId`)
   - Luego: `POST /api/v1/products` con array `optionIds`

### Pantalla "Menú del Día"
1. `GET /api/v1/day-menu/current` → mostrar el menú activo (o mensaje si `204`)
2. Para cambiar: mostrar selector con `GET /api/v1/products` filtrado por `hasOptions: true` y `active: true`
3. Al confirmar: `PUT /api/v1/day-menu` con el `productId` seleccionado
4. `GET /api/v1/day-menu/history` → mostrar tabla de historial con paginación

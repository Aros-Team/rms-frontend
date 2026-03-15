# 📖 GUÍA DE INTEGRACIÓN: RMS API

## Para Desarrolladores Frontend

Esta guía te muestra cómo integrar tu aplicación frontend con la API del **Restaurant Management System (RMS)**. Incluye todos los endpoints necesarios para cargar datos maestros y crear órdenes.

---

## 📚 ÍNDICE

1. [Endpoints de Datos Maestros](#-endpoints-de-datos-maestros-core-del-negocio)
2. [Estructura de Requests/Responses](#-estructura-de-requestsresponses)
3. [Flujo de Carga de Datos](#-flujo-recomendado-de-carga-de-datos)
4. [Crear Órdenes](#-crear-órdenes-post-apiv1orders)
5. [Validaciones](#-validaciones-requeridas)
6. [Códigos de Error](#-códigos-de-error-referencia-completa)
7. [Ejemplos de Implementación](#-ejemplos-de-implementación)
8. [Troubleshooting](#-troubleshooting)

---

## 🗄️ ENDPOINTS DE DATOS MAESTROS (Core del Negocio)

### ⚠️ IMPORTANTE: Carga de Datos Previa
Antes de crear órdenes, debes cargar todos los datos maestros del restaurante. Estos datos no cambian frecuentemente y deben estar disponibles en el frontend.

---

### 1️⃣ **GET /api/v1/categories** - Obtener Categorías de Productos

**Descripción**: Retorna todas las categorías del menú (Pizzas, Hamburguesas, Bebidas, etc.)

**Método**: `GET` | **Ruta**: `/api/v1/categories` | **Auth**: Requerida

**Request**:
```bash
curl -X GET http://localhost:8080/api/v1/categories \
  -H "Authorization: Bearer {accessToken}"
```

**Response 200 OK**:
```json
[
  { "id": 1, "name": "Pizzas", "description": "Pizzas variadas...", "enabled": true },
  { "id": 2, "name": "Bebidas", "description": "Bebidas frías...", "enabled": true }
]
```

---

### 2️⃣ **GET /api/v1/option-categories** - Obtener Categorías de Opciones

**Descripción**: Retorna tipos de personalizaciones (Tamaño, Cocción, Temperatura, etc.)

**Método**: `GET` | **Ruta**: `/api/v1/option-categories` | **Auth**: Requerida

**Request**:
```bash
curl -X GET http://localhost:8080/api/v1/option-categories \
  -H "Authorization: Bearer {accessToken}"
```

**Response 200 OK**:
```json
[
  { "id": 1, "name": "Tamaño", "description": "Tamaño de la pizza" },
  { "id": 2, "name": "Cocción", "description": "Punto de cocción" },
  { "id": 3, "name": "Temperatura", "description": "Temperatura" }
]
```

---

### 3️⃣ **GET /api/v1/products** - Obtener Todos los Productos

**Descripción**: Retorna todos los productos del menú con sus atributos

**Método**: `GET` | **Ruta**: `/api/v1/products` | **Auth**: Requerida

**Parámetros Opcionales**:
- `active=true` - Filtrar solo productos activos
- `{id}` - Obtener producto específico: `/api/v1/products/5`

**Request**:
```bash
# Todos los productos
curl -X GET http://localhost:8080/api/v1/products \
  -H "Authorization: Bearer {accessToken}"

# Solo activos
curl -X GET http://localhost:8080/api/v1/products?active=true \
  -H "Authorization: Bearer {accessToken}"

# Producto específico
curl -X GET http://localhost:8080/api/v1/products/5 \
  -H "Authorization: Bearer {accessToken}"
```

**Response 200 OK** (Lista):
```json
[
  {
    "id": 1,
    "name": "Pizza Margherita",
    "basePrice": 12.99,
    "hasOptions": true,
    "active": true,
    "categoryId": 1,
    "categoryName": "Pizzas",
    "areaId": 1
  }
]
```

**Campos Importantes**:
| Campo | Descripción |
|-------|------------|
| `hasOptions` | ✅ Si `true`, OBLIGATORIO enviar `selectedOptionIds`. ❌ Si `false`, PROHIBIDO enviar opciones |
| `active` | Solo productos `active=true` pueden ordenarse |
| `categoryId` / `categoryName` | Para agrupar en la UI |
| `areaId` | Área de preparación (Cocina, Bar, etc.) |

---

### 4️⃣ **GET /api/v1/product-options** - Obtener Todas las Opciones

**Descripción**: Retorna todas las opciones para personalizar productos

**Método**: `GET` | **Ruta**: `/api/v1/product-options` | **Auth**: Requerida

**Request**:
```bash
curl -X GET http://localhost:8080/api/v1/product-options \
  -H "Authorization: Bearer {accessToken}"
```

**Response 200 OK**:
```json
[
  { "id": 1, "name": "Pequeña (10\")", "optionCategoryId": 1, "optionCategoryName": "Tamaño" },
  { "id": 2, "name": "Mediana (12\")", "optionCategoryId": 1, "optionCategoryName": "Tamaño" },
  { "id": 3, "name": "Grande (14\")", "optionCategoryId": 1, "optionCategoryName": "Tamaño" },
  { "id": 10, "name": "Poco Hecha", "optionCategoryId": 2, "optionCategoryName": "Cocción" }
]
```

---

### 5️⃣ **GET /api/v1/tables** - Obtener Todas las Mesas

**Descripción**: Retorna todas las mesas con su estado actual

**Método**: `GET` | **Ruta**: `/api/v1/tables` | **Auth**: Requerida

**Request**:
```bash
# Todas las mesas
curl -X GET http://localhost:8080/api/v1/tables \
  -H "Authorization: Bearer {accessToken}"

# Mesa específica
curl -X GET http://localhost:8080/api/v1/tables/1 \
  -H "Authorization: Bearer {accessToken}"
```

**Response 200 OK**:
```json
[
  { "id": 1, "tableNumber": 1, "capacity": 2, "status": "AVAILABLE" },
  { "id": 2, "tableNumber": 2, "capacity": 2, "status": "OCCUPIED" },
  { "id": 3, "tableNumber": 3, "capacity": 4, "status": "AVAILABLE" }
]
```

**Estados de Mesa**:
- `AVAILABLE` 🟢 - Disponible para tomar orden
- `OCCUPIED` 🔴 - Ocupada con orden activa
- `RESERVED` 🟡 - Reservada

---

## 🏗️ Estructura de Requests/Responses

### Respuestas Exitosas (2xx)
```json
// Lista (GET multiple)
[{ "id": 1, ... }, { "id": 2, ... }]

// Individual (GET single / POST / PUT)
{ "id": 1, "field1": "value1" }
```

### Errores (4xx/5xx)
```json
{ "code": 400, "message": "Descripción del error" }
```

---

## 📊 Flujo Recomendado de Carga de Datos

```javascript
async function initializeApp(accessToken) {
  try {
    // Cargar EN PARALELO
    const [categories, optionCategories, products, productOptions, tables] = await Promise.all([
      fetch('/api/v1/categories').then(r => r.json()),
      fetch('/api/v1/option-categories').then(r => r.json()),
      fetch('/api/v1/products').then(r => r.json()),
      fetch('/api/v1/product-options').then(r => r.json()),
      fetch('/api/v1/tables').then(r => r.json())
    ]);
    
    // Guardar en estado global
    window.appData = { categories, optionCategories, products, productOptions, tables };
    
    return window.appData;
  } catch (error) {
    console.error('Error cargando datos:', error);
  }
}
```

---

## 🛒 Crear Órdenes: POST /api/v1/orders

**Descripción**: Crea una nueva orden para una mesa específica

**Método**: `POST` | **Ruta**: `/api/v1/orders` | **Auth**: Requerida

### ⚠️ REGLAS IMPORTANTES PARA OPCIONES

- Si `product.hasOptions = true` → **OBLIGATORIO** enviar `selectedOptionIds` (no vacío)
- Si `product.hasOptions = false` → **PROHIBIDO** enviar `selectedOptionIds` (usar `null` o `[]`)
- **TODAS** las opciones **DEBEN** pertenecer al producto

### Request Body
```json
{
  "tableId": 1,
  "details": [
    {
      "productId": 1,
      "instructions": "Sin cebolla",
      "selectedOptionIds": [1, 2]
    },
    {
      "productId": 5,
      "instructions": "Temperatura fría",
      "selectedOptionIds": [15]
    }
  ]
}
```

### Descripción de Campos
| Campo | Tipo | Requerido | Descripción |
|-------|------|----------|------------|
| `tableId` | Long | ✅ | ID de mesa (debe estar AVAILABLE) |
| `details` | Array | ✅ | Mínimo 1 producto |
| `details[].productId` | Long | ✅ | ID del producto |
| `details[].instructions` | String | ❌ | Máximo 500 caracteres |
| `details[].selectedOptionIds` | Array | Condicional | Según `hasOptions` |

### cURL
```bash
curl -X POST http://localhost:8080/api/v1/orders \
  -H "Authorization: Bearer {accessToken}" \
  -H "Content-Type: application/json" \
  -d '{
    "tableId": 1,
    "details": [{
      "productId": 1,
      "instructions": "Sin cebolla",
      "selectedOptionIds": [1, 2]
    }]
  }'
```

### Response 201 Created
```json
{
  "id": 42,
  "date": "2026-03-15T14:30:00Z",
  "status": "QUEUE",
  "tableId": 1,
  "details": [
    {
      "id": 101,
      "productId": 1,
      "unitPrice": 12.99,
      "instructions": "Sin cebolla",
      "options": [
        { "id": 1, "name": "Pequeña (10\")" },
        { "id": 2, "name": "Extra Queso" }
      ]
    }
  ]
}
```

---

## ✅ Validaciones Requeridas

### Validar ANTES de enviar al servidor:
```javascript
function validateOrder(tableId, details, appData) {
  const errors = [];
  
  // Validar mesa
  const table = appData.tables.find(t => t.id === tableId);
  if (!table || table.status !== 'AVAILABLE') {
    errors.push('Mesa no disponible');
  }
  
  // Validar productos
  for (const detail of details) {
    const product = appData.products.find(p => p.id === detail.productId);
    
    if (!product) errors.push(`Producto ${detail.productId} no existe`);
    if (!product.active) errors.push(`Producto inactivo`);
    
    // Validar opciones
    if (product.hasOptions && (!detail.selectedOptionIds || detail.selectedOptionIds.length === 0)) {
      errors.push(`${product.name} REQUIERE opciones`);
    }
    if (!product.hasOptions && detail.selectedOptionIds?.length > 0) {
      errors.push(`${product.name} NO soporta opciones`);
    }
  }
  
  if (errors.length > 0) throw new Error(errors.join('\n'));
  return true;
}
```

---

## 🔴 Códigos de Error - Referencia Completa

### 400 Bad Request
```json
{ "code": 400, "message": "Option 50 is not valid for product 1" }
{ "code": 400, "message": "Product '1' requires options to be selected" }
{ "code": 400, "message": "Product '5' does not support options" }
```

### 404 Not Found
```json
{ "code": 404, "message": "Table not found" }
{ "code": 404, "message": "Product not found" }
```

### 409 Conflict
```json
{ "code": 409, "message": "Table is not available" }
```

### 401 Unauthorized
```json
{ "code": 401, "message": "Unauthorized" }
```

---

## 📊 Matriz de Escenarios

| Escenario | hasOptions | selectedOptionIds | Resultado |
|-----------|-----------|-------------------|-----------|
| Bebida simple | `false` | `null` o `[]` | ✅ Crear |
| Bebida con opciones | `false` | `[1, 2]` | ❌ Error 400 |
| Producto personalizable sin opciones | `true` | `null` o `[]` | ❌ Error 400 |
| Producto personalizable con opciones | `true` | `[1, 2]` | ✅ Crear |
| Producto con opción inválida | `true` | `[99]` | ❌ Error 400 |

---

## 💻 Ejemplos de Implementación

### Ejemplo 1: Carga Inicial
```javascript
async function initializeRestaurantApp(accessToken) {
  const headers = { 'Authorization': `Bearer ${accessToken}` };
  
  const [categories, options, products, productOptions, tables] = await Promise.all([
    fetch('/api/v1/categories', { headers }).then(r => r.json()),
    fetch('/api/v1/option-categories', { headers }).then(r => r.json()),
    fetch('/api/v1/products', { headers }).then(r => r.json()),
    fetch('/api/v1/product-options', { headers }).then(r => r.json()),
    fetch('/api/v1/tables', { headers }).then(r => r.json())
  ]);
  
  window.appData = { categories, options, products, productOptions, tables };
  return window.appData;
}
```

### Ejemplo 2: Crear Orden Completa
```javascript
async function createOrderFlow(tableId, items, accessToken) {
  try {
    // Validar
    validateOrder(tableId, items, window.appData);
    
    // Preparar
    const details = items.map(item => ({
      productId: item.productId,
      instructions: item.instructions || '',
      selectedOptionIds: item.optionIds || []
    }));
    
    // Enviar
    const response = await fetch('/api/v1/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ tableId, details })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message);
    }
    
    const order = await response.json();
    console.log('✅ Orden creada:', order.id);
    return order;
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}
```

---

## 🐛 TROUBLESHOOTING

| Problema | Causa | Solución |
|----------|-------|----------|
| "Option X is not valid" | Opción no pertenece al producto | Validar opciones antes de enviar |
| "requires options" | hasOptions=true sin opciones | Enviar al menos 1 opción |
| "does not support options" | hasOptions=false con opciones | No enviar `selectedOptionIds` |
| "Table not found" | ID de mesa inválido | Verificar que mesa existe |
| "Table is not available" | Mesa OCCUPIED/RESERVED | Seleccionar otra mesa disponible |
| "401 Unauthorized" | Token expirado | Renovar token con `/api/auth/refresh` |

---

## 📞 SOPORTE

**API Status**: ✅ Producción Ready  
**Last Updated**: 2026-03-15  
**Version**: 1.0.0

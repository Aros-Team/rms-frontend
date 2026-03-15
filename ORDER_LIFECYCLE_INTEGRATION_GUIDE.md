# 📖 GUÍA DE INTEGRACIÓN: CICLO DE VIDA DE ÓRDENES

## Para Desarrolladores Frontend

Esta guía te muestra cómo gestionar el ciclo de vida de una orden en el **Restaurant Management System (RMS)**. Incluye todos los endpoints necesarios para crear, actualizar y transitar órdenes por los diferentes estados.

---

## 📚 ÍNDICE

1. [Estados de la Orden](#-estados-de-la-orden)
2. [Endpoints del Ciclo de Vida](#-endpoints-del-ciclo-de-vida)
3. [Diagrama de Transiciones](#-diagrama-de-transiciones)
4. [Consultar Órdenes](#-consultar-órdenes-get-apiv1orders)
5. [Crear Orden](#-crear-orden-post-apiv1orders)
6. [Actualizar Orden](#-actualizar-orden-put-apiv1ordersid)
7. [Cancelar Orden](#-cancelar-orden-put-apiv1ordersidcancel)
8. [Iniciar Preparación](#-iniciar-preparación-put-apiv1ordersprepare)
9. [Marcar como Lista](#-marcar-como-lista-put-apiv1ordersidready)
10. [Entregar Orden](#-entregar-orden-put-apiv1ordersiddeliver)
11. [Validaciones](#-validaciones-requeridas)
12. [Códigos de Error](#-códigos-de-error-referencia-completa)
13. [Ejemplos de Implementación](#-ejemplos-de-implementación)
14. [Troubleshooting](#-troubleshooting)

---

## 🔄 Estados de la Orden

| Estado | Descripción | Icono |
|--------|-------------|-------|
| `QUEUE` | Orden creada, esperando en cola para ser preparada | 🟡 |
| `PREPARING` | Orden siendo preparada en cocina | 🔵 |
| `READY` | Orden lista para ser entregada/recogida | 🟢 |
| `DELIVERED` | Orden entregada al cliente | ✅ |
| `CANCELLED` | Orden cancelada | ❌ |

---

## 🛠️ Endpoints del Ciclo de Vida

| Método | Endpoint | Transición | Descripción |
|--------|----------|------------|-------------|
| `POST` | `/api/v1/orders` | - | Crear nueva orden (inicia en QUEUE) |
| `GET` | `/api/v1/orders` | - | Consultar órdenes con filtros |
| `PUT` | `/api/v1/orders/{id}` | QUEUE → QUEUE | Actualizar detalles de orden |
| `PUT` | `/api/v1/orders/{id}/cancel` | QUEUE → CANCELLED | Cancelar orden |
| `PUT` | `/api/v1/orders/prepare` | QUEUE → PREPARING | Procesar siguiente orden de cola |
| `PUT` | `/api/v1/orders/{id}/ready` | PREPARING → READY | Marcar orden como lista |
| `PUT` | `/api/v1/orders/{id}/deliver` | READY → DELIVERED | Entregar orden y liberar mesa |

---

## 🔀 Diagrama de Transiciones

```
                    ┌─────────────────────────────────┐
                    │                                 │
                    ▼                                 │
              ┌─────────┐                            │
     ┌───────▶│  QUEUE  │◀────────────┐             │
     │        └────┬────┘             │             │
     │             │                  │             │
     │             │ POST              │ PUT         │
     │             │ /orders           │ /prepare    │
     │             ▼                  ▼             │
     │        ┌───────────┐    ┌─────────────┐      │
     │        │PREPARING  │───▶│   READY     │      │
     │        └───────────┘    └──────┬──────┘      │
     │                                   │            │
     │                                   │ PUT        │
     │                                   │ /deliver   │
     │                                   ▼            │
     │                              ┌───────────┐    │
     │                              │ DELIVERED │────┘
     │                              └───────────┘
     │
     │ PUT
     │ /cancel
     ▼
┌────────────┐
│ CANCELLED │
└───────────┘
```

---

## 📋 Consultar Órdenes: GET /api/v1/orders

**Descripción**: Retorna órdenes con filtros opcionales por estado y rango de fecha

**Método**: `GET` | **Ruta**: `/api/v1/orders` | **Auth**: Requerida

### Parámetros de Query

| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|-----------|-------------|
| `status` | String | ❌ | Filtrar por estado: QUEUE, PREPARING, READY, DELIVERED, CANCELLED |
| `startDate` | ISO DateTime | ❌ | Fecha inicio (ej: 2026-03-15T10:00:00) |
| `endDate` | ISO DateTime | ❌ | Fecha fin (ej: 2026-03-15T23:59:59) |

### Request
```bash
# Todas las órdenes
curl -X GET http://localhost:8080/api/v1/orders \
  -H "Authorization: Bearer {accessToken}"

# Órdenes en cola
curl -X GET "http://localhost:8080/api/v1/orders?status=QUEUE" \
  -H "Authorization: Bearer {accessToken}"

# Órdenes en preparación
curl -X GET "http://localhost:8080/api/v1/orders?status=PREPARING" \
  -H "Authorization: Bearer {accessToken}"

# Órdenes listas
curl -X GET "http://localhost:8080/api/v1/orders?status=READY" \
  -H "Authorization: Bearer {accessToken}"

# Órdenes de hoy
curl -X GET "http://localhost:8080/api/v1/orders?startDate=2026-03-15T00:00:00&endDate=2026-03-15T23:59:59" \
  -H "Authorization: Bearer {accessToken}"
```

### Response 200 OK
```json
[
  {
    "id": 1,
    "date": "2026-03-15T14:30:00",
    "status": "QUEUE",
    "tableId": 1,
    "details": [
      {
        "id": 1,
        "productId": 1,
        "productName": "Hamburguesa Clásica",
        "unitPrice": 12.50,
        "instructions": "Sin cebolla",
        "selectedOptions": [
          { "id": 1, "name": "Grande", "categoryName": "Tamaños" }
        ]
      }
    ]
  },
  {
    "id": 2,
    "date": "2026-03-15T14:35:00",
    "status": "PREPARING",
    "tableId": 2,
    "details": [...]
  },
  {
    "id": 3,
    "date": "2026-03-15T14:25:00",
    "status": "READY",
    "tableId": 3,
    "details": [...]
  }
]
```

### Descripción de Campos
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | Long | ID único de la orden |
| `date` | LocalDateTime | Fecha y hora de creación |
| `status` | String | Estado actual (QUEUE, PREPARING, READY, DELIVERED, CANCELLED) |
| `tableId` | Long | ID de la mesa asociada |
| `details` | Array | Lista de productos en la orden |

---

## ➕ Crear Orden: POST /api/v1/orders

**Descripción**: Crea una nueva orden en estado QUEUE

**Método**: `POST` | **Ruta**: `/api/v1/orders` | **Auth**: Requerida

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
      "instructions": "",
      "selectedOptionIds": [15]
    }
  ]
}
```

### Descripción de Campos
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `tableId` | Long | ✅ | ID de mesa (debe estar AVAILABLE) |
| `details` | Array | ✅ | Mínimo 1 producto |
| `details[].productId` | Long | ✅ | ID del producto |
| `details[].instructions` | String | ❌ | Máximo 500 caracteres |
| `details[].selectedOptionIds` | Array | Condicional | Según `hasOptions` del producto |

### Response 201 Created
```json
{
  "id": 42,
  "date": "2026-03-15T14:30:00",
  "status": "QUEUE",
  "tableId": 1,
  "details": [
    {
      "id": 101,
      "productId": 1,
      "productName": "Hamburguesa Clásica",
      "unitPrice": 12.50,
      "instructions": "Sin cebolla",
      "selectedOptions": [
        { "id": 1, "name": "Grande", "categoryName": "Tamaños" },
        { "id": 2, "name": "Extra Queso", "categoryName": "Extras" }
      ]
    }
  ]
}
```

---

## ✏️ Actualizar Orden: PUT /api/v1/orders/{id}

**Descripción**: Actualiza los detalles de una orden en estado QUEUE

**Método**: `PUT` | **Ruta**: `/api/v1/orders/{id}` | **Auth**: Requerida

### ⚠️ RESTRICCIÓN
- Solo se puede actualizar cuando el estado es `QUEUE`
- No se puede actualizar si ya está en `PREPARING`, `READY`, `DELIVERED` o `CANCELLED`

### Request Body
```json
{
  "tableId": 1,
  "details": [
    {
      "productId": 1,
      "instructions": "Sin cebolla, con tomate",
      "selectedOptionIds": [1, 3]
    }
  ]
}
```

### Response 200 OK
```json
{
  "id": 42,
  "date": "2026-03-15T14:30:00",
  "status": "QUEUE",
  "tableId": 1,
  "details": [...]
}
```

### Códigos de Error
- **404**: Orden no encontrada
- **409**: La orden no está en estado QUEUE, no se puede actualizar

---

## ❌ Cancelar Orden: PUT /api/v1/orders/{id}/cancel

**Descripción**: Cancela una orden en estado QUEUE

**Método**: `PUT` | **Ruta**: `/api/v1/orders/{id}/cancel` | **Auth**: Requerida

### ⚠️ RESTRICCIÓN
- Solo se puede cancelar cuando el estado es `QUEUE`
- Una vez que pasa a `PREPARING` no se puede cancelar

### Request
```bash
curl -X PUT http://localhost:8080/api/v1/orders/42/cancel \
  -H "Authorization: Bearer {accessToken}"
```

### Response 200 OK
```json
{
  "id": 42,
  "date": "2026-03-15T14:30:00",
  "status": "CANCELLED",
  "tableId": 1,
  "details": [...]
}
```

### Códigos de Error
- **404**: Orden no encontrada
- **409**: La orden no está en estado QUEUE, no se puede cancelar

---

## 🔄 Iniciar Preparación: PUT /api/v1/orders/prepare

**Descripción**: Toma la orden más antigua de la cola y cambia su estado a PREPARING

**Método**: `PUT` | **Ruta**: `/api/v1/orders/prepare` | **Auth**: Requerida

### ⚠️ IMPORTANTE
- Este endpoint **no requiere ID** - procesa automáticamente la orden más antigua en cola
- Transición: `QUEUE` → `PREPARING`
- Si no hay órdenes en cola, retorna error 409

### Request
```bash
curl -X PUT http://localhost:8080/api/v1/orders/prepare \
  -H "Authorization: Bearer {accessToken}"
```

### Response 200 OK
```json
{
  "id": 42,
  "date": "2026-03-15T14:30:00",
  "status": "PREPARING",
  "tableId": 1,
  "details": [...]
}
```

### Códigos de Error
- **409**: No hay órdenes en cola para preparar

---

## ✅ Marcar como Lista: PUT /api/v1/orders/{id}/ready

**Descripción**: Marca una orden específica como lista para entregar

**Método**: `PUT` | **Ruta**: `/api/v1/orders/{id}/ready` | **Auth**: Requerida

### ⚠️ RESTRICCIÓN
- Solo se puede ejecutar cuando el estado es `PREPARING`
- Transición: `PREPARING` → `READY`

### Request
```bash
curl -X PUT http://localhost:8080/api/v1/orders/42/ready \
  -H "Authorization: Bearer {accessToken}"
```

### Response 200 OK
```json
{
  "id": 42,
  "date": "2026-03-15T14:30:00",
  "status": "READY",
  "tableId": 1,
  "details": [...]
}
```

### Códigos de Error
- **404**: Orden no encontrada
- **409**: La orden no está en estado PREPARING

---

## 📦 Entregar Orden: PUT /api/v1/orders/{id}/deliver

**Descripción**: Marca una orden como entregada y libera la mesa

**Método**: `PUT` | **Ruta**: `/api/v1/orders/{id}/deliver` | **Auth**: Requerida

### ⚠️ RESTRICCIÓN
- Solo se puede ejecutar cuando el estado es `READY`
- Transición: `READY` → `DELIVERED`
- Al entregar, la mesa asociada se libera automáticamente

### Request
```bash
curl -X PUT http://localhost:8080/api/v1/orders/42/deliver \
  -H "Authorization: Bearer {accessToken}"
```

### Response 200 OK
```json
{
  "id": 42,
  "date": "2026-03-15T14:30:00",
  "status": "DELIVERED",
  "tableId": 1,
  "details": [...]
}
```

### Códigos de Error
- **404**: Orden no encontrada
- **409**: La orden no está en estado READY

---

## ✅ Validaciones Requeridas

### Validar Estados Antes de Transicionar

```javascript
// Validar que se puede actualizar orden
async function canUpdateOrder(orderId, accessToken) {
  const response = await fetch(`/api/v1/orders?status=QUEUE`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  const orders = await response.json();
  const order = orders.find(o => o.id === orderId);
  return order && order.status === 'QUEUE';
}

// Validar que se puede iniciar preparación
async function canStartPreparation(accessToken) {
  const response = await fetch('/api/v1/orders?status=QUEUE', {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  const orders = await response.json();
  return orders.length > 0;
}

// Validar que se puede marcar como lista
async function canMarkAsReady(orderId, accessToken) {
  const response = await fetch(`/api/v1/orders?status=PREPARING`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  const orders = await response.json();
  const order = orders.find(o => o.id === orderId);
  return order && order.status === 'PREPARING';
}

// Validar que se puede entregar
async function canDeliver(orderId, accessToken) {
  const response = await fetch(`/api/v1/orders?status=READY`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  const orders = await response.json();
  const order = orders.find(o => o.id === orderId);
  return order && order.status === 'READY';
}
```

### Matriz de Transiciones Válidas

| Acción | Estado Actual | Estado Resultado | ¿Válido? |
|--------|---------------|------------------|----------|
| Crear orden | - | QUEUE | ✅ |
| Actualizar | QUEUE | QUEUE | ✅ |
| Actualizar | PREPARING | - | ❌ |
| Cancelar | QUEUE | CANCELLED | ✅ |
| Cancelar | PREPARING | - | ❌ |
| Preparar siguiente | QUEUE | PREPARING | ✅ |
| Marcar lista | PREPARING | READY | ✅ |
| Marcar lista | QUEUE | - | ❌ |
| Entregar | READY | DELIVERED | ✅ |
| Entregar | PREPARING | - | ❌ |

---

## 🔴 Códigos de Error - Referencia Completa

### 400 Bad Request
```json
{ "code": 400, "message": "Invalid input data" }
```

### 404 Not Found
```json
{ "code": 404, "message": "Order not found" }
```

### 409 Conflict
```json
{ "code": 409, "message": "Order is not in QUEUE status" }
{ "code": 409, "message": "Order is not in PREPARING status" }
{ "code": 409, "message": "Order is not in READY status" }
{ "code": 409, "message": "No orders in queue to prepare" }
```

### 401 Unauthorized
```json
{ "code": 401, "message": "Unauthorized" }
```

---

## 📊 Flujo Completo del Ciclo de Vida

```
1. CREAR ORDEN (cliente hace pedido)
   POST /api/v1/orders
   → Estado: QUEUE 🟡

2. ACTUALIZAR (si hay cambios antes de prep)
   PUT /api/v1/orders/{id}
   → Estado: QUEUE 🟡

3. CANCELAR (si el cliente cambia de opinión)
   PUT /api/v1/orders/{id}/cancel
   → Estado: CANCELLED ❌

4. PROCESAR SIGUIENTE (cocinero inicia preparación)
   PUT /api/v1/orders/prepare
   → Estado: PREPARING 🔵

5. MARCAR COMO LISTA (cocinero termina)
   PUT /api/v1/orders/{id}/ready
   → Estado: READY 🟢

6. ENTREGAR (mesero/cajero entrega al cliente)
   PUT /api/v1/orders/{id}/deliver
   → Estado: DELIVERED ✅ (mesa se libera)
```

---

## 💻 Ejemplos de Implementación

### Ejemplo 1: Panel de Cocina - Tomar siguiente orden

```javascript
async function processNextOrder(accessToken) {
  try {
    // 1. Verificar si hay órdenes en cola
    const queueResponse = await fetch('/api/v1/orders?status=QUEUE', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    const queueOrders = await queueResponse.json();
    
    if (queueOrders.length === 0) {
      console.log('No hay órdenes en cola');
      return null;
    }
    
    // 2. Procesar siguiente orden (la más antigua)
    const response = await fetch('/api/v1/orders/prepare', {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message);
    }
    
    const order = await response.json();
    console.log('✅ Orden en preparación:', order.id);
    return order;
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}
```

### Ejemplo 2: Mostrador - Marcar orden como lista

```javascript
async function markOrderAsReady(orderId, accessToken) {
  try {
    const response = await fetch(`/api/v1/orders/${orderId}/ready`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message);
    }
    
    const order = await response.json();
    console.log('✅ Orden lista:', order.id);
    return order;
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}
```

### Ejemplo 3: Mesero - Entregar orden

```javascript
async function deliverOrder(orderId, accessToken) {
  try {
    const response = await fetch(`/api/v1/orders/${orderId}/deliver`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message);
    }
    
    const order = await response.json();
    console.log('✅ Orden entregada:', order.id);
    console.log('Mesa liberada');
    return order;
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}
```

### Ejemplo 4: Dashboard - Consultar todas las órdenes por estado

```javascript
async function getOrdersByStatus(status, accessToken) {
  const url = status 
    ? `/api/v1/orders?status=${status}` 
    : '/api/v1/orders';
    
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  
  return await response.json();
}

// Uso:
// getOrdersByStatus('QUEUE', token)    - Órdenes en espera
// getOrdersByStatus('PREPARING', token) - Órdenes en cocina
// getOrdersByStatus('READY', token)     - Órdenes listas
// getOrdersByStatus(null, token)        - Todas las órdenes
```

### Ejemplo 5: Cliente - Cancelar orden (antes de preparación)

```javascript
async function cancelOrder(orderId, accessToken) {
  try {
    const response = await fetch(`/api/v1/orders/${orderId}/cancel`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message);
    }
    
    const order = await response.json();
    console.log('❌ Orden cancelada:', order.id);
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
| "Order is not in QUEUE status" | Intentar actualizar orden que ya inició preparación | Solo actualizar en estado QUEUE |
| "Order is not in PREPARING status" | Intentar marcar como lista sin haber iniciado preparación | Primero ejecutar /prepare |
| "Order is not in READY status" | Intentar entregar orden que no está lista | Primero ejecutar /ready |
| "No orders in queue to prepare" | No hay órdenes en estado QUEUE | Verificar que existan órdenes en cola |
| "Order not found" | ID de orden inválido | Verificar el ID de la orden |
| "401 Unauthorized" | Token expirado | Renovar token con `/api/auth/refresh` |

---

## 📞 SOPORTE

**API Status**: ✅ Producción Ready  
**Last Updated**: 2026-03-15  
**Version**: 1.0.0
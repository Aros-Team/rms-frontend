# Módulo de Gestión de Turnos (Schedules/Shifts) — API Reference

**Base URL:** `/api/v1`

---

## Autenticación — JWT Claims

El access token JWT incluye **un nuevo claim** que el frontend debe conocer:

| Claim | Tipo | Descripción |
|-------|------|-------------|
| `type` | `string` | `"access"` |
| `role` | `string` | `"ADMIN"` \| `"WORKER"` |
| `restricted` | `boolean` | WORKER fuera de turno = `true`, ADMIN siempre `false` |

### Comportamiento del login para WORKER

1. Al autenticarse, el backend verifica si el worker tiene un turno activo en ese momento.
2. Si **NO** está dentro de su turno → `restricted: true` en el JWT.
3. Si está dentro de su turno → `restricted: false`.
4. El frontend debe **leer el claim `restricted`** del JWT (`principal.claims['restricted']`).
5. Solo los endpoints marcados con `@JustUnrestrictedWorker` o `@JustAdminUser` requieren `restricted=false`.

### Qué debe hacer el frontend con `restricted`

- Mostrar un banner o aviso al worker: _"Fuera de turno — Acceso limitado"_.
- Deshabilitar / ocultar funcionalidades que requieren estar en turno (ej: panel de pedidos, inventario).
- La consulta del horario personal **siempre está disponible** aunque esté restringido.

---

## 1. CRUD de Horarios (Schedules)

> **Rol requerido:** `ADMIN`

### `POST /api/v1/schedules`

Crear un horario (plantilla reutilizable con turnos).

**Request body:**

```json
{
  "name": "Morning",
  "description": "Morning shift for kitchen staff",
  "shifts": [
    {
      "dayOfWeek": "MONDAY",
      "startTime": "08:00",
      "endTime": "12:00"
    },
    {
      "dayOfWeek": "MONDAY",
      "startTime": "14:00",
      "endTime": "18:00"
    },
    {
      "dayOfWeek": "TUESDAY",
      "startTime": "08:00",
      "endTime": "12:00"
    }
  ]
}
```

| Campo | Tipo | Obligatorio | Descripción |
|-------|------|-------------|-------------|
| `name` | `string` | sí | Nombre único del horario |
| `description` | `string` | no | Descripción opcional |
| `shifts` | `array` | sí | Mínimo 1 turno |
| `shifts[].dayOfWeek` | `string` | sí | `MONDAY`, `TUESDAY`, `WEDNESDAY`, `THURSDAY`, `FRIDAY`, `SATURDAY`, `SUNDAY` |
| `shifts[].startTime` | `string` (HH:mm) | sí | Hora de inicio del turno |
| `shifts[].endTime` | `string` (HH:mm) | sí | Hora de fin (debe ser posterior a startTime) |

**Reglas de validación:**

- `name` no puede repetirse (devuelve `409`).
- Los turnos **no deben solaparse** dentro del mismo schedule en el mismo día.
- `startTime` debe ser anterior a `endTime`.

**Response `201`:**

```json
{
  "id": 1,
  "name": "Morning",
  "description": "Morning shift for kitchen staff",
  "shifts": [
    {
      "id": 10,
      "dayOfWeek": "MONDAY",
      "startTime": "08:00",
      "endTime": "12:00"
    },
    {
      "id": 11,
      "dayOfWeek": "MONDAY",
      "startTime": "14:00",
      "endTime": "18:00"
    },
    {
      "id": 12,
      "dayOfWeek": "TUESDAY",
      "startTime": "08:00",
      "endTime": "12:00"
    }
  ]
}
```

**Errores:** `400` input inválido, `409` nombre duplicado

---

### `GET /api/v1/schedules`

Listar todos los horarios.

**Response `200`:**

```json
[
  {
    "id": 1,
    "name": "Morning",
    "description": "...",
    "shifts": [...]
  },
  {
    "id": 2,
    "name": "Evening",
    "description": "...",
    "shifts": [...]
  }
]
```

---

### `GET /api/v1/schedules/{id}`

Obtener un horario por ID.

**Response `200`:** Ídem `POST` response.

**Errores:** `404` no encontrado

---

### `PUT /api/v1/schedules/{id}`

Actualizar un horario existente. Mismo body que `POST`.

**Errores:** `404` no encontrado, `409` nombre duplicado

---

### `DELETE /api/v1/schedules/{id}`

Eliminar un horario. No se puede eliminar si tiene asignaciones activas.

**Response `204`:** Sin contenido.

**Errores:** `404` no encontrado, `409` tiene asignaciones activas

---

## 2. Asignación de Horarios a Workers

> **Rol requerido:** `ADMIN`

### `POST /api/v1/workers/{workerId}/schedule-assignments`

Asignar un horario a un trabajador.

**Request body:**

```json
{
  "scheduleId": 1
}
```

| Campo | Tipo | Obligatorio | Descripción |
|-------|------|-------------|-------------|
| `scheduleId` | `Long` | sí | ID del horario a asignar |

**Validaciones:**

- El backend verifica que el schedule existe (`404` si no).
- **Valida solapamiento**: no permite la asignación si alguno de los turnos del nuevo schedule se solapa con los turnos ya asignados al worker.

**Response `201`:** Sin contenido.

**Errores:** `404` schedule no encontrado, `409` solapamiento detectado

---

### `GET /api/v1/workers/{workerId}/schedule-assignments`

Listar los IDs de horarios asignados a un worker.

**Response `200`:**

```json
[1, 3, 5]
```

---

### `DELETE /api/v1/workers/{workerId}/schedule-assignments/{assignmentId}`

Eliminar una asignación (desvincular horario del worker).

**Response `204`:** Sin contenido.

---

## 3. Consultar Mi Horario

> **Rol requerido:** `WORKER` o `ADMIN`

### `GET /api/v1/workers/me/schedule`

Obtiene el horario completo del worker autenticado. **Disponible incluso cuando `restricted=true`.**

**Response `200`:**

```json
{
  "days": [
    {
      "dayOfWeek": "MONDAY",
      "shifts": [
        {
          "scheduleName": "Morning",
          "startTime": "08:00",
          "endTime": "12:00"
        },
        {
          "scheduleName": "Evening",
          "startTime": "14:00",
          "endTime": "18:00"
        }
      ]
    },
    {
      "dayOfWeek": "TUESDAY",
      "shifts": [
        {
          "scheduleName": "Morning",
          "startTime": "08:00",
          "endTime": "12:00"
        }
      ]
    },
    {
      "dayOfWeek": "WEDNESDAY",
      "shifts": []
    }
  ]
}
```

**Notas para el frontend:**

- Los **7 días de la semana** siempre aparecen como entrada, incluso si no tienen turnos asignados.
- Si un día no tiene turnos, `shifts` será un array vacío `[]`.
- Múltiples schedules asignados al mismo worker se **combinan por día**.
- El campo `scheduleName` indica el nombre del horario del que proviene cada turno.
- Orden de días: `MONDAY` → `SUNDAY`.

---

## 4. Historial de Time Logs (Registros de Ingreso)

> **Rol requerido:** `ADMIN`

### `GET /api/v1/admin/time-logs`

Obtener historial de registros de ingreso de workers. Todos los parámetros son opcionales:

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `workerId` | `Long` | Filtrar por worker específico |
| `from` | `Instant` (ISO 8601) | Fecha y hora de inicio del filtro |
| `to` | `Instant` (ISO 8601) | Fecha y hora de fin del filtro |
| `withinShift` | `Boolean` | (reservado, no implementado aún) |

**Ejemplos de llamadas:**

```http
GET /api/v1/admin/time-logs
GET /api/v1/admin/time-logs?workerId=1
GET /api/v1/admin/time-logs?from=2026-01-01T00:00:00Z&to=2026-12-31T23:59:59Z
GET /api/v1/admin/time-logs?workerId=1&from=2026-05-01T00:00:00Z&to=2026-05-31T23:59:59Z
```

**Response `200`:**

```json
[
  {
    "id": 1,
    "workerId": 1,
    "timestamp": "2026-05-24T10:00:00Z",
    "type": "IN",
    "withinShift": true,
    "relatedShiftId": 10
  },
  {
    "id": 2,
    "workerId": 1,
    "timestamp": "2026-05-24T20:30:00Z",
    "type": "IN",
    "withinShift": false,
    "relatedShiftId": null
  }
]
```

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | `Long` | ID del registro |
| `workerId` | `Long` | ID del worker |
| `timestamp` | `Instant` | Momento exacto del registro (ISO 8601) |
| `type` | `string` | Siempre `"IN"` (registro de ingreso) |
| `withinShift` | `boolean` | `true` si el worker estaba dentro de un turno en ese momento |
| `relatedShiftId` | `Long` | ID del turno específico (si `withinShift=true`), `null` si no |

---

## 5. Registro de Time Log (Automático al Login)

No hay un endpoint público para esto. El time log se registra **automáticamente** cuando un worker inicia sesión exitosamente.

**Flujo completo para un WORKER que inicia sesión:**

```
Login (POST /api/v1/auth/login)
  │
  ├─ Backend registra TimeLog (ingreso)
  │
  ├─ Backend determina restricted = !withinShift
  │
  └─ Backend genera JWT con claim "restricted": true/false
       │
       └─ Frontend recibe token → lee claim "restricted"
            → muestra estado al worker
```

El frontend no necesita hacer nada adicional; solo debe leer el claim `restricted` del JWT devuelto.

---

## Resumen de Códigos HTTP

| Código | Significado | Uso |
|--------|-------------|-----|
| `201` | Creado | POST schedules, POST assignments |
| `200` | OK | GET, PUT |
| `204` | Sin contenido | DELETE |
| `400` | Input inválido | Validación de campos fallida |
| `403` | Prohibido | Worker fuera de turno intentando acceder a recurso restringido |
| `404` | No encontrado | Schedule, worker o asignación no existe |
| `409` | Conflicto | Nombre duplicado, solapamiento de turnos, schedule con asignaciones activas |

---

## Recomendaciones para el Frontend

1. **Decodificar el JWT en el cliente** — Usar una librería como `jwt-decode` para leer los claims `role` y `restricted`.

2. **Mostrar estado de restricción** — Cuando `restricted === true` para un worker, mostrar un banner visible y persistente indicando que está fuera de turno.

3. **Control de acceso condicional** — Basado en `restricted`, ocultar o deshabilitar secciones/funcionalidades que requieren turno activo:
   - Panel de pedidos activos
   - Gestión de inventario
   - Acciones de cocina / preparación

4. **Consulta de horario siempre disponible** — El endpoint `GET /workers/me/schedule` funciona incluso con `restricted=true`. Úsalo para mostrar al worker cuándo es su próximo turno.

5. **Selector de día** — Usar los valores de `dayOfWeek` tal como llegan de la API: `MONDAY`, `TUESDAY`, `WEDNESDAY`, `THURSDAY`, `FRIDAY`, `SATURDAY`, `SUNDAY`.

6. **Formato de hora** — Siempre en formato 24h (`HH:mm`).

7. **Endpoints de administración** — Todos los endpoints CRUD (`/schedules/*`) y de asignación requieren `role: "ADMIN"` en el JWT.

8. **Múltiples horarios por worker** — Un worker puede tener varios schedules asignados. Los turnos se combinan automáticamente en la respuesta de `GET /workers/me/schedule`.

# Documento Técnico - Histórico de Cambios Salariales (Frontend)

## 1. Resumen de Cambios

Se agregó el concepto de **salario** a los usuarios (role `WORKER`) con un **histórico inmutable** de cambios salariales. Esto impacta los flujos de creación, actualización y consulta de usuarios.

---

## 2. Cambios en API

### 2.1 POST /api/v1/users (Crear usuario)

**Nuevo campo en request body:**

| Campo | Tipo | Obligatorio | Descripción |
|-------|------|-------------|-------------|
| `salary` | `number` (decimal) | No | Salario inicial del trabajador. Solo aplica para role WORKER |

**Ejemplo request:**
```json
{
  "document": "1234567890",
  "name": "Juan Pérez",
  "email": "juan@example.com",
  "address": "Calle 123",
  "phone": "3001234567",
  "areas": [1, 2],
  "salary": 2500000.00
}
```

**Comportamiento:**
- Si `salary` se envía, el usuario se crea con ese salario y se genera automáticamente un registro en el histórico con:
  - `oldSalary: null`
  - `reason: "CREACION"`
  - `observations: "Salario inicial"`
- Si `salary` no se envía, el usuario se crea sin salario (`null`)
- Si `salary <= 0`, responde **400 Bad Request**

**Nuevo campo en response body (`UserResponse`):**

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `salary` | `number` o `null` | Salario actual del usuario |

**Ejemplo response:**
```json
{
  "id": 1,
  "document": "1234567890",
  "name": "Juan Pérez",
  "email": "juan@example.com",
  "address": "Calle 123",
  "phone": "3001234567",
  "role": "WORKER",
  "status": "PENDING",
  "assignedAreas": [1, 2],
  "salary": 2500000.00
}
```

---

### 2.2 PUT /api/v1/users/{id} (Actualizar usuario)

**Nuevos campos en request body:**

| Campo | Tipo | Obligatorio | Descripción |
|-------|------|-------------|-------------|
| `salary` | `number` (decimal) | No | Nuevo salario. `null` o ausente = no cambiar |
| `reason` | `string` | **Sí, si salary cambia** | Razón/justificación del cambio salarial |
| `observations` | `string` | No | Observaciones adicionales |

**Ejemplo request (con cambio salarial):**
```json
{
  "document": "1234567890",
  "name": "Juan Pérez",
  "email": "juan@example.com",
  "address": "Calle 456",
  "phone": "3001234567",
  "areas": [1, 2, 3],
  "salary": 3000000.00,
  "reason": "Aumento anual",
  "observations": "Corresponde al periodo 2026"
}
```

**Ejemplo request (sin cambio salarial):**
```json
{
  "document": "1234567890",
  "name": "Juan Pérez",
  "email": "juan@example.com",
  "address": "Calle 456",
  "phone": "3001234567",
  "areas": [1, 2, 3],
  "salary": null,
  "reason": null,
  "observations": null
}
```
O simplemente omitir `salary`, `reason`, `observations`.

**Comportamiento:**
- Si `salary` no se envía o es `null`: el salario actual se mantiene sin cambios
- Si `salary` se envía y es **diferente** al actual:
  - `reason` es **obligatorio** (si falta → **400 Bad Request**)
  - Se actualiza el salario del usuario
  - Se crea registro en el histórico con `oldSalary` (anterior), `newSalary` (nuevo), `reason`, `observations`
- Si `salary` se envía y es **igual** al actual: no se realiza ningún cambio salarial ni se genera histórico
- Si `salary <= 0`: **400 Bad Request**

**Nueva validación:**
```
400 Bad Request - "La razón es obligatoria cuando se cambia el salario"
```

---

### 2.3 GET /api/v1/users/{id}/salary-history (Nuevo endpoint)

**Método:** `GET`  
**URL:** `/api/v1/users/{id}/salary-history`  
**Autenticación:** Solo ADMIN (`@JustAdminUser`)  
**Response 200:**

```json
[
  {
    "oldSalary": 2500000.00,
    "newSalary": 3000000.00,
    "changedAt": "2026-05-24T10:30:00Z",
    "reason": "Aumento anual",
    "observations": "Corresponde al periodo 2026"
  },
  {
    "oldSalary": null,
    "newSalary": 2500000.00,
    "changedAt": "2024-01-15T08:00:00Z",
    "reason": "CREACION",
    "observations": "Salario inicial"
  }
]
```

**Códigos de respuesta:**

| Código | Descripción |
|--------|-------------|
| 200 | Lista del historial (puede ser vacía `[]`) |
| 404 | Usuario no encontrado |

**Reglas de presentación:**
- Lista ordenada por `changedAt` descendente (más reciente primero)
- `oldSalary: null` indica que fue el salario inicial
- El historial es **inmutable**: no se puede modificar ni eliminar entradas

---

## 3. Nuevos Códigos de Error

| Código | Mensaje | Causa |
|--------|---------|-------|
| 400 | `"El salario debe ser un valor positivo"` | `salary <= 0` en creación o actualización |
| 400 | `"La razón es obligatoria cuando se cambia el salario"` | `salary` cambia pero `reason` no se envió o está vacío |

---

## 4. Recomendaciones para el Frontend

### Formulario de Creación de Usuario
- Agregar campo **"Salario"** de tipo `number` (opcional)
- Validar en frontend: `> 0` si se ingresa un valor
- Mostrar tooltip: "Solo aplica para trabajadores"

### Formulario de Edición de Usuario
- Agregar campo **"Salario"** de tipo `number` (opcional, pre-cargado con valor actual)
- Si el usuario modifica el salario, mostrar campos **"Razón"** (obligatorio) y **"Observaciones"** (opcional)
- Si el usuario no modifica el salario, ocultar los campos de razón/observaciones

### Pantalla de Detalle de Usuario
- Mostrar campo **"Salario"** con formato moneda (`$ 2.500.000`)
- Agregar botón/enlace **"Ver historial salarial"** que redirige a la nueva vista

### Nueva Pantalla: Historial Salarial
- Tabla con columnas: Fecha/Hora, Salario Anterior, Salario Nuevo, Razón, Observaciones
- Ordenar por fecha descendente
- Para el registro inicial: columna "Salario Anterior" debe mostrar `-` o `N/A`
- Acceso: solo ADMIN (el mismo endpoint ya verifica permisos)

### Manejo de Errores
- Mostrar mensajes de error del backend para validaciones de salario
- El error `400` con mensaje `"La razón es obligatoria..."` debe mostrar el campo `reason` como requerido

---

## 5. Reglas de Negocio (para UI)

| Regla | Comportamiento en UI |
|-------|---------------------|
| Solo WORKER puede tener salario | Si el role es ADMIN, `salary` debe estar deshabilitado/oculto |
| Salario debe ser > 0 | Validación en frontend: `> 0` |
| Razón obligatoria si cambia salario | Mostrar campo `reason` como requerido solo cuando `salary` cambie |
| Histórico es inmutable | No mostrar botones de editar/eliminar en la tabla de historial |
| Solo ADMIN ve el historial | El endpoint ya lo protege, pero la UI puede ocultar el botón para no-ADMIN |

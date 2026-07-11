# Requisitos Técnicos — Histórico de Cambios Salariales (Frontend)

> Fecha: 2026-05-24
> Proyecto: RMS Frontend
> Feature: Histórico de Salarios (Salary History)

---

## 1. Modelos/DTOs

### 1.1 `CreateUserRequest` — Modificar existente

**Archivo:** `src/app/shared/models/dto/users/create-user-request.model.ts`

Agregar campo:

```typescript
export interface CreateUserRequest {
  document: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  areas: number[];
  salary?: number | null;  // NUEVO
}
```

**Reglas:**
- Opcional: si no se envía, el usuario se crea sin salario
- Si se envía, debe ser > 0 (validación backend + frontend)
- Solo aplica para role WORKER (el backend lo valida)

### 1.2 `UserResponse` — Modificar existente

**Archivo:** `src/app/shared/models/dto/users/user-response.model.ts`

Agregar campo:

```typescript
export interface UserResponse {
  id?: number;
  document: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  role?: 'ADMIN' | 'WORKER';
  status?: 'PENDING' | 'ERROR' | 'ACTIVE' | 'INACTIVE';
  assignedAreas?: number[];
  salary?: number | null;  // NUEVO
}
```

### 1.3 `UpdateUserRequest` — Modificar existente

**Archivo:** `src/app/shared/models/dto/users/user-response.model.ts`

Agregar campos:

```typescript
export interface UpdateUserRequest {
  document: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  areas: number[];
  salary?: number | null;     // NUEVO
  reason?: string | null;      // NUEVO
  observations?: string | null; // NUEVO
}
```

**Reglas de negocio:**
- `salary: null`: no cambiar el salario actual
- `salary` presente y diferente al actual: requiere `reason` (string no vacío)
- `salary` igual al actual: no genera cambios en backend, no se debe enviar en el request

### 1.4 `SalaryHistoryEntry` — Nuevo modelo

**Archivo:** `src/app/shared/models/dto/users/salary-history-entry.model.ts`

```typescript
export interface SalaryHistoryEntry {
  oldSalary: number | null;
  newSalary: number;
  changedAt: string;   // ISO 8601
  reason: string;
  observations?: string | null;
}
```

---

## 2. Servicios

### 2.1 `User` service — Modificar existente

**Archivo:** `src/app/core/services/users/user.ts`

Agregar método:

```typescript
public getSalaryHistory(userId: number): Observable<SalaryHistoryEntry[]> {
  this.logger.debug('User: Calling GET salary-history with id:', userId);
  return this.http.get<SalaryHistoryEntry[]>(`v1/users/${String(userId)}/salary-history`);
}
```

---

## 3. Componentes

### 3.1 `Users` — Modificar existente

**Archivo:** `src/app/areas/admin/features/manage/users/users.ts`

#### Formulario de Creación
- Agregar campo `salary` al `FormGroup`:
  ```typescript
  salary: new FormControl<number | null>(null, [/* validators: min 0 si tiene valor */])
  ```
- Condición: salary visible solo si role WORKER (requiere agregar campo `role` al formulario o asumir WORKER)
- Validación: si `salary` tiene valor, debe ser > 0

#### Formulario de Edición
- Cargar `salary` desde `UserResponse`
- Watch del campo `salary`:
  - Si cambia respecto al valor original → mostrar campos `reason` (requerido) y `observations` (opcional)
  - Si no cambia → ocultar `reason` y `observations`
- En `formToRequest()` y `fillFormWithData()` incluir los nuevos campos
- En `updateUser()`: incluir `salary`, `reason`, `observations` en `UpdateUserRequest` solo si salary cambió

#### Tabla de Usuarios (HTML)
- Agregar columna "Salario" en el `p-table`
- Formato moneda usando una función utilitaria o pipe
- Mostrar `-` si `salary` es `null`
- Responsive: visible en desktop, ocultable en mobile

#### Manejo de Errores
- En `parseBackendValidationErrors`:
  - Agregar `'salary:'` y `'reason:'` a `fieldMarkers`
  - Agregar traducciones para:
    - `'Salary must be a positive value'` → `'El salario debe ser un valor positivo'`
    - `'Reason is required when salary changes'` → `'La razón es obligatoria cuando se cambia el salario'`

### 3.2 `SalaryHistory` — Nuevo componente

**Archivo:** `src/app/areas/admin/features/manage/users/salary-history/salary-history.ts`
**Template:** `src/app/areas/admin/features/manage/users/salary-history/salary-history.html`

#### Especificación del Componente

```
Selector: app-salary-history
Ruta: admin/manage/users/:id/salary-history
```

**Comportamiento:**
- Obtener `id` de la ruta (param `id`)
- Llamar `User.getSalaryHistory(id)` para obtener los datos
- Mostrar tabla con columnas: Fecha/Hora, Salario Anterior, Salario Nuevo, Razón, Observaciones
- Orden descendente por `changedAt` (el backend ya lo entrega ordenado)
- Para `oldSalary: null`: mostrar `-`
- Formato moneda para `oldSalary` y `newSalary`
- Formato fecha legible para `changedAt` (ej: "24/05/2026 10:30")
- Sin botones de editar/eliminar
- Estado vacío: "Sin cambios salariales registrados"
- Estado carga: skeleton loader

**Template:**
- Sigue el patrón de diseño del módulo admin:
  - Header con título "Historial Salarial" + breadcrumb/botón volver
  - Contenedor con tabla PrimeNG
  - Skeleton durante carga

#### Formulario `UserFormValue` — Modificar

```typescript
interface UserFormValue {
  document: string;
  name: string;
  email: string;
  phone: string;
  address: string | null;
  areas: number[];
  salary: number | null;          // NUEVO
  reason: string | null;          // NUEVO (solo en edición)
  observations: string | null;    // NUEVO (solo en edición)
}
```

---

## 4. Routing

### 4.1 Nueva Ruta

**Archivo:** `src/app/app.routes.ts`

Agregar dentro del children de `manage`:

```typescript
{
  path: 'users/:id/salary-history',
  loadComponent: () => import('@areas/admin/features/manage/users/salary-history/salary-history').then(m => m.SalaryHistory),
}
```

---

## 5. UI/UX

### 5.1 Formato Moneda

Usar `Intl.NumberFormat` para formatear valores monetarios:

```typescript
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};
```

O crear un pipe reutilizable.

### 5.2 Formato Fecha

```typescript
const formatDateTime = (iso: string): string => {
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(iso));
};
```

### 5.3 Condiciones de UI por Rol

| Condición | UI |
|-----------|-----|
| Role ADMIN en creación | Campo salary deshabilitado/oculto |
| Role WORKER en creación | Campo salary habilitado, opcional |
| Salary editado en edición | Mostrar reason (requerido) + observations (opcional) |
| Salary NO editado en edición | Ocultar reason + observations |
| Usuario sin historial | Mensaje "Sin cambios salariales registrados" |
| Usuario con historial | Tabla con datos |

---

## 6. Manejo de Errores

### 6.1 Nuevos Códigos de Error

| Código | Mensaje Backend | Acción Frontend |
|--------|-----------------|-----------------|
| 400 | `El salario debe ser un valor positivo` | Marcar campo `salary` con error |
| 400 | `La razón es obligatoria cuando se cambia el salario` | Marcar campo `reason` con error |
| 404 | `Usuario no encontrado` | Toast de error + redirigir a lista |

### 6.2 Parseo de Errores

En `parseBackendValidationErrors` del componente `Users`, agregar al array `fieldMarkers`:

```typescript
const fieldMarkers = ['document:', 'email:', 'phone:', 'name:', 'address:', 'salary:', 'reason:'];
```

Traducciones adicionales:

```typescript
const errorTranslations: Record<string, string> = {
  // ... existentes ...
  'Salary must be a positive value': 'El salario debe ser un valor positivo',
  'Reason is required when salary changes': 'La razón es obligatoria cuando se cambia el salario',
};
```

---

## 7. Cache

No se requiere caché para el historial salarial por ahora. El componente `SalaryHistory` llamará al API directamente. Se puede agregar `ResourceCache` en el futuro si es necesario.

---

## 8. Dependencias

- PrimeNG: `TableModule`, `ButtonModule`, `InputNumberModule` (para campo salary)
- Sin nuevas dependencias externas

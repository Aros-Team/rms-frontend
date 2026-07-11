# Requisitos Técnicos — Módulo de Gestión de Turnos (Frontend)

> Fecha: 2026-05-24
> Proyecto: RMS Frontend
> Feature: Gestión de Turnos (Schedules/Shifts)

---

## 1. Modelos/DTOs

### 1.1 `Schedule` — Nuevo modelo

**Archivo:** `src/app/shared/models/dto/schedules/schedule.model.ts`

```typescript
export interface Schedule {
  id: number;
  name: string;
  description?: string;
  shifts: Shift[];
}
```

### 1.2 `Shift` — Nuevo modelo

**Archivo:** `src/app/shared/models/dto/schedules/shift.model.ts`

```typescript
export interface Shift {
  id?: number;
  dayOfWeek: 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
}
```

### 1.3 `CreateScheduleRequest` — Nuevo modelo

**Archivo:** `src/app/shared/models/dto/schedules/create-schedule-request.model.ts`

```typescript
export interface CreateScheduleRequest {
  name: string;
  description?: string;
  shifts: Omit<Shift, 'id'>[];
}
```

### 1.4 `ScheduleAssignmentResponse` — Nuevo modelo

**Archivo:** `src/app/shared/models/dto/schedules/schedule-assignment-response.model.ts`

```typescript
export interface ScheduleAssignmentResponse {
  workerId: number;
  scheduleId: number;
  assignmentId: number;
}
```

**Regla:** El endpoint `GET /workers/{workerId}/schedule-assignments` devuelve solo `[1, 3, 5]` (array de IDs). El modelo assignment se usa internamente para DELETE.

### 1.5 `WorkerScheduleResponse` — Nuevo modelo

**Archivo:** `src/app/shared/models/dto/schedules/worker-schedule-response.model.ts`

```typescript
export interface WorkerScheduleResponse {
  days: WorkerScheduleDay[];
}

export interface WorkerScheduleDay {
  dayOfWeek: string;
  shifts: WorkerScheduleShift[];
}

export interface WorkerScheduleShift {
  scheduleName: string;
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
}
```

**Reglas:**
- Los 7 días de la semana siempre aparecen como entrada
- Si un día no tiene turnos, `shifts` es `[]`
- Múltiples schedules se combinan por día
- Orden de días: MONDAY → SUNDAY

### 1.6 `TimeLogEntry` — Nuevo modelo

**Archivo:** `src/app/shared/models/dto/schedules/time-log-entry.model.ts`

```typescript
export interface TimeLogEntry {
  id: number;
  workerId: number;
  timestamp: string;    // ISO 8601
  type: 'IN';
  withinShift: boolean;
  relatedShiftId: number | null;
}
```

---

## 2. Servicios

### 2.1 `Schedule` service — Nuevo

**Archivo:** `src/app/core/services/schedules/schedule.ts`

```typescript
@Injectable({ providedIn: 'root' })
export class Schedule {
  private http = inject(HttpClient);
  private logger = inject(Logging);

  public getAll(): Observable<Schedule[]>;
  public getById(id: number): Observable<Schedule>;
  public create(data: CreateScheduleRequest): Observable<Schedule>;
  public update(id: number, data: CreateScheduleRequest): Observable<Schedule>;
  public delete(id: number): Observable<void>;
}
```

**Endpoints:**
- `GET v1/schedules`
- `GET v1/schedules/{id}`
- `POST v1/schedules`
- `PUT v1/schedules/{id}`
- `DELETE v1/schedules/{id}`

### 2.2 `ScheduleAssignment` service — Nuevo

**Archivo:** `src/app/core/services/schedules/schedule-assignment.ts`

```typescript
@Injectable({ providedIn: 'root' })
export class ScheduleAssignment {
  private http = inject(HttpClient);
  private logger = inject(Logging);

  public assign(workerId: number, scheduleId: number): Observable<void>;
  public getAssignments(workerId: number): Observable<number[]>;
  public removeAssignment(workerId: number, assignmentId: number): Observable<void>;
}
```

**Endpoints:**
- `POST v1/workers/{workerId}/schedule-assignments` (body: `{ scheduleId }`)
- `GET v1/workers/{workerId}/schedule-assignments`
- `DELETE v1/workers/{workerId}/schedule-assignments/{assignmentId}`

### 2.3 `WorkerSchedule` service — Nuevo

**Archivo:** `src/app/core/services/schedules/worker-schedule.ts`

```typescript
@Injectable({ providedIn: 'root' })
export class WorkerSchedule {
  private http = inject(HttpClient);
  private logger = inject(Logging);

  public getMySchedule(): Observable<WorkerScheduleResponse>;
}
```

**Endpoint:** `GET v1/workers/me/schedule`

**Nota:** Disponible incluso cuando `restricted=true`. No requiere parámetros.

### 2.4 `TimeLog` service — Nuevo

**Archivo:** `src/app/core/services/schedules/time-log.ts`

```typescript
@Injectable({ providedIn: 'root' })
export class TimeLog {
  private http = inject(HttpClient);
  private logger = inject(Logging);

  public getTimeLogs(params?: TimeLogFilterParams): Observable<TimeLogEntry[]>;
}

interface TimeLogFilterParams {
  workerId?: number;
  from?: string; // ISO 8601
  to?: string;   // ISO 8601
}
```

**Endpoint:** `GET v1/admin/time-logs`

### 2.5 JWT — Leer claim `restricted`

**Archivo:** `src/app/core/services/auth/auth.ts` (modificar existente)

Agregar método o propiedad para exponer el claim `restricted`:

```typescript
public get isRestricted(): boolean {
  // Leer del token decodificado el claim 'restricted'
  // Usar librería jwt-decode para decodificar el token
}
```

**Comportamiento:**
- Decodificar JWT en el cliente usando `jwt-decode`
- Leer `principal.claims['restricted']`
- `restricted: true` → worker fuera de turno
- `restricted: false` → worker dentro de turno o ADMIN

---

## 3. Componentes

### 3.1 `ScheduleList` — Nuevo componente (Admin)

**Archivo:** `src/app/areas/admin/features/manage/schedules/schedules.ts`
**Template:** `src/app/areas/admin/features/manage/schedules/schedules.html`

```
Selector: app-schedules
Ruta: admin/manage/schedules
```

**Comportamiento:**
- Obtener lista de schedules via `Schedule.getAll()`
- Mostrar tabla con columnas: ID, Nombre, Descripción, Turnos (cantidad), Acciones
- Botón "Crear Horario" → abre modal/formulario de creación
- Botón "Editar" por fila → abre modal/formulario de edición
- Botón "Eliminar" por fila → confirmación + `Schedule.delete(id)`
- Confirmación de eliminación: si backend responde 409 (tiene asignaciones activas), mostrar toast de error
- Estados: loading (skeleton), empty ("No hay horarios creados"), error toast
- Botón "Asignar trabajadores" por fila → navega a panel de asignación

### 3.2 `ScheduleForm` — Nuevo componente/modal (Admin)

Usado por `ScheduleList` para crear/editar horarios. Puede ser inline en el mismo componente o separado.

**Comportamiento:**
- Formulario con campos:
  - `name`: texto, requerido, único
  - `description`: texto, opcional
  - `shifts`: lista dinámica de turnos (mínimo 1)
- Cada turno tiene:
  - `dayOfWeek`: select con días de la semana (MONDAY–SUNDAY)
  - `startTime`: input tipo time (HH:mm)
  - `endTime`: input tipo time (HH:mm)
  - Botón para eliminar turno individual
- Botón "Agregar Turno" para añadir fila vacía
- **Validaciones frontend:**
  - `name` requerido
  - `startTime` < `endTime` por turno
  - No solapamiento de turnos dentro del mismo día (verificar en cliente antes de enviar)
  - Al menos 1 turno
- Modal: título dinámico "Crear Horario" vs "Editar Horario"
- En edición: precargar datos desde `Schedule.getById(id)`
- En creación: `Schedule.create(data)`
- En edición: `Schedule.update(id, data)`
- Manejo de errores: 409 nombre duplicado, 400 input inválido

### 3.3 `ScheduleAssignmentPanel` — Nuevo componente (Admin)

**Archivo:** `src/app/areas/admin/features/manage/schedules/assignments/schedule-assignments.ts`
**Template:** `src/app/areas/admin/features/manage/schedules/assignments/schedule-assignments.html`

```
Selector: app-schedule-assignments
Ruta: admin/manage/schedules/:scheduleId/assignments
```

**Comportamiento:**
- Obtener lista de workers (reutilizar `User.getUsers()`)
- Mostrar workers con checkboxes indicando a quién está asignado el schedule actual
- Botón "Asignar" → `ScheduleAssignment.assign(workerId, scheduleId)`
- Botón "Desasignar" → `ScheduleAssignment.removeAssignment(workerId, assignmentId)`
- Indicar visualmente workers que ya tienen el schedule asignado
- Si el backend responde 409 (solapamiento), mostrar toast "El horario se solapa con turnos existentes del trabajador"
- Alternativa: dropdown de workers + botón asignar

### 3.4 `MySchedule` — Nuevo componente (Worker)

**Archivo:** `src/app/areas/worker/features/my-schedule/my-schedule.ts`
**Template:** `src/app/areas/worker/features/my-schedule/my-schedule.html`

```
Selector: app-my-schedule
Ruta: worker/my-schedule
```

**Comportamiento:**
- Llamar `WorkerSchedule.getMySchedule()`
- Mostrar horario semanal agrupado por día
- Diseño tipo calendario semanal o lista de días
- Cada día muestra los turnos con: nombre del schedule, hora inicio, hora fin
- Días sin turnos: mostrar "Sin turnos asignados" o mensaje similar
- Orden: MONDAY → SUNDAY
- Botón "Mis Turnos" en navegación del worker (panel lateral o header)
- Estados: loading (skeleton), empty, error
- **Disponible incluso cuando `restricted=true`**

### 3.5 `TimeLogAdmin` — Nuevo componente (Admin)

**Archivo:** `src/app/areas/admin/features/manage/time-logs/time-logs.ts`
**Template:** `src/app/areas/admin/features/manage/time-logs/time-logs.html`

```
Selector: app-time-logs
Ruta: admin/manage/time-logs
```

**Comportamiento:**
- Llamar `TimeLog.getTimeLogs()` con filtros opcionales
- Tabla con columnas: ID, Worker ID, Fecha/Hora, Tipo (siempre "IN"), ¿Dentro de turno?, ID Turno
- Filtros:
  - `workerId`: input numérico o select de workers
  - `from`: datepicker (fecha inicio)
  - `to`: datepicker (fecha fin)
- Todos los filtros opcionales
- Al cambiar filtros, recargar datos
- Formato de fecha ISO 8601 → formato legible (ej: "24/05/2026 10:00")
- `withinShift: true` → badge verde "En turno"
- `withinShift: false` → badge rojo "Fuera de turno"
- `relatedShiftId: null` → mostrar `-`
- Estados: loading (skeleton), empty ("Sin registros de ingreso"), error

### 3.6 `RestrictedBanner` — Nuevo componente (Shared)

**Archivo:** `src/app/shared/components/restricted-banner/restricted-banner.ts`
**Template:** `src/app/shared/components/restricted-banner/restricted-banner.html`

```
Selector: app-restricted-banner
```

**Comportamiento:**
- Leer estado `isRestricted` del servicio de Auth
- Si `restricted === true`:
  - Mostrar banner persistente en parte superior: "Fuera de turno — Acceso limitado"
  - Estilo visual distintivo (fondo amarillo/ naranja, icono de advertencia)
  - No descartable (persistente durante toda la sesión)
- Si `restricted === false` o role ADMIN: oculto
- Incluir en layouts de Worker Area y Admin Area

### 3.7 Control de Acceso Condicional

**Archivos afectados:** Layout de Worker Area

**Comportamiento:**
- Cuando `restricted === true`:
  - Ocultar/deshabilitar en la navegación del worker:
    - Panel de pedidos activos
    - Gestión de inventario
    - Acciones de cocina / preparación
  - Mantener accesible:
    - Consulta de horario personal (`/worker/my-schedule`)
    - Perfil / configuraciones
- Implementar vía guard condicional o directiva estructural en el menú de navegación

---

## 4. Routing

### 4.1 Nuevas Rutas Admin

**Archivo:** `src/app/app.routes.ts`

Agregar dentro de `admin/manage`:

```typescript
{
  path: 'schedules',
  loadComponent: () => import('@areas/admin/features/manage/schedules/schedules').then(m => m.Schedules),
},
{
  path: 'schedules/:scheduleId/assignments',
  loadComponent: () => import('@areas/admin/features/manage/schedules/assignments/schedule-assignments').then(m => m.ScheduleAssignments),
},
{
  path: 'time-logs',
  loadComponent: () => import('@areas/admin/features/manage/time-logs/time-logs').then(m => m.TimeLogs),
},
```

### 4.2 Nueva Ruta Worker

**Archivo:** `src/app/app.routes.ts`

Agregar dentro de `worker`:

```typescript
{
  path: 'my-schedule',
  loadComponent: () => import('@areas/worker/features/my-schedule/my-schedule').then(m => m.MySchedule),
},
```

### 4.3 Navegación Admin

**Archivo:** `src/app/areas/admin/features/manage/manage.html`

Agregar items al menú horizontal:

- "Horarios" → `schedules` (icono: `pi pi-calendar-clock` o similar)
- "Registros de Ingreso" → `time-logs` (icono: `pi pi-history` o similar)

### 4.4 Navegación Worker

**Archivo:** Template del layout worker (ej: `src/app/areas/worker/worker.html`)

Agregar item:

- "Mi Horario" → `/worker/my-schedule` (siempre visible)
- Items condicionales según `restricted`:
  - Ocultar "Pedidos", "Cocina", "Inventario" cuando `restricted === true`

---

## 5. UI/UX

### 5.1 Banner de Restricción

| Estado | UI |
|--------|-----|
| `restricted === true` | Banner amarillo/naranja: "Fuera de turno — Acceso limitado" + icono ⏰ |
| `restricted === false` | Banner oculto |
| Role ADMIN | Banner siempre oculto |

### 5.2 Formato de Hora

Siempre en formato 24h (`HH:mm`). Usar inputs nativos `type="time"` en formularios.

### 5.3 Selector de Día

Usar los valores `dayOfWeek` tal como llegan de la API: `MONDAY`–`SUNDAY`.
Internamente, mostrar traducción al español en UI.

**Mapeo de días:**

| API | UI |
|-----|-----|
| MONDAY | Lunes |
| TUESDAY | Martes |
| WEDNESDAY | Miércoles |
| THURSDAY | Jueves |
| FRIDAY | Viernes |
| SATURDAY | Sábado |
| SUNDAY | Domingo |

### 5.4 Diseño de Calendario Semanal (MySchedule)

- Vista semanal con 7 columnas o filas
- Cada día muestra los turnos del worker
- Si un worker tiene múltiples turnos en un día, se listan verticalmente
- Día actual resaltado visualmente
- Horas en formato HH:mm

### 5.5 Condiciones de UI por Rol y Estado

| Condición | UI |
|-----------|-----|
| Role ADMIN en ScheduleList | CRUD completo (crear, editar, eliminar, asignar) |
| Role ADMIN en ScheduleAssignment | Panel de asignación de workers |
| Role ADMIN en TimeLogs | Tabla con filtros |
| Role WORKER con `restricted=false` | Navegación completa + MySchedule |
| Role WORKER con `restricted=true` | Solo MySchedule + Perfil + Banner visible |
| Role WORKER creando schedule | No aplica (solo ADMIN) |

---

## 6. Manejo de Errores

### 6.1 Códigos HTTP

| Código | Significado | Acción Frontend |
|--------|-------------|-----------------|
| 201 | Creado | Toast éxito, recargar lista |
| 200 | OK | Actualizar vista |
| 204 | Sin contenido | Refrescar lista |
| 400 | Input inválido | Mostrar errores de validación en formulario |
| 403 | Prohibido (worker restringido) | Toast "Acción no disponible fuera de turno" |
| 404 | No encontrado | Toast error + redirigir a lista |
| 409 | Conflicto | Mostrar mensaje específico según contexto |

### 6.2 Escenarios de Error Específicos

| Escenario | Código | Mensaje | Acción |
|-----------|--------|---------|--------|
| Nombre de horario duplicado | 409 | `"Schedule name already exists"` | Marcar campo `name` con error |
| Solapamiento al crear schedule | 400 | `"Shifts cannot overlap on the same day"` | Toast error + resaltar turnos conflictivos |
| Solapamiento al asignar | 409 | `"Schedule overlaps with existing assignments"` | Toast "El horario se solapa con turnos existentes del trabajador" |
| Schedule con asignaciones al eliminar | 409 | `"Cannot delete schedule with active assignments"` | Toast "No se puede eliminar: el horario tiene trabajadores asignados" |
| Worker no encontrado | 404 | `"Worker not found"` | Toast de error |
| Worker restringido accede a recurso | 403 | `"Worker is outside their shift"` | Toast + mantener banner visible |

### 6.3 Traducciones (para parseBackendValidationErrors)

```typescript
const errorTranslations: Record<string, string> = {
  'Schedule name already exists': 'El nombre del horario ya existe',
  'Shifts cannot overlap on the same day': 'Los turnos no pueden solaparse en el mismo día',
  'Schedule overlaps with existing assignments': 'El horario se solapa con turnos existentes del trabajador',
  'Cannot delete schedule with active assignments': 'No se puede eliminar: el horario tiene trabajadores asignados',
  'Worker is outside their shift': 'Acción no disponible fuera de turno',
};
```

---

## 7. Dependencias Externas

- **jwt-decode** — Para decodificar el JWT en el cliente y leer el claim `restricted`
  - Instalar con: `npm install jwt-decode`
  - Uso: decodificar token, leer `principal.claims['restricted']`
- PrimeNG: `TableModule`, `ButtonModule`, `DialogModule`, `InputTextModule`, `InputNumberModule`, `SelectModule` (o `DropdownModule`), `CalendarModule` (para datepicker), `TagModule`, `TooltipModule`, `SkeletonModule`, `ConfirmDialogModule`, `MessageService`, `ConfirmationService`

---

## 8. Cache

No se requiere caché para schedules por ahora. Los componentes llamarán al API directamente.

Para el componente `MySchedule`, se puede considerar caché corta (30s) en el futuro para evitar llamadas repetidas, pero inicialmente se llamará al API cada vez.

---

## 9. JWT — Nuevo Claim `restricted`

### 9.1 Lectura del Claim

El JWT ahora incluye:

| Claim | Tipo | Valores |
|-------|------|---------|
| `role` | string | `"ADMIN"` \| `"WORKER"` |
| `restricted` | boolean | WORKER fuera de turno = `true`, ADMIN = `false` |

### 9.2 Integración con Auth Service

En el flujo de login existente:
1. Almacenar el token recibido
2. Decodificarlo con `jwt-decode`
3. Extraer `role` y `restricted`
4. Exponer `isRestricted` como señal computada o getter
5. El `RestrictedBanner` y los guards de navegación consumen esta señal

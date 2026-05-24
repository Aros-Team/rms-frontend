# Tareas — Módulo de Gestión de Turnos (Frontend)

> Fecha: 2026-05-24
> Proyecto: RMS Frontend
> Instrucción: Cada tarea es asignable a un sub-agente vía `delegate` tool.
> Dependencias: Respetar el orden de tareas secuenciales (marcadas con ⛓️).

---

## T-01: Crear modelos DTO (Schedule, Shift, CreateScheduleRequest, WorkerScheduleResponse, TimeLogEntry)

**Tipo:** `chore` (refactor de tipos)
**Dependencias:** Ninguna
**Esfuerzo:** Medio (~30 min)
**Archivos:**
- `src/app/shared/models/dto/schedules/schedule.model.ts`
- `src/app/shared/models/dto/schedules/shift.model.ts`
- `src/app/shared/models/dto/schedules/create-schedule-request.model.ts`
- `src/app/shared/models/dto/schedules/worker-schedule-response.model.ts`
- `src/app/shared/models/dto/schedules/time-log-entry.model.ts`

**Qué hacer:**
- Crear carpeta `src/app/shared/models/dto/schedules/`
- Crear interfaz `Schedule` con campos: `id`, `name`, `description?`, `shifts: Shift[]`
- Crear interfaz `Shift` con campos: `id?`, `dayOfWeek` (literal union type), `startTime`, `endTime`
- Crear interfaz `CreateScheduleRequest` con campos: `name`, `description?`, `shifts` (sin `id`)
- Crear interfaz `WorkerScheduleResponse` con `days: WorkerScheduleDay[]`, y sub-interfaces `WorkerScheduleDay`, `WorkerScheduleShift`
- Crear interfaz `TimeLogEntry` con campos: `id`, `workerId`, `timestamp`, `type`, `withinShift`, `relatedShiftId`

**Verificación:**
- TypeScript compila sin errores
- Los modelos se pueden importar en otros archivos

---

## T-02: Instalar jwt-decode y exponer claim `restricted` en Auth service

**Tipo:** `feat`
**Dependencias:** Ninguna
**Esfuerzo:** Medio (~30 min)
**Archivos:**
- `package.json`
- `src/app/core/services/auth/auth.ts`

**Qué hacer:**
- Ejecutar `npm install jwt-decode`
- En `auth.ts`, al recibir el token en el login:
  - Decodificar JWT con `jwtDecode()`
  - Extraer `principal.claims['restricted']`
  - Exponer señal o getter `isRestricted(): boolean`
- Si el claim no existe (ADMIN o JWT antiguo), devolver `false`
- Mantener sincronizado con el estado de sesión (se limpia al cerrar sesión)

**Verificación:**
- `npm install` exitoso
- `auth.isRestricted()` devuelve `true` para worker fuera de turno
- `auth.isRestricted()` devuelve `false` para ADMIN
- TypeScript compila sin errores

---

## T-03: Crear ScheduleService (CRUD de horarios)

**Tipo:** `feat`
**Dependencias:** T-01 ⛓️
**Esfuerzo:** Bajo (~20 min)
**Archivos:**
- `src/app/core/services/schedules/schedule.ts`

**Qué hacer:**
- Crear carpeta `src/app/core/services/schedules/`
- Crear servicio `Schedule` con `@Injectable({ providedIn: 'root' })`
- Inyectar `HttpClient` y `Logging`
- Métodos:
  - `getAll(): Observable<Schedule[]>` → `GET v1/schedules`
  - `getById(id: number): Observable<Schedule>` → `GET v1/schedules/{id}`
  - `create(data: CreateScheduleRequest): Observable<Schedule>` → `POST v1/schedules`
  - `update(id: number, data: CreateScheduleRequest): Observable<Schedule>` → `PUT v1/schedules/{id}`
  - `delete(id: number): Observable<void>` → `DELETE v1/schedules/{id}`
- Logger debug en cada método (seguir patrón existente: `'Schedule: Calling GET schedules'`)

**Verificación:**
- TypeScript compila sin errores
- Servicio inyectable y con métodos correctamente tipados

---

## T-04: Crear ScheduleAssignmentService

**Tipo:** `feat`
**Dependencias:** T-01 ⛓️
**Esfuerzo:** Bajo (~15 min)
**Archivos:**
- `src/app/core/services/schedules/schedule-assignment.ts`

**Qué hacer:**
- Crear servicio `ScheduleAssignment`
- Métodos:
  - `assign(workerId: number, scheduleId: number): Observable<void>` → `POST v1/workers/{workerId}/schedule-assignments` (body: `{ scheduleId }`)
  - `getAssignments(workerId: number): Observable<number[]>` → `GET v1/workers/{workerId}/schedule-assignments`
  - `removeAssignment(workerId: number, assignmentId: number): Observable<void>` → `DELETE v1/workers/{workerId}/schedule-assignments/{assignmentId}`

**Verificación:**
- TypeScript compila sin errores
- Métodos con tipos correctos

---

## T-05: Crear WorkerScheduleService

**Tipo:** `feat`
**Dependencias:** T-01 ⛓️
**Esfuerzo:** Bajo (~10 min)
**Archivos:**
- `src/app/core/services/schedules/worker-schedule.ts`

**Qué hacer:**
- Crear servicio `WorkerSchedule`
- Métodos:
  - `getMySchedule(): Observable<WorkerScheduleResponse>` → `GET v1/workers/me/schedule`

**Verificación:**
- TypeScript compila sin errores

---

## T-06: Crear TimeLogService

**Tipo:** `feat`
**Dependencias:** T-01 ⛓️
**Esfuerzo:** Bajo (~15 min)
**Archivos:**
- `src/app/core/services/schedules/time-log.ts`

**Qué hacer:**
- Crear servicio `TimeLog`
- Métodos:
  - `getTimeLogs(params?: { workerId?: number; from?: string; to?: string }): Observable<TimeLogEntry[]>` → `GET v1/admin/time-logs` con query params
- Construir query params solo si están presentes (no enviar `undefined`)

**Verificación:**
- TypeScript compila sin errores
- Query params se construyen correctamente

---

## T-07: Componente ScheduleList (Administración de Horarios)

**Tipo:** `feat`
**Dependencias:** T-03 ⛓️
**Esfuerzo:** Alto (~60 min)
**Archivos:**
- `src/app/areas/admin/features/manage/schedules/schedules.ts`
- `src/app/areas/admin/features/manage/schedules/schedules.html`

**Qué hacer:**
- Crear carpeta `src/app/areas/admin/features/manage/schedules/`
- Crear componente standalone `Schedules`
- En `ngOnInit`: llamar `Schedule.getAll()` y manejar estados loading/empty/error
- Template:
  - Header con título "Horarios" y botón "Crear Horario"
  - Tabla PrimeNG con columnas: ID, Nombre, Descripción, Turnos (#), Acciones
  - En acciones: botones "Editar", "Eliminar", "Asignar Trabajadores"
  - Skeleton durante carga
  - Mensaje "No hay horarios creados" si lista vacía
- Integrar modal de creación/edición (ver T-08) dentro del mismo template
- Confirmación antes de eliminar (usar `ConfirmationService`)
- Manejar error 409 al eliminar (toast "No se puede eliminar: el horario tiene trabajadores asignados")

**Verificación:**
- TypeScript compila sin errores
- Tabla se renderiza con datos mock
- Botones de acción visibles y funcionales

---

## T-08: Componente ScheduleForm (Crear/Editar Horario)

**Tipo:** `feat`
**Dependencias:** T-03, T-07 ⛓️
**Esfuerzo:** Alto (~60 min)
**Archivos:**
- `src/app/areas/admin/features/manage/schedules/schedules.ts` (integrado como modal)
- `src/app/areas/admin/features/manage/schedules/schedules.html`

**Qué hacer:**
- Agregar modal de diálogo (PrimeNG Dialog) para crear/editar horario
- Formulario con:
  - `name`: InputText, requerido
  - `description`: InputText, opcional
  - `shifts`: lista dinámica con filas de:
    - `dayOfWeek`: Dropdown con días (MONDAY–SUNDAY), etiquetas en español
    - `startTime`: input type="time"
    - `endTime`: input type="time"
    - Botón "X" para eliminar fila
  - Botón "+ Agregar Turno"
- Validaciones frontend:
  - `name` requerido
  - `startTime` debe ser anterior a `endTime` (por turno)
  - No solapamiento de turnos en el mismo día
  - Al menos 1 turno
- Modal dinámico: título "Crear Horario" vs "Editar Horario"
- En edición: precargar datos vía `Schedule.getById(id)`
- En creación: `Schedule.create(data)`
- En edición: `Schedule.update(id, data)`
- Manejar error 409 (nombre duplicado) marcando campo `name`

**Verificación:**
- Modal se abre en creación y edición
- Validaciones frontend funcionan
- Creación y edición exitosas con datos correctos
- Error 409 se muestra en campo name

---

## T-09: Componente ScheduleAssignmentPanel

**Tipo:** `feat`
**Dependencias:** T-04, T-07 ⛓️
**Esfuerzo:** Medio (~45 min)
**Archivos:**
- `src/app/areas/admin/features/manage/schedules/assignments/schedule-assignments.ts`
- `src/app/areas/admin/features/manage/schedules/assignments/schedule-assignments.html`

**Qué hacer:**
- Crear carpeta `src/app/areas/admin/features/manage/schedules/assignments/`
- Crear componente standalone `ScheduleAssignments`
- Obtener `scheduleId` de la ruta
- Obtener lista de workers (reusar `User.getUsers()`) y asignaciones existentes (`ScheduleAssignment.getAssignments(workerId)`)
- Template:
  - Header con título "Asignar Horario: {nombre}" + botón "Volver"
  - Tabla de workers con checkbox "Asignado" y botones Asignar/Desasignar
- Al asignar: `ScheduleAssignment.assign(workerId, scheduleId)`
- Al desasignar: `ScheduleAssignment.removeAssignment(workerId, assignmentId)`
- Manejar error 409 (solapamiento): toast "El horario se solapa con turnos existentes del trabajador"
- Estados: loading (skeleton), empty, error

**Verificación:**
- TypeScript compila sin errores
- Lista de workers visible con estado de asignación
- Asignar/desasignar funciona y actualiza UI

---

## T-10: Componente MySchedule (Worker)

**Tipo:** `feat`
**Dependencias:** T-05 ⛓️
**Esfuerzo:** Medio (~45 min)
**Archivos:**
- `src/app/areas/worker/features/my-schedule/my-schedule.ts`
- `src/app/areas/worker/features/my-schedule/my-schedule.html`

**Qué hacer:**
- Crear carpeta `src/app/areas/worker/features/my-schedule/`
- Crear componente standalone `MySchedule`
- En `ngOnInit`: llamar `WorkerSchedule.getMySchedule()`
- Template:
  - Header con título "Mi Horario Semanal"
  - Diseño de lista semanal con 7 bloques (lunes a domingo)
  - Cada bloque con nombre del día y lista de turnos
  - Si no hay turnos: "Sin turnos asignados"
  - Día actual resaltado
  - Horas en formato HH:mm
- Estados: loading (skeleton), empty, error

**Verificación:**
- TypeScript compila sin errores
- Vista semanal correcta con datos mock
- Día actual resaltado

---

## T-11: Componente TimeLogAdmin

**Tipo:** `feat`
**Dependencias:** T-06 ⛓️
**Esfuerzo:** Medio (~45 min)
**Archivos:**
- `src/app/areas/admin/features/manage/time-logs/time-logs.ts`
- `src/app/areas/admin/features/manage/time-logs/time-logs.html`

**Qué hacer:**
- Crear carpeta `src/app/areas/admin/features/manage/time-logs/`
- Crear componente standalone `TimeLogs`
- En `ngOnInit`: llamar `TimeLog.getTimeLogs()`
- Template:
  - Header con título "Registros de Ingreso"
  - Filtros: Worker ID (input), Desde (datepicker), Hasta (datepicker), todos opcionales
  - Tabla PrimeNG con columnas: ID, Worker ID, Fecha/Hora, Tipo, Dentro de Turno (badge), ID Turno
  - `withinShift: true` → badge verde "En turno"
  - `withinShift: false` → badge rojo "Fuera de turno"
  - Fechas formateadas con Intl.DateTimeFormat (es-CO)
- Al cambiar filtros, recargar datos
- Estados: loading (skeleton), empty ("Sin registros de ingreso"), error

**Verificación:**
- TypeScript compila sin errores
- Tabla con datos mock y filtros funcionales
- Badges de estado visibles

---

## T-12: Componente RestrictedBanner + Control de Acceso Condicional

**Tipo:** `feat`
**Dependencias:** T-02 ⛓️
**Esfuerzo:** Medio (~45 min)
**Archivos:**
- `src/app/shared/components/restricted-banner/restricted-banner.ts`
- `src/app/shared/components/restricted-banner/restricted-banner.html`
- `src/app/areas/worker/worker.html` (o layout de worker)
- `src/app/areas/admin/features/manage/manage.html`

**Qué hacer:**
- Crear carpeta `src/app/shared/components/restricted-banner/`
- Crear componente standalone `RestrictedBanner`:
  - Leer `auth.isRestricted()`
  - Si `true`: mostrar banner "Fuera de turno — Acceso limitado" con estilo amarillo/naranja e icono
  - Si `false`: oculto
  - No descartable
- En layout de Worker Area (`worker.html`):
  - Agregar `<app-restricted-banner />` en la parte superior
  - Cuando `isRestricted()` es `true`:
    - Ocultar items de navegación: Pedidos, Cocina, Inventario
    - Mantener visible: Mi Horario, Perfil
- En layout de Admin: agregar banner (aunque ADMIN siempre `restricted=false`, por consistencia)

**Verificación:**
- Banner visible para worker con `restricted=true`
- Banner oculto para ADMIN y worker con `restricted=false`
- Navegación oculta/visible según estado
- TypeScript compila sin errores

---

## T-13: Routing — Agregar rutas de schedules, assignments, time-logs y my-schedule

**Tipo:** `feat`
**Dependencias:** T-07, T-09, T-10, T-11 ⛓️
**Esfuerzo:** Bajo (~20 min)
**Archivos:**
- `src/app/app.routes.ts`
- `src/app/areas/admin/features/manage/manage.html`
- `src/app/areas/worker/worker.html` (o layout de worker)

**Qué hacer:**
- En `app.routes.ts`:
  - Agregar bajo `admin/manage`:
    - `schedules` → `Schedules`
    - `schedules/:scheduleId/assignments` → `ScheduleAssignments`
    - `time-logs` → `TimeLogs`
  - Agregar bajo `worker`:
    - `my-schedule` → `MySchedule`
- En `manage.html`: agregar items al menú horizontal:
  - "Horarios" → `schedules`
  - "Registros de Ingreso" → `time-logs`
- En layout worker: agregar item "Mi Horario" → `worker/my-schedule`

**Verificación:**
- Navegación a cada ruta funciona
- Lazy loading correcto
- Menú actualizado con nuevos items

---

## T-14: Manejo de errores backend para schedules y time-logs

**Tipo:** `feat`
**Dependencias:** T-07, T-08, T-09, T-11 ⛓️
**Esfuerzo:** Bajo (~20 min)
**Archivos:**
- `src/app/areas/admin/features/manage/schedules/schedules.ts`
- `src/app/areas/admin/features/manage/time-logs/time-logs.ts`

**Qué hacer:**
- En `Schedules`:
  - Agregar traducciones para errores 409 y 400
  - Mapear códigos de error específicos a mensajes en español
- En `TimeLogs`:
  - Manejar errores 403, 404 con toast
- Traducciones:
  ```typescript
  'Schedule name already exists' → 'El nombre del horario ya existe'
  'Shifts cannot overlap on the same day' → 'Los turnos no pueden solaparse en el mismo día'
  'Schedule overlaps with existing assignments' → 'El horario se solapa con turnos existentes'
  'Cannot delete schedule with active assignments' → 'No se puede eliminar: el horario tiene trabajadores asignados'
  ```

**Verificación:**
- Errores 409 muestran mensaje correcto en español
- Errores 400 se muestran en campos del formulario
- TypeScript compila sin errores

---

## T-15: Verificación final y harness

**Tipo:** `chore`
**Dependencias:** T-02 a T-14 ⛓️
**Esfuerzo:** Medio (~30 min)

**Qué hacer:**
- Ejecutar `node scripts/harness.js` y verificar que todos los bloques pasan
- Verificar que TypeScript compila sin errores (`npx tsc --noEmit`)
- Verificar que las rutas funcionan correctamente
- Verificar que la navegación condicional (restricted) funciona
- Verificar que todos los componentes cargan sin errores en consola

**Verificación:**
- Harness pasa todos los bloques
- No hay errores de TypeScript
- Navegación manual de rutas exitosa

---

## Diagrama de Dependencias

```
T-01 ──⛓️──> T-03 ──⛓️──> T-07 ──⛓️──> T-08 ──⛓️──> T-13
  │                       │                             │
  ├──⛓️──> T-04 ──⛓️──> T-09 ──⛓️─────────────────────────┘
  │                                                       │
  ├──⛓️──> T-05 ──⛓️──> T-10 ──⛓️─────────────────────────┘
  │                                                       │
  ├──⛓️──> T-06 ──⛓️──> T-11 ──⛓️─────────────────────────┘
  │                                                       │
T-02 ──⛓️──> T-12 ──⛓️────────────────────────────────────┘
                                                           │
T-07 ──⛓️──> T-14 ──⛓️─────────────────────────────────────┘
                                                           │
                                                           └──⛓️──> T-15
```

**Leyenda:**
- `⛓️` = dependencia secuencial (esperar tarea anterior)
- Tareas sin conexión entre sí pueden ejecutarse en paralelo por diferentes agentes

**Grupos de paralelización posible:**

| Grupo | Tareas | Requisito |
|-------|--------|-----------|
| A | T-01, T-02 | Ninguno (arranque en paralelo) |
| B | T-03, T-04, T-05, T-06 | T-01 (paralelo entre sí) |
| C | T-07, T-09, T-10, T-11, T-12 | Grupo B + T-02 (paralelo entre sí) |
| D | T-08, T-13, T-14 | T-07 (T-08), Grupo C (T-13, T-14) |
| E | T-15 | Todo lo anterior |

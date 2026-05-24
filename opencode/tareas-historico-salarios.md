# Tareas — Histórico de Cambios Salariales (Frontend)

> Fecha: 2026-05-24
> Proyecto: RMS Frontend
> Instrucción: Cada tarea es asignable a un sub-agente vía `delegate` tool.
> Dependencias: Respetar el orden de tareas secuenciales (marcadas con ⛓️).

---

## T-01: Actualizar modelos DTO (CreateUserRequest, UserResponse, UpdateUserRequest)

**Tipo:** `chore` (refactor de tipos)
**Dependencias:** Ninguna
**Esfuerzo:** Bajo (~15 min)
**Archivos:**
- `src/app/shared/models/dto/users/create-user-request.model.ts`
- `src/app/shared/models/dto/users/user-response.model.ts`

**Qué hacer:**
- Agregar `salary?: number | null` a `CreateUserRequest`
- Agregar `salary?: number | null` a `UserResponse`
- Agregar `salary?: number | null`, `reason?: string | null`, `observations?: string | null` a `UpdateUserRequest`

**Verificación:**
- TypeScript compila sin errores
- Los modelos importados en otros archivos siguen siendo compatibles

---

## T-02: Crear modelo SalaryHistoryEntry

**Tipo:** `feat`
**Dependencias:** Ninguna
**Esfuerzo:** Bajo (~10 min)
**Archivos:**
- `src/app/shared/models/dto/users/salary-history-entry.model.ts`

**Qué hacer:**
- Crear interfaz `SalaryHistoryEntry` con campos: `oldSalary`, `newSalary`, `changedAt`, `reason`, `observations`

**Verificación:**
- Archivo creado con export
- TypeScript compila sin errores

---

## T-03: Agregar método getSalaryHistory al servicio User

**Tipo:** `feat`
**Dependencias:** T-02 ⛓️
**Esfuerzo:** Bajo (~15 min)
**Archivos:**
- `src/app/core/services/users/user.ts`

**Qué hacer:**
- Importar `SalaryHistoryEntry`
- Agregar método `getSalaryHistory(userId: number): Observable<SalaryHistoryEntry[]>`
- Hacer GET a `v1/users/{userId}/salary-history`

**Verificación:**
- TypeScript compila sin errores
- El método existe y tiene el tipo de retorno correcto

---

## T-04: Agregar campo salary al formulario de creación de usuario

**Tipo:** `feat`
**Dependencias:** T-01 ⛓️
**Esfuerzo:** Medio (~30 min)
**Archivos:**
- `src/app/areas/admin/features/manage/users/users.ts`
- `src/app/areas/admin/features/manage/users/users.html`

**Qué hacer:**
- Agregar `salary: new FormControl<number | null>(null, ...)` al `FormGroup`
- Agregar validación: si tiene valor, debe ser > 0
- En `users.html` agregar campo `p-inputnumber` para salary dentro del modal de creación
- Mostrar tooltip: "Solo aplica para trabajadores"
- En `formToRequest()` incluir `salary` en `CreateUserRequest`
- `salary` solo se envía si tiene valor (no `null`)

**Verificación:**
- TypeScript compila sin errores
- El campo aparece en el modal de creación
- Al crear usuario con salary, el request incluye el campo

---

## T-05: Agregar campos salary/reason/observations al formulario de edición de usuario

**Tipo:** `feat`
**Dependencias:** T-01, T-04 ⛓️
**Esfuerzo:** Medio (~45 min)
**Archivos:**
- `src/app/areas/admin/features/manage/users/users.ts`
- `src/app/areas/admin/features/manage/users/users.html`

**Qué hacer:**
- Agregar `salary`, `reason`, `observations` al `FormGroup` (o manejarlos aparte con signals)
- En `fillFormWithData()`: cargar `salary` desde `UserResponse`
- Implementar lógica condicional:
  - Watch de cambios en `salary` vs valor original
  - Si cambió → mostrar campos `reason` (requerido) y `observations` (opcional)
  - Si no cambió → ocultar campos
- En `updateUser()`: incluir `salary`, `reason`, `observations` en `UpdateUserRequest` solo si salary cambió
- Si `salary` no cambió, NO incluir `salary`, `reason`, `observations` en el request

**Verificación:**
- TypeScript compila sin errores
- Campos aparecen/desaparecen según cambios en salary
- Al enviar con salary modificado, el request incluye reason y observations
- Al enviar sin cambios en salary, no se envían campos salariales

---

## T-06: Agregar columna salary a la tabla de usuarios

**Tipo:** `feat`
**Dependencias:** T-01 ⛓️
**Esfuerzo:** Bajo (~15 min)
**Archivos:**
- `src/app/areas/admin/features/manage/users/users.html`

**Qué hacer:**
- Agregar columna `<th>` "Salario" en el header de la tabla
- Agregar celda `<td>` con el valor formateado como moneda
- Si `salary` es `null`, mostrar `-`
- Agregar columna responsive (visible en desktop, oculta en mobile)

**Verificación:**
- TypeScript compila sin errores
- Columna visible con datos formateados correctamente

---

## T-07: Crear componente SalaryHistory con template

**Tipo:** `feat`
**Dependencias:** T-02, T-03 ⛓️
**Esfuerzo:** Medio (~45 min)
**Archivos:**
- `src/app/areas/admin/features/manage/users/salary-history/salary-history.ts`
- `src/app/areas/admin/features/manage/users/salary-history/salary-history.html`

**Qué hacer:**
- Crear carpeta `salary-history/` dentro de `users/`
- Crear componente `SalaryHistory`:
  - Obtener `id` de ActivatedRoute
  - Llamar `User.getSalaryHistory(id)` en init
  - Manejar estados: loading, empty, error, data
  - Formatear montos como moneda
  - Formatear fechas
- Template con tabla PrimeNG:
  - Columnas: Fecha/Hora, Salario Anterior, Salario Nuevo, Razón, Observaciones
  - `oldSalary: null` → mostrar `-`
  - Sin botones de acción (inmutable)
  - Skeleton loader mientras carga
  - Mensaje vacío si no hay historial
  - Botón "Volver" a la lista de usuarios

**Verificación:**
- TypeScript compila sin errores
- Componente existe y se puede cargar
- Template sigue convenciones del proyecto (design tokens, etc.)

---

## T-08: Agregar ruta salary-history y botón en tabla de usuarios

**Tipo:** `feat`
**Dependencias:** T-07 ⛓️
**Esfuerzo:** Bajo (~15 min)
**Archivos:**
- `src/app/app.routes.ts`
- `src/app/areas/admin/features/manage/users/users.html`

**Qué hacer:**
- En `app.routes.ts`: agregar ruta `users/:id/salary-history` bajo `manage`
- En `users.html`: agregar botón "Ver historial salarial" por fila (junto a editar/eliminar)

**Verificación:**
- Navegación a `admin/manage/users/1/salary-history` funciona
- Botón visible en tabla de usuarios
- Al hacer clic, navega a la ruta correcta

---

## T-09: Manejo de errores backend para salary/reason

**Tipo:** `feat`
**Dependencias:** T-04, T-05 ⛓️
**Esfuerzo:** Bajo (~15 min)
**Archivos:**
- `src/app/areas/admin/features/manage/users/users.ts`

**Qué hacer:**
- Agregar `'salary:'` y `'reason:'` al array `fieldMarkers` en `parseBackendValidationErrors`
- Agregar traducciones para mensajes de error de salary y reason
- Asegurar que los errores se limpian al abrir/cerrar modales

**Verificación:**
- TypeScript compila sin errores
- Errores de salary y reason se muestran en los campos correspondientes

---

## T-10: Verificación y pruebas

**Tipo:** `chore`
**Dependencias:** T-01 a T-09 ⛓️
**Esfuerzo:** Medio (~30 min)

**Qué hacer:**
- Ejecutar `node scripts/harness.js` y verificar que todos los bloques pasan
- Verificar que TypeScript compila sin errores (`npx tsc --noEmit`)
- Verificar que las rutas funcionan correctamente
- Verificar que los formularios de creación/edición funcionan con los nuevos campos

**Verificación:**
- Harness pasa todos los bloques
- No hay errores de TypeScript

---

## Diagrama de Dependencias

```
T-01 ──⛓️──> T-04 ──⛓️──> T-05 ──⛓️──> T-09
  │                                             │
  ├──⛓️──> T-06                                  │
  │                                             │
  └──⛓️──> T-02 ──⛓️──> T-03 ──⛓️──> T-07 ──⛓️──> T-08
                                                          │
                                                          └──⛓️──> T-10
```

**Leyenda:**
- `⛓️` = dependencia secuencial (esperar tarea anterior)
- Tareas sin conexión entre sí pueden ejecutarse en paralelo por diferentes agentes

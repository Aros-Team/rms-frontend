# Historias de Usuario — Módulo de Gestión de Turnos

> Fecha: 2026-05-24
> Proyecto: RMS Frontend
> Feature: Gestión de Turnos (Schedules/Shifts)

---

## HU-01: Gestionar horarios (CRUD)

**Como** administrador del restaurante
**Quiero** poder crear, editar, listar y eliminar horarios con sus turnos
**Para** definir las plantillas de turnos que luego asignaré a los trabajadores

### Criterios de Aceptación

- [ ] Existe una sección "Horarios" en el menú de administración
- [ ] La vista de horarios muestra una tabla con: ID, Nombre, Descripción, Cantidad de Turnos
- [ ] Hay un botón "Crear Horario" que abre un modal/formulario
- [ ] El formulario de creación permite ingresar: nombre (requerido), descripción (opcional), y una lista dinámica de turnos
- [ ] Cada turno tiene: día de la semana (select), hora inicio (time), hora fin (time), y botón para eliminar el turno
- [ ] Se puede agregar múltiples turnos con un botón "Agregar Turno"
- [ ] Validación frontend: hora inicio debe ser anterior a hora fin
- [ ] Validación frontend: no se permiten turnos solapados en el mismo día
- [ ] Validación frontend: al menos 1 turno requerido
- [ ] Al crear, el horario aparece en la tabla inmediatamente
- [ ] Hay un botón "Editar" por fila que abre el formulario precargado con los datos actuales
- [ ] Hay un botón "Eliminar" por fila con confirmación previa
- [ ] Si el horario tiene trabajadores asignados, la eliminación muestra un error: "No se puede eliminar: el horario tiene trabajadores asignados"
- [ ] Si el nombre del horario ya existe, se muestra error en el campo nombre
- [ ] Estados: skeleton durante carga, mensaje "No hay horarios creados" si está vacío

### Notas Técnicas

- Endpoints: `POST/GET/PUT/DELETE /api/v1/schedules`
- Rol requerido: ADMIN
- Ruta: `admin/manage/schedules`

---

## HU-02: Asignar horarios a trabajadores

**Como** administrador del restaurante
**Quiero** poder asignar y desasignar horarios a trabajadores específicos
**Para** definir qué días y horas trabaja cada empleado

### Criterios de Aceptación

- [ ] Desde la lista de horarios, hay un botón "Asignar trabajadores" por horario
- [ ] Al hacer clic, se navega a un panel de asignación para ese horario
- [ ] El panel muestra una lista de trabajadores disponibles
- [ ] Se puede ver qué trabajadores ya tienen asignado este horario
- [ ] Hay un botón "Asignar" para agregar el horario a un trabajador
- [ ] Hay un botón "Desasignar" para remover el horario de un trabajador
- [ ] Si el horario se solapa con turnos ya asignados al trabajador, se muestra un mensaje: "El horario se solapa con turnos existentes del trabajador"
- [ ] Lista de trabajadores: mostrar nombre, documento, áreas asignadas
- [ ] La asignación/desasignación se refleja inmediatamente en la UI
- [ ] Estados: skeleton durante carga, mensaje vacío si no hay workers

### Notas Técnicas

- Endpoints: `POST/DELETE /api/v1/workers/{workerId}/schedule-assignments`, `GET /api/v1/workers/{workerId}/schedule-assignments`
- Rol requerido: ADMIN
- Ruta: `admin/manage/schedules/:scheduleId/assignments`

---

## HU-03: Consultar mi horario personal

**Como** trabajador del restaurante
**Quiero** poder ver mi horario semanal completo
**Para** saber qué días y horas tengo que trabajar

### Criterios de Accptación

- [ ] Existe una opción "Mi Horario" en la navegación del worker
- [ ] La vista muestra los 7 días de la semana (lunes a domingo)
- [ ] Cada día lista los turnos asignados con: nombre del horario, hora inicio, hora fin
- [ ] Si un día no tiene turnos, se muestra "Sin turnos asignados"
- [ ] Si el worker tiene múltiples horarios, los turnos se combinan por día
- [ ] El día actual se resalta visualmente
- [ ] Las horas se muestran en formato 24h (HH:mm)
- [ ] Los días están ordenados de lunes a domingo
- [ ] **La vista está disponible incluso cuando el worker está fuera de turno (`restricted=true`)**
- [ ] Estados: skeleton durante carga, mensaje si hay error al cargar

### Notas Técnicas

- Endpoint: `GET /api/v1/workers/me/schedule`
- Rol requerido: WORKER o ADMIN
- Ruta: `worker/my-schedule`
- No requiere autenticación adicional (funciona con cualquier JWT válido)

---

## HU-04: Ver estado de restricción fuera de turno

**Como** trabajador del restaurante
**Quiero** saber claramente cuando estoy fuera de mi turno laboral
**Para** entender por qué algunas funcionalidades están deshabilitadas

### Criterios de Aceptación

- [ ] Al iniciar sesión fuera del horario de turno, se muestra un banner persistente en la parte superior
- [ ] El banner tiene el mensaje: "Fuera de turno — Acceso limitado"
- [ ] El banner tiene un color distintivo (amarillo/naranja) con un icono de advertencia
- [ ] El banner NO se puede cerrar/descartar (persiste durante toda la sesión)
- [ ] Si el worker inicia sesión dentro de su turno, el banner NO se muestra
- [ ] Al cerrar sesión y volver a iniciar dentro del turno, el banner desaparece
- [ ] Para administradores (role ADMIN), el banner nunca se muestra
- [ ] El estado de restricción se determina al momento del login y no cambia durante la sesión

### Notas Técnicas

- Claim JWT: `restricted` (boolean)
- Librería: `jwt-decode` para decodificar el token
- El backend calcula `restricted` al momento del login basado en si el worker tiene un turno activo

---

## HU-05: Consultar historial de registros de ingreso

**Como** administrador del restaurante
**Quiero** poder ver el historial de registros de ingreso de los trabajadores
**Para** monitorear la asistencia y saber cuándo ingresaron

### Criterios de Aceptación

- [ ] Existe una sección "Registros de Ingreso" en el menú de administración
- [ ] La vista muestra una tabla con columnas: ID, Worker ID, Fecha/Hora, Tipo, ¿Dentro de Turno?, ID Turno Relacionado
- [ ] Se puede filtrar por Worker ID (input numérico)
- [ ] Se puede filtrar por rango de fechas (desde / hasta con datepicker)
- [ ] Todos los filtros son opcionales
- [ ] Al cambiar cualquier filtro, los datos se recargan automáticamente
- [ ] La columna "¿Dentro de Turno?" muestra un badge verde "En turno" o badge rojo "Fuera de turno"
- [ ] La columna "ID Turno Relacionado" muestra `-` si es `null`
- [ ] Las fechas se muestran en formato legible (ej: "24/05/2026 10:00")
- [ ] Estados: skeleton durante carga, mensaje "Sin registros de ingreso" si está vacío

### Notas Técnicas

- Endpoint: `GET /api/v1/admin/time-logs?workerId=&from=&to=`
- Rol requerido: ADMIN
- Ruta: `admin/manage/time-logs`
- Parámetros opcionales: `workerId` (Long), `from` (ISO 8601), `to` (ISO 8601)

---

## HU-06: Navegación condicional según restricción de turno

**Como** trabajador del restaurante fuera de turno
**Quiero** que las opciones de pedidos, cocina e inventario estén ocultas o deshabilitadas
**Para** evitar acceder a funcionalidades que requieren estar en turno activo

### Criterios de Aceptación

- [ ] Cuando `restricted=true`, los siguientes items de navegación se ocultan:
  - Panel de pedidos activos
  - Gestión de inventario
  - Acciones de cocina / preparación
- [ ] Cuando `restricted=true`, los siguientes items permanecen visibles:
  - Mi Horario
  - Perfil / Configuración
- [ ] Cuando `restricted=false`, todos los items de navegación están visibles
- [ ] Para administradores, no hay restricción de navegación
- [ ] Si el worker intenta acceder directamente por URL a una ruta restringida, se muestra un mensaje o redirección
- [ ] La navegación se actualiza automáticamente al iniciar sesión (basado en el JWT)

### Notas Técnicas

- Implementar con directiva estructural `*ngIf` o señal computada en el menú de navegación
- El estado `isRestricted` se obtiene del servicio de Auth
- Las rutas restringidas pueden protegerse con un guard opcional

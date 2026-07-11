# Historias de Usuario — Histórico de Cambios Salariales

> Fecha: 2026-05-24
> Proyecto: RMS Frontend
> Feature: Histórico de Salarios (Salary History)

---

## HU-01: Asignar salario inicial al crear un trabajador

**Como** administrador del restaurante  
**Quiero** poder asignar un salario inicial al crear un nuevo empleado con rol WORKER  
**Para** registrar su remuneración desde el momento de ingreso

### Criterios de Aceptación

- [ ] El formulario de creación de usuario tiene un campo "Salario" de tipo `number`
- [ ] El campo "Salario" solo está habilitado cuando el rol seleccionado es WORKER
- [ ] Si el rol es ADMIN, el campo "Salario" está oculto o deshabilitado
- [ ] El campo "Salario" es opcional (se puede crear un usuario sin salario)
- [ ] Si se ingresa un valor, debe ser > 0 (validación en frontend)
- [ ] El campo tiene un tooltip: "Solo aplica para trabajadores"
- [ ] Al enviar con `salary > 0`, se crea el usuario con salario y un registro en el histórico con `reason: "CREACION"` y `observations: "Salario inicial"`
- [ ] Si el backend responde 400 con "El salario debe ser un valor positivo", se muestra el error en el formulario
- [ ] La tabla de usuarios muestra el salario actual del nuevo usuario

### Notas Técnicas

- Endpoint: `POST /api/v1/users`
- Campo `salary` en `CreateUserRequest`: opcional, `number | null`
- El backend genera automáticamente el registro histórico de creación

---

## HU-02: Actualizar salario de un trabajador con razón y observaciones

**Como** administrador del restaurante  
**Quiero** poder modificar el salario de un empleado indicando la razón del cambio  
**Para** mantener un registro auditado de los cambios salariales

### Criterios de Aceptación

- [ ] El formulario de edición de usuario muestra el campo "Salario" pre-cargado con el valor actual
- [ ] Si el usuario modifica el valor de "Salario", se muestran los campos "Razón" (obligatorio) y "Observaciones" (opcional)
- [ ] Si el usuario no modifica el valor de "Salario", los campos "Razón" y "Observaciones" permanecen ocultos
- [ ] El campo "Razón" se marca como requerido solo cuando el salario cambió
- [ ] Validación en frontend: `salary > 0` si se ingresó un valor
- [ ] Si el backend responde 400 con "La razón es obligatoria cuando se cambia el salario", se marca el campo "Razón" como requerido
- [ ] Si el backend responde 400 con "El salario debe ser un valor positivo", se muestra el error
- [ ] Al enviar con `salary` igual al actual, no se envía `salary` en el request (no genera histórico duplicado)

### Notas Técnicas

- Endpoint: `PUT /api/v1/users/{id}`
- El request debe incluir `salary`, `reason`, `observations` solo cuando el salario cambia
- `reason` es obligatorio si `salary` cambia

---

## HU-03: Ver historial de cambios salariales de un trabajador

**Como** administrador del restaurante  
**Quiero** poder consultar el historial completo de cambios salariales de un empleado  
**Para** tener trazabilidad de todas las modificaciones de remuneración

### Criterios de Aceptación

- [ ] Existe un botón/enlace "Ver historial salarial" en la fila de cada usuario en la tabla
- [ ] Al hacer clic, se navega a una nueva pantalla de historial salarial
- [ ] La pantalla muestra una tabla con columnas: Fecha/Hora, Salario Anterior, Salario Nuevo, Razón, Observaciones
- [ ] La tabla está ordenada por fecha descendente (más reciente primero)
- [ ] Para el registro inicial (salario anterior = `null`), la columna muestra `-` o `N/A`
- [ ] No hay botones de editar/eliminar en la tabla (el histórico es inmutable)
- [ ] El botón "Ver historial salarial" solo es visible para usuarios con rol ADMIN
- [ ] Si el usuario no tiene historial, se muestra un mensaje "Sin cambios salariales registrados"
- [ ] Los valores monetarios se muestran con formato moneda (`$ 2.500.000`)

### Notas Técnicas

- Endpoint: `GET /api/v1/users/{id}/salary-history`
- Nueva ruta: `admin/manage/users/:id/salary-history`
- Solo accesible por ADMIN (protegido por endpoint + UI)

---

## HU-04: Visualizar salario actual en la tabla de usuarios

**Como** administrador del restaurante  
**Quiero** ver el salario actual de cada empleado directamente en la tabla de usuarios  
**Para** tener una visión rápida de la información salarial sin abrir cada perfil

### Criterios de Aceptación

- [ ] La tabla de usuarios tiene una columna "Salario"
- [ ] La columna muestra el salario con formato moneda (`$ 2.500.000`)
- [ ] Si el usuario no tiene salario (es ADMIN o WORKER sin salario), la celda muestra `-`
- [ ] La columna es responsive (visible en desktop, oculta en mobile si es necesario)

### Notas Técnicas

- Campo `salary` en `UserResponse`: `number | null`
- Formateo con pipe de moneda o función utilitaria

---

## HU-05: Manejar errores de validación salarial del backend

**Como** administrador del restaurante  
**Quiero** que los errores de validación del backend se muestren claramente en el formulario  
**Para** saber exactamente qué corregir sin tener que adivinar

### Criterios de Aceptación

- [ ] Si el backend responde 400 con "El salario debe ser un valor positivo", el mensaje se muestra en el campo "Salario"
- [ ] Si el backend responde 400 con "La razón es obligatoria cuando se cambia el salario", el campo "Razón" se marca con error
- [ ] Los mensajes de error se muestran en español
- [ ] Los errores no impiden que otros campos se muestren correctamente
- [ ] Al reabrir el modal, los errores se limpian

### Notas Técnicas

- Nuevas entradas en `parseBackendValidationErrors` para los mensajes de salary y reason
- Los errores se incluyen en `backendFieldErrors`

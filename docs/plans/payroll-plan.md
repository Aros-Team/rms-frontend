# Plan de Implementación: Nómina y Costos Laborales

> **Fecha:** 2026-08-02
> **Estado:** Planificación
> **Módulo:** Payroll & Labor Cost

---

## 1. Resumen del Problema

El sistema actual de nómina solo permite entrada manual de valores flat (salario base, bonificaciones, deducciones). No existe:

- Registro de eventos diarios por trabajador (horas extra, recargos nocturnos, faltas, bonos)
- Liquidación parcial (diaria, semanal, quincenal) con acumulado
- Desglose por tipo de concepto
- Cálculo automático desde `hourly_rate` del trabajador

**Objetivo:** Que el admin pueda registrar eventos durante el mes y liquidar cuando quiera, con un acumulado que al final del mes refleje la nómina real.

---

## 2. Flujo Deseado

```
Durante el mes:
  Admin registra eventos por trabajador:
    - 15/06: Juan trabajó 2 horas extra
    - 18/06: María tuvo recargo nocturno 4 horas
    - 20/06: Pedro falta injustificada
    - 22/06: Juan bono por asistencia

  Admin liquidar cuando quiera:
    - Liquidación diaria: paga lo acumulado del día
    - Liquidación semanal: paga lo acumulado de la semana
    - Liquidación quincenal: paga lo acumulado de la quincena
    - Cada liquidación queda registrada

Al final del mes:
  Nómina consolidada = baseSalary + sum(bonuses) - sum(deductions)
  Pagado = sum(settlements)
  Pendiente = netAmount - pagado
```

---

## 3. Requisitos del Backend

### 3.1 Nuevas Tablas

#### `payroll_events`

Registros individuales de eventos por trabajador por día.

```sql
CREATE TABLE payroll_events (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    event_date DATE NOT NULL,
    event_type VARCHAR(30) NOT NULL,  -- Ver enum PayrollEventType
    quantity DECIMAL(10,2) NOT NULL,  -- Horas, días, unidades
    unit_rate DECIMAL(12,2) NOT NULL, -- COP por unidad
    amount DECIMAL(12,2) NOT NULL,    -- quantity × unit_rate
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by BIGINT REFERENCES users(id)
);

CREATE INDEX idx_payroll_events_user_period
    ON payroll_events(user_id, event_date);
```

#### `payroll_settlements`

Registro de cada liquidación (pago parcial o total).

```sql
CREATE TABLE payroll_settlements (
    id BIGSERIAL PRIMARY KEY,
    payroll_id BIGINT NOT NULL REFERENCES payroll(id),
    user_id BIGINT NOT NULL REFERENCES users(id),
    settlement_type VARCHAR(20) NOT NULL,  -- DAILY, WEEKLY, BIWEEKLY, MONTHLY
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    notes TEXT,
    settled_at TIMESTAMP NOT NULL DEFAULT NOW(),
    settled_by BIGINT REFERENCES users(id)
);

CREATE INDEX idx_payroll_settlements_payroll
    ON payroll_settlements(payroll_id);
```

### 3.2 Modificar Tabla `payroll`

```sql
ALTER TABLE payroll
    ADD COLUMN paid_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    ADD COLUMN pending_amount DECIMAL(12,2)
        GENERATED ALWAYS AS (net_amount - paid_amount) STORED;
```

### 3.3 Nuevos Enums

```java
public enum PayrollEventType {
    OVERTIME,            // Horas extra (multiplicador > 1)
    NIGHT_SURCHARGE,     // Recargo nocturno
    ABSENCE,             // Falta (deducción)
    BONUS_ATTENDANCE,    // Bono por asistencia
    BONUS_PERFORMANCE,   // Bono por desempeño
    DEDUCTION            // Deducción variable
}

public enum SettlementType {
    DAILY,      // Pago diario
    WEEKLY,     // Pago semanal
    BIWEEKLY,   // Pago quincenal
    MONTHLY     // Pago mensual (el final)
}
```

### 3.4 Nuevos Endpoints

#### Eventos de Nómina

| Método | Ruta | Descripción | Request | Response |
|--------|------|-------------|---------|----------|
| `POST` | `/api/v1/payroll/events` | Registrar evento | `PayrollEventRequest` | `PayrollEventResponse` |
| `GET` | `/api/v1/payroll/events/{userId}/{year}/{month}` | Listar eventos del período | — | `PayrollEventResponse[]` |
| `DELETE` | `/api/v1/payroll/events/{id}` | Eliminar evento | — | 204 |
| `POST` | `/api/v1/payroll/events/calculate` | Calcular monto sugerido | `CalculateEventRequest` | `CalculatedEventResponse` |

#### Liquidaciones

| Método | Ruta | Descripción | Request | Response |
|--------|------|-------------|---------|----------|
| `POST` | `/api/v1/payroll/settle` | Registrar liquidación | `SettlementRequest` | `SettlementResponse` |
| `GET` | `/api/v1/payroll/settlements/{userId}/{year}/{month}` | Listar liquidaciones | — | `SettlementResponse[]` |

#### Nómina (modificar existente)

| Método | Ruta | Cambio |
|--------|------|--------|
| `GET` | `/api/v1/payroll/worker/{userId}/{year}/{month}` | Agregar `paidAmount`, `pendingAmount` en response |
| `GET` | `/api/v1/payroll/{userId}/{year}/{month}` | Agregar `settlements[]` en response |

### 3.5 DTOs Nuevos

#### PayrollEventRequest

```java
public record PayrollEventRequest(
    @NotNull Long userId,
    @NotNull LocalDate eventDate,
    @NotNull String eventType,       // PayrollEventType name
    @NotNull @Positive BigDecimal quantity,
    @NotNull @Positive BigDecimal unitRate,
    BigDecimal amount,               // Opcional: se calcula si no se envía
    String notes
) {}
```

#### PayrollEventResponse

```java
public record PayrollEventResponse(
    Long id,
    Long userId,
    String userName,
    LocalDate eventDate,
    String eventType,
    BigDecimal quantity,
    BigDecimal unitRate,
    BigDecimal amount,
    String notes,
    Instant createdAt
) {}
```

#### SettlementRequest

```java
public record SettlementRequest(
    @NotNull Long userId,
    @NotNull Integer year,
    @NotNull Integer month,
    @NotNull String settlementType,  // SettlementType name
    @NotNull LocalDate periodStart,
    @NotNull LocalDate periodEnd,
    @NotNull @Positive BigDecimal amount,
    String notes
) {}
```

#### SettlementResponse

```java
public record SettlementResponse(
    Long id,
    Long payrollId,
    Long userId,
    String userName,
    String settlementType,
    LocalDate periodStart,
    LocalDate periodEnd,
    BigDecimal amount,
    String notes,
    Instant settledAt
) {}
```

#### CalculateEventRequest

```java
public record CalculateEventRequest(
    @NotNull Long userId,
    @NotNull String eventType,
    @NotNull @Positive BigDecimal quantity,
    @NotNull LocalDate eventDate
) {}
```

#### CalculatedEventResponse

```java
public record CalculatedEventResponse(
    BigDecimal hourlyRate,       // Del trabajador
    BigDecimal multiplier,       // Del tipo de evento
    BigDecimal suggestedRate,    // hourlyRate × multiplier
    BigDecimal suggestedAmount   // suggestedRate × quantity
) {}
```

### 3.6 Lógica de Agregación

**Al registrar un evento:**

```java
// Guardar evento
payrollEventRepository.save(event);

// Recalcular nómina del período
Payroll payroll = getOrCreatePayroll(userId, year, month);
List<PayrollEvent> events = payrollEventRepository.findByUserAndPeriod(userId, year, month);

BigDecimal totalBonuses = events.stream()
    .filter(e -> e.type() == BONUS_ATTENDANCE || e.type() == BONUS_PERFORMANCE)
    .map(PayrollEvent::amount)
    .reduce(BigDecimal.ZERO, BigDecimal::add);

BigDecimal totalDeductions = events.stream()
    .filter(e -> e.type() == ABSENCE || e.type() == DEDUCTION)
    .map(PayrollEvent::amount)
    .reduce(BigDecimal.ZERO, BigDecimal::add);

BigDecimal totalExtraHours = events.stream()
    .filter(e -> e.type() == OVERTIME || e.type() == NIGHT_SURCHARGE)
    .map(PayrollEvent::quantity)
    .reduce(BigDecimal.ZERO, BigDecimal::add);

Money netAmount = payroll.baseSalary().plus(totalBonuses).minus(totalDeductions);

payrollRepository.save(payroll.withBonuses(totalBonuses).withDeductions(totalDeductions)
    .withHoursWorked(totalExtraHours).withNetAmount(netAmount));
```

**Al registrar una liquidación:**

```java
// Guardar liquidación
Settlement settlement = settlementRepository.save(settlement);

// Acumular en nómina
Payroll payroll = payrollRepository.findById(settlement.payrollId());
BigDecimal newPaidAmount = payroll.paidAmount().plus(settlement.amount());
payrollRepository.save(payroll.withPaidAmount(newPaidAmount));
```

### 3.7 Multiplicadores Sugeridos (configurables)

| Tipo de Evento | Multiplicador | Fórmula |
|----------------|---------------|---------|
| `OVERTIME` | 1.5x | hourly_rate × 1.5 × quantity |
| `NIGHT_SURCHARGE` | 1.75x | hourly_rate × 1.75 × quantity |
| `ABSENCE` | -1.0x | hourly_rate × -1 × quantity (deducción) |
| `BONUS_ATTENDANCE` | 0.5x | hourly_rate × 0.5 × quantity |
| `BONUS_PERFORMANCE` | manual | El admin define el valor |
| `DEDUCTION` | manual | El admin define el valor |

---

## 4. Plan de Implementación Frontend

### 4.1 DTOs a Crear

**Carpeta:** `src/app/shared/models/dto/payroll/`

| Archivo | Interface |
|---------|-----------|
| `payroll-event-request.ts` | `PayrollEventRequest` |
| `payroll-event-response.ts` | `PayrollEventResponse` |
| `payroll-request.ts` | `PayrollRequest` (con `status` para PATCH) |
| `payroll-response.ts` | `PayrollResponse` (con `paidAmount`, `pendingAmount`) |
| `settlement-request.ts` | `SettlementRequest` |
| `settlement-response.ts` | `SettlementResponse` |

```typescript
// payroll-event-request.ts
export interface PayrollEventRequest {
  userId: number;
  eventDate: string;         // "2026-06-15"
  eventType: PayrollEventType;
  quantity: number;
  unitRate: number;
  amount?: number;           // Se calcula si no se envía
  notes?: string;
}

// payroll-event-response.ts
export interface PayrollEventResponse {
  id: number;
  userId: number;
  userName: string;
  eventDate: string;
  eventType: PayrollEventType;
  quantity: number;
  unitRate: number;
  amount: number;
  notes: string;
  createdAt: string;
}

// settlement-request.ts
export interface SettlementRequest {
  userId: number;
  year: number;
  month: number;
  settlementType: SettlementType;
  periodStart: string;
  periodEnd: string;
  amount: number;
  notes?: string;
}

// settlement-response.ts
export interface SettlementResponse {
  id: number;
  payrollId: number;
  userId: number;
  userName: string;
  settlementType: SettlementType;
  periodStart: string;
  periodEnd: string;
  amount: number;
  notes: string;
  settledAt: string;
}

export type PayrollEventType =
  | 'OVERTIME'
  | 'NIGHT_SURCHARGE'
  | 'ABSENCE'
  | 'BONUS_ATTENDANCE'
  | 'BONUS_PERFORMANCE'
  | 'DEDUCTION';

export type SettlementType = 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';

export type PayrollStatus = 'PENDING' | 'ACCRUED' | 'PAID';
```

### 4.2 Servicio a Crear

**Archivo:** `src/app/core/services/payroll/payroll.ts`

```typescript
@Injectable({ providedIn: 'root' })
export class PayrollService {
  // ── Eventos ──
  createEvent(data: PayrollEventRequest): Observable<PayrollEventResponse>
  listEvents(userId: number, year: number, month: number): Observable<PayrollEventResponse[]>
  deleteEvent(id: number): Observable<void>

  // ── Liquidaciones ──
  settle(data: SettlementRequest): Observable<SettlementResponse>
  listSettlements(userId: number, year: number, month: number): Observable<SettlementResponse[]>

  // ── Nómina consolidada ──
  getPayroll(userId: number, year: number, month: number): Observable<PayrollResponse>
  listPayrolls(year: number, month: number): Observable<PayrollResponse[]>
  updatePayroll(id: number, data: Partial<PayrollRequest>): Observable<PayrollResponse>
  deletePayroll(id: number): Observable<void>

  // ── Cálculo sugerido ──
  calculateSuggestedAmount(userId: number, eventType: PayrollEventType, quantity: number, eventDate: string): Observable<CalculatedEvent>
}
```

### 4.3 Modificar Componente Workers

**Archivos a modificar:**
- `src/app/areas/admin/features/manage/features/workers/workers.ts`
- `src/app/areas/admin/features/manage/features/workers/workers.html`

#### Cambios en `workers.ts`:

```typescript
// Tipo de tab extendido
activeEmployeeTab = signal<'list' | 'time-logs' | 'payroll'>('list');

// Signals de nómina
payrollEvents = signal<PayrollEventResponse[]>([]);
payrollSettlements = signal<SettlementResponse[]>([]);
payrollSummary = signal<PayrollResponse | null>(null);
payrollLoading = signal(false);
payrollYear = signal(new Date().getFullYear());
payrollMonth = signal(new Date().getMonth() + 1);

// Modal de evento
eventModalVisible = signal(false);
editingEvent = signal(false);
selectedEvent = signal<PayrollEventResponse | null>(null);

// Modal de liquidación
settleModalVisible = signal(false);

// Métodos
switchTab(tab): void
loadPayrollData(): void
showCreateEventModal(): void
showEditEventModal(event): void
createEvent(): void
updateEvent(): void
deleteEvent(event): void
showSettleModal(): void
settle(type: SettlementType): void
generatePayroll(): void
```

#### Cambios en `workers.html`:

```html
<!-- Tab button -->
<button (click)="switchTab('payroll')" [class.active]="activeEmployeeTab() === 'payroll'">
  Nómina
</button>

<!-- Payroll panel -->
@if (activeEmployeeTab() === 'payroll') {
  <div class="payroll-panel">
    <!-- Period selector -->
    <div class="period-selector">
      <p-select [(ngModel)]="payrollMonth" [options]="months" />
      <p-select [(ngModel)]="payrollYear" [options]="years" />
      <p-button label="Cargar" (onClick)="loadPayrollData()" />
    </div>

    <!-- Summary cards -->
    <div class="grid grid-cols-4 gap-4 mb-4">
      <p-card><label>Salario Base</label><span>{{ summary()?.baseSalary | currency }}</span></p-card>
      <p-card><label>Total Bonificaciones</label><span>{{ summary()?.bonuses | currency }}</span></p-card>
      <p-card><label>Total Deducciones</label><span>{{ summary()?.deductions | currency }}</span></p-card>
      <p-card><label>Neto a Pagar</label><span>{{ summary()?.netAmount | currency }}</span></p-card>
    </div>

    <!-- Pending amount -->
    @if (summary()?.pendingAmount > 0) {
      <p-message severity="warn" text="Pendiente por pagar: {{ summary()?.pendingAmount | currency }}" />
    }

    <!-- Events table -->
    <p-table [value]="payrollEvents()">
      <ng-template pTemplate="header">
        <tr>
          <th>Fecha</th>
          <th>Tipo</th>
          <th>Cantidad</th>
          <th>Valor Unitario</th>
          <th>Total</th>
          <th>Notas</th>
          <th>Acciones</th>
        </tr>
      </ng-template>
      <ng-template pTemplate="body" let-event>
        <tr>
          <td>{{ event.eventDate }}</td>
          <td><p-tag [value]="event.eventType" [severity]="getEventSeverity(event.eventType)" /></td>
          <td>{{ event.quantity }}</td>
          <td>{{ event.unitRate | currency }}</td>
          <td>{{ event.amount | currency }}</td>
          <td>{{ event.notes }}</td>
          <td>
            <p-button icon="pi pi-pencil" (click)="showEditEventModal(event)" />
            <p-button icon="pi pi-trash" severity="danger" (click)="deleteEvent(event)" />
          </td>
        </tr>
      </ng-template>
    </p-table>

    <!-- Settlements history -->
    <h3>Liquidaciones Realizadas</h3>
    <p-table [value]="payrollSettlements()">
      <ng-template pTemplate="header">
        <tr>
          <th>Fecha</th>
          <th>Tipo</th>
          <th>Período</th>
          <th>Monto</th>
          <th>Notas</th>
        </tr>
      </ng-template>
      <ng-template pTemplate="body" let-settlement>
        <tr>
          <td>{{ settlement.settledAt }}</td>
          <td><p-tag [value]="settlement.settlementType" /></td>
          <td>{{ settlement.periodStart }} - {{ settlement.periodEnd }}</td>
          <td>{{ settlement.amount | currency }}</td>
          <td>{{ settlement.notes }}</td>
        </tr>
      </ng-template>
    </p-table>

    <!-- Action buttons -->
    <div class="flex gap-2 mt-4">
      <p-button label="Registrar Evento" icon="pi pi-plus" (click)="showCreateEventModal()" />
      <p-button label="Liquidar" icon="pi pi-wallet" (click)="showSettleModal()" />
      <p-button label="Pagar Nómina" icon="pi pi-check" severity="success" (click)="generatePayroll()" />
    </div>
  </div>
}

<!-- Event modal -->
<p-dialog [(visible)]="eventModalVisible" [header]="editingEvent() ? 'Editar Evento' : 'Registrar Evento'">
  <form [formGroup]="eventForm">
    <p-iftalabel>
      <p-select formControlName="eventType" [options]="eventTypes" optionLabel="label" optionValue="value" />
      <label>Tipo de Evento</label>
    </p-iftalabel>

    <p-iftalabel>
      <p-datepicker formControlName="eventDate" dateFormat="dd/mm/yy" />
      <label>Fecha</label>
    </p-iftalabel>

    <p-iftalabel>
      <p-inputnumber formControlName="quantity" [min]="0" [maxFractionDigits]="2" />
      <label>Cantidad (horas/días)</label>
    </p-iftalabel>

    <p-iftalabel>
      <p-inputnumber formControlName="unitRate" [min]="0" [maxFractionDigits]="0" locale="es-CO" />
      <label>Valor Unitario (COP)</label>
    </p-iftalabel>

    <p-iftalabel>
      <p-inputnumber formControlName="amount" [min]="0" [maxFractionDigits]="0" locale="es-CO" readonly />
      <label>Total</label>
    </p-iftalabel>

    <p-iftalabel>
      <input pInputText formControlName="notes" />
      <label>Notas</label>
    </p-iftalabel>
  </form>
</p-dialog>

<!-- Settle modal -->
<p-dialog [(visible)]="settleModalVisible" header="Registrar Liquidación">
  <p>Seleccione el tipo de liquidación:</p>
  <div class="flex flex-col gap-2">
    <p-button label="Diario" (onClick)="settle('DAILY')" />
    <p-button label="Semanal" (onClick)="settle('WEEKLY')" />
    <p-button label="Quincenal" (onClick)="settle('BIWEEKLY')" />
    <p-button label="Mensual" (onClick)="settle('MONTHLY')" />
  </div>
</p-dialog>
```

### 4.4 Modificar DTOs de Workers

**Modificar** `src/app/shared/models/dto/workers/worker-response.ts`:
```typescript
export interface WorkerResponse {
  // ... campos existentes
  expectedHoursPerMonth: number;  // NUEVO
  hourlyRate: number;             // NUEVO (calculado)
}
```

**Modificar** `src/app/shared/models/dto/workers/create-worker-request.ts`:
```typescript
export interface CreateWorkerRequest {
  // ... campos existentes
  expectedHoursPerMonth?: number;  // NUEVO
}
```

### 4.5 Modificar Formulario de Trabajadores

**Modificar** `workers.ts`:
- Agregar `expectedHoursPerMonth` al `WorkerFormValue` y form group
- Agregar al `fillFormWithData()` y `formToRequest()`

**Modificar** `workers.html`:
- Agregar `<p-inputnumber>` para `expected_hours_per_month` junto al campo `salary`
- Mostrar `hourlyRate` como texto solo lectura debajo

### 4.6 Modificar Costo de Producto

**Modificar** `src/app/core/services/products/product.ts`:
- `getCost(productId, year?, month?)` con query params opcionales

**Modificar** `product-detail-dialog` y products wizard step 4:
- Agregar selector de período (mes/año) antes del desglose de costo
- Al cambiar período → re-llamar `getCost()` con nuevos parámetros

### 4.7 Modificar PayrollResponse Existente

```typescript
export interface PayrollResponse {
  // ... campos existentes
  paidAmount: number;      // NUEVO: suma de liquidaciones
  pendingAmount: number;   // NUEVO: netAmount - paidAmount
}
```

---

## 5. Resumen de Archivos

### Backend (nuevo trabajo)

| # | Archivo | Descripción |
|---|---------|-------------|
| 1 | `V45__create_payroll_events_table.sql` | Migración tabla eventos |
| 2 | `V46__create_payroll_settlements_table.sql` | Migración tabla liquidaciones |
| 3 | `V47__add_paid_amount_to_payroll.sql` | Migración campos acumulado |
| 4 | `PayrollEventType.java` | Enum de tipos de evento |
| 5 | `SettlementType.java` | Enum de tipos de liquidación |
| 6 | `PayrollEvent.java` | Domain record |
| 7 | `PayrollSettlement.java` | Domain record |
| 8 | `PayrollEventRequest.java` | DTO request |
| 9 | `PayrollEventResponse.java` | DTO response |
| 10 | `SettlementRequest.java` | DTO request |
| 11 | `SettlementResponse.java` | DTO response |
| 12 | `PayrollEventRepository.java` | Puerto de persistencia |
| 13 | `PayrollSettlementRepository.java` | Puerto de persistencia |
| 14 | `RegisterPayrollEventService.java` | Servicio crear evento |
| 15 | `RegisterSettlementService.java` | Servicio crear liquidación |
| 16 | `AggregatePayrollService.java` | Servicio de agregación |
| 17 | `CalculateEventService.java` | Servicio de cálculo sugerido |
| 18 | `PayrollEventController.java` | Controller eventos |
| 19 | `PayrollSettlementController.java` | Controller liquidaciones |
| 20 | Modificar `PayrollEntity.java` | Agregar `paidAmount` |
| 21 | Modificar `PayrollResponse.java` | Agregar `paidAmount`, `pendingAmount` |

### Frontend (nuevo trabajo)

| # | Archivo | Descripción |
|---|---------|-------------|
| 1 | `dto/payroll/payroll-event-request.ts` | Interface evento |
| 2 | `dto/payroll/payroll-event-response.ts` | Interface evento |
| 3 | `dto/payroll/settlement-request.ts` | Interface liquidación |
| 4 | `dto/payroll/settlement-response.ts` | Interface liquidación |
| 5 | `dto/payroll/payroll-request.ts` | Interface nómina (con status) |
| 6 | `dto/payroll/payroll-response.ts` | Interface nómina (con paidAmount) |
| 7 | `services/payroll/payroll.ts` | Servicio API completo |
| 8 | Modificar `workers/workers.ts` | Tab de nómina + CRUD |
| 9 | Modificar `workers/workers.html` | UI del tab nómina |
| 10 | Modificar `dto/workers/worker-response.ts` | Campos nuevos |
| 11 | Modificar `dto/workers/create-worker-request.ts` | Campo nuevo |
| 12 | Modificar `services/products/product.ts` | getCost con período |
| 13 | Modificar `product-detail-dialog` | Selector período |
| 14 | Modificar `products.html` (wizard step 4) | Selector período |

---

## 6. Preguntas Pendientes

1. **¿Los multiplicadores (1.5x horas extra, 1.75x nocturno) deben ser configurables por el admin o son fijos?**

2. **¿La liquidación diaria/semanal es automática (el sistema la hace) o el admin la dispara manualmente?**

3. **¿El admin puede anular una liquidación ya registrada?**

4. **¿Qué pasa si el admin registra un evento después de haber liquidado?** (¿Se descuenta de la siguiente liquidación?)

5. **¿Los eventos pueden ser negativos?** (ej: corrección de un error)

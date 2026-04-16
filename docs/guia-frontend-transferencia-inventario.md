# Guía de Implementación: Transferencia de Inventario (Bodega → Cocina)

Esta guía documenta cómo se implementó la funcionalidad de transferencia de insumos desde **Bodega** a **Cocina** utilizando el endpoint `api/v1/inventory/transfer`.

## 📋 Tabla de Contenidos

1. [Resumen General](#resumen-general)
2. [Modelos de Datos (DTOs)](#modelos-de-datos-dtos)
3. [Servicio de Inventario](#servicio-de-inventario)
4. [Componente de Inventario](#componente-de-inventario)
5. [Interfaz de Usuario (Template)](#interfaz-de-usuario-template)
6. [Flujo de Trabajo Completo](#flujo-de-trabajo-completo)
7. [Validaciones y Manejo de Errores](#validaciones-y-manejo-de-errores)

---

## Resumen General

La funcionalidad permite transferir múltiples insumos simultáneamente desde la ubicación de **Bodega** a **Cocina**. La operación es **atómica**: si algún ítem falla, ninguno se aplica.

### Características principales:
- ✅ Selección múltiple de insumos
- ✅ Control de cantidad por insumo
- ✅ Filtrado por categoría y búsqueda por nombre
- ✅ Validación de stock disponible
- ✅ Operación atómica (todo o nada)
- ✅ Feedback visual con mensajes de éxito/error

---

## Modelos de Datos (DTOs)

### 1. TransferItem (Request)

**Ubicación:** `src/app/shared/models/dto/inventory/transfer-request.ts`

```typescript
export interface TransferItem {
  supplyVariantId: number;  // ID de la variante del insumo
  quantity: number;          // Cantidad a transferir
}
```

### 2. TransferRequest (Request)

```typescript
export interface TransferRequest {
  items: TransferItem[];  // Array de ítems a transferir
}
```

### 3. TransferResponse (Response)

**Ubicación:** `src/app/shared/models/dto/inventory/transfer-response.ts`

```typescript
export interface TransferResponse {
  id: number;                      // ID del movimiento registrado
  supplyVariantId: number;         // ID de la variante transferida
  fromStorageLocationId: number;   // ID de ubicación origen (Bodega)
  toStorageLocationId: number;     // ID de ubicación destino (Cocina)
  quantity: number;                // Cantidad transferida
  movementType: string;            // Tipo de movimiento (ej: "TRANSFER")
  createdAt: string;               // Timestamp de creación
}
```

---

## Servicio de Inventario

**Ubicación:** `src/app/core/services/inventory/inventory-service.ts`

```typescript
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { TransferRequest } from '@models/dto/inventory/transfer-request';
import { TransferResponse } from '@models/dto/inventory/transfer-response';

@Injectable({ providedIn: 'root' })
export class InventoryService {
  private http = inject(HttpClient);

  public transferToKitchen(data: TransferRequest): Observable<TransferResponse[]> {
    return this.http.post<TransferResponse[]>('v1/inventory/transfer', data);
  }
}
```

### Características del servicio:
- Usa `inject()` para inyección de dependencias (patrón moderno de Angular)
- Retorna un `Observable<TransferResponse[]>` con los movimientos registrados
- El endpoint es relativo: `v1/inventory/transfer` (el interceptor agrega la base URL)

---

## Componente de Inventario

**Ubicación:** `src/app/features/admin/manage/inventory/inventory.ts`

### 1. Propiedades del Estado

```typescript
// --- transfer to kitchen dialog ---
transferDialogOpen = false;                              // Control de visibilidad del diálogo
transferSubmitting = signal(false);                      // Estado de carga durante el submit
transferQuantities = signal<Map<number, number>>(new Map());  // Cantidades por insumo
transferSelected = signal<Set<number>>(new Set());       // IDs de insumos seleccionados
transferSearch = signal('');                             // Término de búsqueda
transferCategoryId = signal<number | null>(null);        // Filtro de categoría
```

### 2. Computed Signals (Estado Derivado)

```typescript
// Insumos que tienen stock en bodega (> 0)
transferableSupplies = computed(() =>
  (this.supplies() ?? []).filter((s) => s.stockBodega > 0),
);

// Insumos filtrados por búsqueda y categoría
filteredTransferSupplies = computed(() => {
  const search = this.transferSearch().toLowerCase().trim();
  const catId = this.transferCategoryId();
  return this.transferableSupplies().filter((s) => {
    const matchesSearch = !search || s.supplyName.toLowerCase().includes(search);
    const matchesCat = catId === null || s.categoryId === catId;
    return matchesSearch && matchesCat;
  });
});
```

### 3. Métodos de Control del Diálogo

```typescript
// Abrir el diálogo (resetea el estado)
openTransferDialog(): void {
  this.transferQuantities.set(new Map());
  this.transferSelected.set(new Set());
  this.transferSearch.set('');
  this.transferCategoryId.set(null);
  this.transferDialogOpen = true;
}

// Cerrar el diálogo
closeTransferDialog(): void {
  this.transferDialogOpen = false;
}
```

### 4. Métodos de Selección y Cantidad

```typescript
// Verificar si un insumo está seleccionado
isTransferSelected(variantId: number): boolean {
  return this.transferSelected().has(variantId);
}

// Alternar selección de un insumo
toggleTransferSelection(variantId: number, checked: boolean): void {
  const next = new Set(this.transferSelected());
  if (checked) {
    next.add(variantId);
  } else {
    next.delete(variantId);
  }
  this.transferSelected.set(next);
}

// Obtener cantidad de un insumo
getTransferQty(variantId: number): number {
  return this.transferQuantities().get(variantId) ?? 0;
}

// Establecer cantidad de un insumo
setTransferQty(variantId: number, qty: number): void {
  const next = new Map(this.transferQuantities());
  next.set(variantId, qty);
  this.transferQuantities.set(next);
}
```

### 5. Método de Submit (Lógica Principal)

```typescript
submitTransfer(): void {
  const selected = this.transferSelected();
  const quantities = this.transferQuantities();

  const items: TransferItem[] = [];
  
  // Construir array de ítems y validar
  for (const variantId of selected) {
    const qty = quantities.get(variantId) ?? 0;
    const variant = (this.supplies() ?? []).find((s) => s.id === variantId);
    
    // Validación 1: Cantidad debe ser mayor a 0
    if (qty <= 0) {
      this.messageService.add({
        severity: 'error',
        summary: 'Cantidad inválida',
        detail: `La cantidad para "${variant?.supplyName ?? variantId}" debe ser mayor a 0.`,
      });
      return;
    }
    
    // Validación 2: No exceder stock disponible
    if (variant && qty > variant.stockBodega) {
      this.messageService.add({
        severity: 'error',
        summary: 'Stock insuficiente',
        detail: `"${variant.supplyName}" solo tiene ${variant.stockBodega} ${variant.unitAbbreviation} en bodega.`,
      });
      return;
    }
    
    items.push({ supplyVariantId: variantId, quantity: qty });
  }

  // Validación 3: Al menos un insumo seleccionado
  if (items.length === 0) {
    this.messageService.add({
      severity: 'warn',
      summary: 'Sin selección',
      detail: 'Selecciona al menos un insumo para transferir.',
    });
    return;
  }

  // Realizar la transferencia
  this.transferSubmitting.set(true);
  this.inventoryService.transferToKitchen({ items }).subscribe({
    next: () => {
      this.transferSubmitting.set(false);
      this.closeTransferDialog();
      this.loadSupplies();  // Recargar inventario actualizado
      this.messageService.add({
        severity: 'success',
        summary: 'Transferencia exitosa',
        detail: `${items.length} insumo(s) transferido(s) a cocina.`,
      });
    },
    error: (err: { status?: number; error?: { message?: string } }) => {
      this.transferSubmitting.set(false);
      const detail = err.error?.message ?? 'No se pudo completar la transferencia.';
      this.messageService.add({ severity: 'error', summary: 'Error', detail });
      this.logger.error('Error transferring to kitchen', err);
    },
  });
}
```

---

## Interfaz de Usuario (Template)

**Ubicación:** `src/app/features/admin/manage/inventory/inventory.html`

### 1. Botón de Apertura

```html
<p-button 
  icon="pi pi-arrow-right-arrow-left" 
  severity="secondary" 
  class="btn-icon-text-sm" 
  pTooltip="Transferir a cocina" 
  tooltipPosition="bottom" 
  (click)="openTransferDialog()" 
/>
```

### 2. Diálogo Principal

```html
<p-dialog
  [modal]="true"
  [(visible)]="transferDialogOpen"
  header="Transferir insumos a cocina"
  draggable="false"
  [style]="{ width: '90vw', maxWidth: '680px' }"
  appendTo="body"
>
  <!-- Descripción -->
  <p class="text-surface-600 dark:text-surface-400 text-sm mb-4">
    Selecciona los insumos y la cantidad a mover desde <strong>Bodega</strong> a <strong>Cocina</strong>.
    La operación es atómica: si algún ítem falla, ninguno se aplica.
  </p>

  <!-- Filtros: Búsqueda + Categoría -->
  <div class="flex flex-col sm:flex-row gap-2 mb-3">
    <!-- Campo de búsqueda -->
    <p-iconfield iconPosition="left" class="flex-1">
      <p-inputicon><i class="pi pi-search"></i></p-inputicon>
      <input
        pInputText
        type="text"
        class="w-full"
        placeholder="Buscar por nombre..."
        [ngModel]="transferSearch()"
        (ngModelChange)="transferSearch.set($event)"
        aria-label="Buscar insumo"
      />
    </p-iconfield>
    
    <!-- Filtro de categoría -->
    <p-select
      [options]="categories()"
      optionLabel="name"
      optionValue="id"
      placeholder="Todas las categorías"
      [showClear]="true"
      class="w-full sm:w-52"
      appendTo="body"
      [ngModel]="transferCategoryId()"
      (ngModelChange)="transferCategoryId.set($event)"
      aria-label="Filtrar por categoría"
    />
  </div>

  <!-- Estados vacíos -->
  @if (transferableSupplies().length === 0) {
    <p class="text-center text-surface-500 py-6">
      No hay insumos con stock en bodega disponibles para transferir.
    </p>
  } @else if (filteredTransferSupplies().length === 0) {
    <p class="text-center text-surface-500 py-6">
      No hay resultados para la búsqueda.
    </p>
  } @else {
    <!-- Lista de insumos -->
    <div class="flex flex-col gap-2 max-h-80 overflow-y-auto pr-1" 
         role="list" 
         aria-label="Insumos disponibles para transferir">
      @for (supply of filteredTransferSupplies(); track supply.id) {
        <div
          class="flex items-center gap-3 p-3 rounded-lg border transition-colors"
          [class]="isTransferSelected(supply.id)
            ? 'border-primary-400 bg-primary-50 dark:bg-primary-950'
            : 'border-surface-200 dark:border-surface-700'"
          role="listitem"
        >
          <!-- Checkbox de selección -->
          <p-checkbox
            [binary]="true"
            [ngModel]="isTransferSelected(supply.id)"
            (ngModelChange)="toggleTransferSelection(supply.id, $event)"
            [inputId]="'chk-' + supply.id"
            [attr.aria-label]="'Seleccionar ' + supply.supplyName"
          />
          
          <!-- Información del insumo -->
          <label [for]="'chk-' + supply.id" class="flex-1 cursor-pointer min-w-0">
            <span class="font-medium text-sm block truncate">{{ supply.supplyName }}</span>
            <span class="text-xs text-surface-500">
              {{ supply.categoryName }} · 
              {{ supply.quantity }} {{ supply.unitAbbreviation }} · 
              Bodega: <strong>{{ supply.stockBodega }}</strong>
            </span>
          </label>
          
          <!-- Control de cantidad (solo si está seleccionado) -->
          @if (isTransferSelected(supply.id)) {
            <div class="flex items-center gap-1 shrink-0">
              <!-- Botón decrementar -->
              <p-button
                icon="pi pi-minus"
                [rounded]="true"
                [text]="true"
                size="small"
                severity="secondary"
                (click)="setTransferQty(supply.id, +(getTransferQty(supply.id) - 1).toFixed(3))"
                [disabled]="getTransferQty(supply.id) <= 1"
                [attr.aria-label]="'Reducir cantidad de ' + supply.supplyName"
              />
              
              <!-- Input de cantidad -->
              <input
                type="number"
                class="w-20 text-center border border-surface-300 dark:border-surface-600 rounded-md px-2 py-1 text-sm bg-surface-0 dark:bg-surface-900"
                [ngModel]="getTransferQty(supply.id)"
                (ngModelChange)="setTransferQty(supply.id, +$event)"
                [min]="0.001"
                [max]="supply.stockBodega"
                step="1"
                [attr.aria-label]="'Cantidad a transferir de ' + supply.supplyName"
              />
              
              <!-- Botón incrementar -->
              <p-button
                icon="pi pi-plus"
                [rounded]="true"
                [text]="true"
                size="small"
                severity="secondary"
                (click)="setTransferQty(supply.id, +(getTransferQty(supply.id) + 1).toFixed(3))"
                [disabled]="getTransferQty(supply.id) >= supply.stockBodega"
                [attr.aria-label]="'Aumentar cantidad de ' + supply.supplyName"
              />
            </div>
          }
        </div>
      }
    </div>
  }

  <!-- Footer con acciones -->
  <div class="flex justify-between items-center mt-6">
    <span class="text-sm text-surface-500">
      {{ transferSelected().size }} insumo(s) seleccionado(s)
    </span>
    <div class="flex gap-2">
      <p-button 
        label="Cancelar" 
        severity="secondary" 
        icon="pi pi-times" 
        (click)="closeTransferDialog()" 
      />
      <p-button
        label="Transferir a cocina"
        icon="pi pi-arrow-right"
        iconPos="right"
        [loading]="transferSubmitting()"
        [disabled]="transferSelected().size === 0"
        (click)="submitTransfer()"
      />
    </div>
  </div>
</p-dialog>
```

---

## Flujo de Trabajo Completo

### 1. Usuario abre el diálogo
```
Usuario hace clic en botón "Transferir a cocina"
  ↓
openTransferDialog() se ejecuta
  ↓
Se resetean todos los estados (selección, cantidades, filtros)
  ↓
Se muestra el diálogo con insumos que tienen stock > 0 en bodega
```

### 2. Usuario filtra y selecciona insumos
```
Usuario escribe en búsqueda o selecciona categoría
  ↓
transferSearch() o transferCategoryId() se actualizan
  ↓
filteredTransferSupplies() se recalcula automáticamente (computed)
  ↓
Usuario marca checkboxes de insumos deseados
  ↓
toggleTransferSelection() actualiza transferSelected()
  ↓
Se muestran controles de cantidad para insumos seleccionados
```

### 3. Usuario ajusta cantidades
```
Usuario usa botones +/- o escribe directamente
  ↓
setTransferQty() actualiza transferQuantities()
  ↓
Validación en tiempo real: no puede exceder stockBodega
```

### 4. Usuario confirma transferencia
```
Usuario hace clic en "Transferir a cocina"
  ↓
submitTransfer() se ejecuta
  ↓
Validaciones:
  - Cantidad > 0 para cada ítem
  - Cantidad <= stockBodega para cada ítem
  - Al menos un insumo seleccionado
  ↓
Se construye TransferRequest con array de TransferItem
  ↓
inventoryService.transferToKitchen() hace POST a api/v1/inventory/transfer
  ↓
Backend procesa (operación atómica)
  ↓
Éxito:
  - Se cierra el diálogo
  - Se recarga el inventario (loadSupplies())
  - Se muestra mensaje de éxito
Error:
  - Se muestra mensaje de error con detalle del backend
  - El diálogo permanece abierto para correcciones
```

---

## Validaciones y Manejo de Errores

### Validaciones del Frontend

| Validación | Momento | Mensaje |
|------------|---------|---------|
| Cantidad > 0 | Al hacer submit | "La cantidad para [nombre] debe ser mayor a 0." |
| Cantidad ≤ stock disponible | Al hacer submit | "[nombre] solo tiene X [unidad] en bodega." |
| Al menos 1 insumo seleccionado | Al hacer submit | "Selecciona al menos un insumo para transferir." |
| Cantidad máxima en input | En tiempo real | Botón + deshabilitado cuando qty >= stockBodega |
| Cantidad mínima en input | En tiempo real | Botón - deshabilitado cuando qty <= 1 |

### Manejo de Errores del Backend

```typescript
error: (err: { status?: number; error?: { message?: string } }) => {
  this.transferSubmitting.set(false);
  const detail = err.error?.message ?? 'No se pudo completar la transferencia.';
  this.messageService.add({ severity: 'error', summary: 'Error', detail });
  this.logger.error('Error transferring to kitchen', err);
}
```

**Posibles errores del backend:**
- Stock insuficiente (si cambió entre la carga y el submit)
- Insumo no encontrado
- Ubicación de almacenamiento no válida
- Error de transacción (operación atómica falló)

---

## Características de Accesibilidad

✅ **ARIA labels** en todos los controles interactivos  
✅ **role="list"** y **role="listitem"** para estructura semántica  
✅ **Labels asociados** a checkboxes mediante `[for]` e `[inputId]`  
✅ **Estados de carga** con `[loading]` en botones  
✅ **Estados deshabilitados** con `[disabled]` cuando corresponde  
✅ **Tooltips** para botones de iconos  
✅ **Mensajes de feedback** con PrimeNG Toast (anunciados por lectores de pantalla)

---

## Tecnologías y Patrones Utilizados

- **Angular Signals**: Para estado reactivo (`signal()`, `computed()`)
- **Standalone Components**: Sin NgModules
- **Dependency Injection**: Con `inject()` function
- **RxJS Observables**: Para llamadas HTTP
- **PrimeNG**: Para componentes UI (Dialog, Button, Checkbox, Select, etc.)
- **Reactive State**: Inmutabilidad con `new Map()` y `new Set()`
- **TypeScript Strict Mode**: Tipado fuerte en todo el código

---

## Ejemplo de Payload

### Request enviado al backend:

```json
{
  "items": [
    {
      "supplyVariantId": 15,
      "quantity": 5.5
    },
    {
      "supplyVariantId": 23,
      "quantity": 10
    },
    {
      "supplyVariantId": 8,
      "quantity": 2.25
    }
  ]
}
```

### Response del backend:

```json
[
  {
    "id": 101,
    "supplyVariantId": 15,
    "fromStorageLocationId": 1,
    "toStorageLocationId": 2,
    "quantity": 5.5,
    "movementType": "TRANSFER",
    "createdAt": "2026-04-16T14:30:00Z"
  },
  {
    "id": 102,
    "supplyVariantId": 23,
    "fromStorageLocationId": 1,
    "toStorageLocationId": 2,
    "quantity": 10,
    "movementType": "TRANSFER",
    "createdAt": "2026-04-16T14:30:00Z"
  },
  {
    "id": 103,
    "supplyVariantId": 8,
    "fromStorageLocationId": 1,
    "toStorageLocationId": 2,
    "quantity": 2.25,
    "movementType": "TRANSFER",
    "createdAt": "2026-04-16T14:30:00Z"
  }
]
```

---

## Resumen de Archivos Involucrados

```
src/app/
├── core/services/inventory/
│   └── inventory-service.ts              # Servicio HTTP
├── features/admin/manage/inventory/
│   ├── inventory.ts                      # Componente (lógica)
│   └── inventory.html                    # Template (UI)
└── shared/models/dto/inventory/
    ├── transfer-request.ts               # DTOs de request
    └── transfer-response.ts              # DTOs de response
```

---

## Conclusión

Esta implementación sigue las mejores prácticas de Angular moderno:
- ✅ Componentes standalone
- ✅ Signals para estado reactivo
- ✅ Tipado fuerte con TypeScript
- ✅ Separación de responsabilidades (servicio/componente/template)
- ✅ Validaciones robustas
- ✅ Manejo de errores completo
- ✅ Accesibilidad (WCAG AA)
- ✅ UX intuitiva con feedback visual

La funcionalidad es escalable y fácil de mantener, siguiendo los patrones establecidos en el proyecto.

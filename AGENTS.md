# AGENTS.md - RMS Frontend Knowledge Base

Este archivo concentra el contexto operativo y arquitectonico del proyecto `rms-frontend` para que cualquier persona o IA pueda entenderlo y continuar el trabajo sin perder decisiones clave.

## 1) Objetivo del proyecto

Frontend del sistema RMS (Restaurant Management System), orientado a escalar por modulos y alineado al backend con arquitectura hexagonal.

Objetivo tecnico principal:
- Separar UI, casos de uso y adaptadores externos.
- Mantener reglas de negocio del frontend desacopladas de HTTP y detalles de framework.

## 2) Stack tecnico actual

- Angular 21 (standalone bootstrap)
- TypeScript 5.9
- RxJS 7.8
- Tailwind CSS 3
- PrimeNG 21 y PrimeIcons 7
- Docker + docker compose para ejecucion local
- Taskfile para comandos estandar

## 3) Versiones verificadas

Versiones confirmadas recientemente dentro del contenedor:
- Angular CLI: 21.2.0
- Angular framework: 21.2.0
- Node.js: 20.x

## 4) Arquitectura frontend (hexagonal/clean)

Se usa una arquitectura por capas inspirada en puertos y adaptadores:

- `src/app/features/*`
  - Pantallas y orquestacion de flujos de UI.
  - Puede usar `core` y `shared`.
- `src/app/core/*`
  - Dominio, puertos (input/output) y casos de uso.
  - No depende de `features` ni de `infrastructure`.
- `src/app/infrastructure/*`
  - Adaptadores de tecnologia (HTTP, storage, etc.) que implementan puertos de salida.
- `src/app/shared/*`
  - Componentes reutilizables, utilidades, tipos compartidos de UI.

### Reglas de dependencia

- `features -> core/shared`
- `core -X-> infrastructure/features` (prohibido)
- `infrastructure -> core`

## 5) Estado actual del dominio implementado

Ya existe la base del modulo `orders`:

- Modelos de dominio:
  - `core/orders/domain/models/order.model.ts`
  - `core/orders/domain/models/order-item.model.ts`
  - `core/orders/domain/models/product.model.ts`
- Caso de uso:
  - `core/orders/application/use-cases/add-product-to-order.use-case.ts`
- Puertos:
  - Input: `core/orders/application/ports/input/add-product-to-order.port.ts`
  - Output: `core/orders/application/ports/output/orders.repository.port.ts`
- Token DI:
  - `core/orders/application/tokens/orders.tokens.ts`
- Adaptador HTTP:
  - `infrastructure/http/orders/orders-http.repository.ts`
- Provider de infraestructura:
  - `infrastructure/providers/orders.providers.ts`
- Orquestacion UI (facade):
  - `features/orders/application/orders.facade.ts`
- Pantalla base:
  - `features/orders/pages/orders-home/orders-home.page.ts`

## 5.1) Shared UI implementado

Componente reusable de tarjeta moderna:

- `shared/ui/product-card/product-card.component.ts`
  - Inputs: `product` (`ProductCardViewModel`)
  - Outputs: `add`, `details`
  - Estados: activo/inactivo, stock bajo, no disponible
  - Accesibilidad: `aria-label`, foco visible, botones de accion
- `shared/ui/product-card/product-card-skeleton.component.ts`
  - Estado visual de carga del catalogo
- `shared/ui/product-card/product-card.model.ts`
  - Contratos tipados de entrada y eventos

Regla: mantener la card libre de logica de infraestructura; solo UI + eventos.

## 6) Bootstrap y routing

La app usa bootstrap standalone:

- Entrada: `src/main.ts`
- Config global: `src/app/app.config.ts`
- Rutas: `src/app/app.routes.ts`

Se removio la estructura antigua con `AppModule` para mantener la base moderna de Angular 21.

## 7) Integracion con API

- Proxy de desarrollo: `proxy.conf.json`
- Base URL frontend: `src/environments/environment*.ts`
- Base actual: `apiBaseUrl = '/api/v1'`

El adaptador HTTP de orders llama:
- `POST /api/v1/orders/:orderId/items`

## 8) UI/estilos base

- Estilos globales en `src/styles.css`
- Variables CSS base para color/typography
- Fondo con gradientes y look intencional para evitar estilo plano por defecto

## 9) Ejecucion local

### Opcion recomendada (Docker)

- `task run`
- App en `http://localhost:4200`

### Comandos utiles

- `task build`: build de la app
- `task logs`: logs del contenedor frontend
- `task stop`: detener servicios frontend
- `task clean`: detener y limpiar orfanos

## 10) Convenciones de implementacion

- Crear nuevos modulos siguiendo la misma estructura por capa (`features/core/infrastructure`).
- Evitar inyectar `HttpClient` directamente en componentes de `features`.
- Toda llamada externa debe pasar por un puerto de salida y su adaptador.
- Mantener nombres de casos de uso orientados a accion (ej: `CreateOrderUseCase`, `UpdateStockUseCase`).
- Usar facades en `features` para simplificar componentes.

## 11) Checklist para nuevas features

1. Crear modelos de dominio en `core/.../domain/models`.
2. Definir puertos input/output en `core/.../application/ports`.
3. Crear caso de uso en `core/.../application/use-cases`.
4. Implementar adaptador en `infrastructure/...`.
5. Registrar providers DI en `infrastructure/providers`.
6. Exponer flujo desde facade en `features/.../application`.
7. Integrar pantalla/componente en `features/.../pages`.
8. Ajustar rutas y validar `task build`.

## 12) Riesgos y deudas tecnicas actuales

- Host local sin `npm` instalado: se depende de Docker para ejecutar.
- No hay suite de tests de frontend configurada/activa para flujos nuevos.
- No hay manejo global de errores HTTP/interceptores aun.

## 13) Siguientes pasos recomendados

- Crear capa `shared/ui` con componentes base (input, button, card, layout).
- Agregar interceptores (`auth`, `error`, `loading`) en infraestructura HTTP.
- Definir estado por feature con signals/store ligero.
- Agregar pruebas unitarias para facades y casos de uso.

## 14) Modulo de Legal / Habeas Data

Modal de consentimiento legal que aparece una vez al iniciar la sesion:

- `shared/legal/legal-texts.ts`
  - Textos de Terminos y Condiciones, Politica de Privacidad y Cookies
  - Incluye referencia a Ley 1581 de 2012 (Colombia)
- `shared/legal/legal-consent.service.ts`
  - Servicio para manejar estado de consentimiento
  - Guarda en localStorage con clave `rms_legal_consent`
  - Metodos: `acceptTerms()`, `acceptPrivacy()`, `acceptCookies()`, `acceptAll()`, `resetConsent()`
- `shared/legal/legal-consent-modal.component.ts`
  - Modal con tres pestañas (Terminos, Privacidad, Cookies)
  - Checkboxes individuales para cada consentimiento
  - Boton de aceptar solo habilitador cuando los tresestan marcados
  - Se muestra solo si no existe consentimiento previo

### Integracion

El modal se renderiza en `app.component.ts` y solo aparece si `consentService.needsConsent()` devuelve true.

### Reglas de uso

- El modal aparece una sola vez por usuario/browser
- Una vez aceptado, se guarda en localStorage y no vuelve a aparecer
- Para probar nuevamente: ejecutar `consentService.resetConsent()` desde consola o limpiar localStorage

## 15) Zoneless y Signals (OBLIGATORIO)

### Zoneless

- El proyecto debe funcionar SIN Zone.js
- NO importar `zone.js` en `src/polyfills.ts`
- NO importar `zone.js/testing` en `src/test.ts`
- Usar ChangeDetectionStrategy.OnPush por defecto
- Confiar en signals para reactividad automática

### Signals

- Usar `signal()` para estado mutable/computable
- Usar `computed()` para valores derivados
- Usar `effect()` para side effects (con cuidado)
- Usar `input()` signals para @Input() (Angular 17+)
- Preferir signals sobre BehaviorSubject/Subject
- NO usar `.value` en templates (usar `signal()` como función)

### RxJS

- RxJS solo para operaciones asincronas complejas (streams)
- Preferir signals para estado simple
- Pipes asincronos solo cuando sea necesario

## 16) Sintaxis de Control Flow (OBLIGATORIO)

### NO usar directivas deprecated

- **PROHIBIDO**: `*ngFor`, `*ngIf`, `*ngSwitch`, `ng-container`
- **OBLIGATORIO**: Usar nueva sintaxis de control flow de Angular 17+:

```typescript
// *ngFor -> @for
@for (item of items; track item.id) {
  <li>{{ item.name }}</li>
} @empty {
  <li>No hay elementos</li>
}

// *ngIf -> @if
@if (isLoading) {
  <app-spinner />
} @else if (hasError) {
  <app-error />
} @else {
  <app-content />
}

// *ngSwitch -> @switch
@switch (status) {
  @case ('pending') { <app-pending /> }
  @case ('ready') { <app-ready /> }
  @default { <app-unknown /> }
}
```

### trackBy

- Usar `track` dentro de @for (es la nueva forma de trackBy)
- Ejemplo: `@for (item of items; track item.id)`

## 17) Dependencias

Dependencias recomendadas:

- Angular: ^21.2.1
- PrimeNG: ^21.1.3
- TypeScript: ^5.9.x
- RxJS: ^7.8.x
- Tailwind: ^3.4.x

NO usar versiones anteriores a las especificadas.

## 18) Variables de entorno

El proyecto usa un archivo `.env` para configuraciones locales. Copiar `.env.example` a `.env` antes de ejecutar `npm install`.

### Puppeteer (tests E2E)

| Variable | Descripcion | Valor por defecto |
|----------|-------------|-------------------|
| `PUPPETEER_SKIP_DOWNLOAD` | Omitir descarga automatica de Chrome | `true` |
| `PUPPETEER_EXECUTABLE_PATH` | Ruta al ejecutable de Chrome/Chromium | `/usr/bin/chromium` |

**Instalacion de Chrome/Chromium:**
- Linux (Debian/Ubuntu): `sudo apt install -y chromium`
- macOS: Instalar Google Chrome desde el sitio oficial
- Windows: Instalar Google Chrome desde el sitio oficial

**Problema comun:** Si `npm install` falla por descarga de Chrome, verificar que las variables esten correctamente configuradas en `.env` y que Chrome/Chromium este instalado en el sistema.

# Plan de Implementación: Rendimiento, Diseño y Coherencia Visual

> **Fecha:** 2026-11-23
> **Estado:** Fases 0-7 ejecutadas (2026-11-23); la sección 8 es la lista viva de pendientes
> **Alcance:** `frontend/` (Angular 21 zoneless, PrimeNG 21, Tailwind 4)
> **Referencia del análisis:** `docs/reports/ui-performance-review-2026-11-23.md`

### Estado de ejecución

Todas las fases se implementaron y verificaron juntas el 2026-11-23. El detalle
medido está en la sección 7 del informe de referencia.

| Fase | Estado | Fecha | Qué quedó |
|---|---|---|---|
| **0** | Ejecutada | 2026-11-23 | Baseline medido (788.31 kB raw / 184.64 kB transfer inicial; chart 214.53 kB) e informe |
| **1** | Ejecutada | 2026-11-23 | Registro selectivo de Chart.js, precarga diferida (idle + `data.preload: false`), SW `lazy`, presupuesto 810/850 kB, PWA de marca |
| **2** | Ejecutada | 2026-11-23 | Shell fluido: superficies, escala de radios y capas por token; adiós a `z-[200]` |
| **3** | Ejecutada | 2026-11-23 | Auth migrado a primitivos, H1 con rol y errores por campo |
| **4** | Ejecutada | 2026-11-23 | Combos, catálogos, settings, workers/time-logs/payroll migrados |
| **5** | Ejecutada | 2026-11-23 | Chat en su chunk (`@defer (when isChatOpen())`), bloques bajo el pliegue diferidos, `.rms-defer-view` |
| **6** | Ejecutada | 2026-11-23 | Lint con guardas en `warn`, imports muertos fuera, NG8113 = 0, `DESIGN.md` sección 11.1 |
| **7** | Ejecutada | 2026-11-23 | `app-rms-chart` sobre Chart.js core; chunk 214.53 → 202.08 kB |

Resultado global: 1 633 tests en verde, 0 errores de lint (26 warnings de
estilos inline), build sin warnings y grafo inicial en 801.44 kB / 190.21 kB,
por debajo del límite de 810 kB.

---

## 1. Objetivo

Cerrar las brechas del análisis en tres frentes:

1. **Rendimiento**: quitar peso innecesario del arranque y de los chunks
   (charts, chat, preloader, service worker, presupuestos).
2. **Diseño**: eliminar las dos generaciones de UI que conviven hoy
   (`p-button`/`pInputText` junto a `app-rms-*`), empezando por login.
3. **Coherencia visual**: una sola jerarquía de superficies, una escala de
   radios, una escala de z-index y tokens semánticos en lugar de pares `dark:`.

Reglas no negociables (de `docs/DESIGN.md` y `AGENTS.md`):

- Nada de valores crudos (hex, `rgb()`, `black`, `white`) ni clases de paleta en
  templates de features.
- Los primitivos de `src/app/shared/ui/**` son **solo lectura** en este plan:
  si falta una capacidad, se reporta, no se edita a mitad de una lane.
- No se regeneran baselines visuales ni e2e; se marca `PENDIENTE` en el
  entregable y lo valida la lane de QA.
- No se tocan los archivos con cambios locales del usuario (ver §7).

---

## 2. Fases

| Fase | Contenido | Depende de |
|---|---|---|
| **0** | Baseline medido + informe | — |
| **1** | Rendimiento de arranque (P1, P3, P5, P6, P9) | — |
| **2** | Shell: superficies, radios, z-index (D3, D4, D5) | Fase 1 (tokens) |
| **3** | Login/auth migrado a primitivos (D1, D7, A3, A4) | Fase 2 |
| **4** | Gestión: combos/settings/catálogos + workers/time-logs/payroll | Fase 2 |
| **5** | Defer de contenido pesado + chat (P2, P4) | Fase 1 |
| **6** | Gobernanza: lint, imports muertos, doc | Fase 3–4 |
| **7** | Charts: wrapper propio sobre Chart.js core (lane H) | Fase 1 |

Las fases 1, 2, 5 y 6 son paralelizables entre sí por conjuntos de archivos
disjuntos. Las fases 3 y 4 dependen visualmente de la fase 2, pero se pueden
redactar en paralelo y verificar al final.

---

## 3. Lanes y propiedad de archivos

Cada lane tiene una lista cerrada de archivos. **Ningún archivo pertenece a dos
lanes.** Si una lane necesita un cambio fuera de su lista, lo reporta.

### Lane A — `perf-core` (Fase 1)

| Archivo | Cambio |
|---|---|
| `src/app/shared/ui/chart/chart-theme.ts` (+spec) | `Chart.register(...registerables)` → solo Bar/Line/Doughnut/Bubble + elementos/escalas/plugins usados |
| `src/app/core/preloading/selective-preloading-strategy.ts` (+spec) | Preload diferido (idle/2 s) y respeto a `route.data.preload === false` |
| `src/app/app.routes.ts` | Añadir `data: { preload: false }` a rutas pesadas (`products`, `combos`, `schedules`, `cashier`, `create-product`) |
| `ngsw-config.json` | Grupo `app`: `updateMode: "lazy"` |
| `angular.json` | Presupuesto `initial` 810/850 kB (el builder cuenta el grafo estático completo: baseline 797 kB) |
| `public/manifest.webmanifest` | `theme_color`/`background_color` de marca, `orientation: "any"` |
| `src/index.html` | `id` en metas `theme-color`, `viewport-fit=cover` |
| `src/app/core/services/theme/theme.ts` | Sincronizar ambas metas `theme-color` en `apply()` |

**Aceptación:** `tsc --noEmit` limpio; el chunk de charts baja de tamaño; el
build no sube de presupuesto; con `saveData` o 2G no se precarga nada.

### Lane B — `shell-visual` (Fase 2)

| Archivo | Cambio |
|---|---|
| `src/app/shared/layout/layout/layout.html` | Jerarquía `page` / `chrome` / `content`; quitar `mb-[0.5rem]`, `z-[200]` |
| `src/app/shared/layout/worker-layout/worker-layout.html` (+`.css`) | Misma jerarquía; nav inferior con superficie propia |
| `src/app/shared/components/header/header.html` (+`.ts` si hace falta) | Superficie `chrome`, borde inferior, escala tipográfica |
| `src/app/shared/components/sidebar/sidebar.html` (+`.css`) | Superficie `chrome`, tile activo con `--rms-bg-selected`, `z` por token |
| `src/styles/tokens.css` | Tokens de capa (`--rms-z-sticky/drawer/dialog/toast`) y alias de radio |
| `src/styles.css` | Borrar `.header` muerto; ajustes del shell; sin nuevos `!important` |

**Aceptación:** header y sidebar dejan de compartir exactamente el nivel de
fondo con la página; un único radio por rol; `grep "z-\["` en el shell → 0.

### Lane C — `auth-migration` (Fase 3)

| Archivo | Cambio |
|---|---|
| `src/app/areas/auth/**` (html/ts/css) | Migrar a `app-rms-input`, `app-rms-select`, `app-rms-button`, `app-rms-checkbox`, `app-rms-card`; roles tipográficos; tokens semánticos |

Incluye: login, verificación 2FA, recuperación, reset, setup de cuenta,
`auth.html`. Errores de campo específicos (formato vs requerido). Fila de
términos sin `button` dentro de `span`.

**Aceptación:** `grep "p-button\|pInputText\|text-surface-\|dark:" areas/auth`
→ 0; `login.spec.ts` verde; H1 con rol `rms-h1`; sin cambios de lógica.

### Lane D — `manage-forms` (Fase 4)

| Archivo | Cambio |
|---|---|
| `src/app/areas/admin/features/manage/features/combos/**` | `p-button`/`pInputText` → primitivos; tokens; radios |
| `src/app/areas/admin/features/manage/features/categories/**`, `areas/**`, `tables/**` | migración equivalente |
| `src/app/shared/features/settings/**` | migración equivalente |
| `src/app/shared/components/inline-create-popover/**`, `search-input/**`, `removable-chip/**` | migración equivalente |

**Aceptación:** cero `p-button`/`pInputText`/`text-surface-*`/`dark:` en esos
directorios; ninguna regla nueva con `!important`.

### Lane E — `manage-data` (Fase 4)

| Archivo | Cambio |
|---|---|
| `src/app/areas/admin/features/manage/features/workers/**` | migración equivalente + z-index por token |
| `.../time-logs/**`, `.../inventory/**`, `.../schedules/**` | migración equivalente |
| `src/app/areas/admin/features/manage/features/areas/areas.html` | (solo si no colisiona con Lane D: **cedido a D**) |

`workers/**` incluye `payroll-panel` (`z-[400000]` → `--rms-z-dialog`),
`salary-history`, `worker-card`.

**Aceptación:** cero `z-[`, cero `p-button`/`pInputText`, tokens semánticos.

### Lane F — `perf-ui-defer` (Fase 5)

| Archivo | Cambio |
|---|---|
| `src/app/areas/admin/admin-area.html` + `admin-area.ts` | `@defer (when isChatOpen())` para el chat |
| `src/styles/global.css` | Utilidad `.rms-defer-view` = `content-visibility: auto` + `contain-intrinsic-size` |
| `src/app/areas/admin/features/dashboard/dashboard.html` | `@defer (on viewport)` solo en bloques bajo el pliegue |
| `src/app/areas/admin/features/analytics/**/*.html` | `@defer`/`content-visibility` en secciones bajo el pliegue |

**Aceptación:** `marked`/`dompurify` salen del chunk de `admin-area`; ningún
bloque above-the-fold usa `content-visibility`; `contain-intrinsic-size`
siempre presente.

### Lane H — `charts` (Fase 7, ejecutada)

| Archivo | Cambio |
|---|---|
| `src/app/shared/ui/chart/**` (nuevo `rms-chart` con `<canvas>`) | Sustituir `primeng/chart` (`chart.js/auto`, 214 kB) por Chart.js core + el registro selectivo ya existente |
| `areas/admin/features/{dashboard/components/hourly-sales-chart,analytics/**}` | 7 usos de `<p-chart>` → `<app-rms-chart>`; conservar resize, tabla de datos y resumen accesible |

**Motivo:** `node_modules/primeng/fesm2022/primeng-chart.mjs` hace `import Chart from 'chart.js/auto'`, que registra los ocho tipos y todos los plugins. Mientras exista `ChartModule`, el registro selectivo no reduce el bundle.

### Lane G — `governance` (Fase 6)

| Archivo | Cambio |
|---|---|
| `eslint.config.js` | Regla `warn` que prohíbe `chart.js` `registerables` en `shared/ui/chart`; `no-restricted-syntax` para `z-[…]` y clases `*-surface-*` (solo `warn`) |
| `src/app/areas/admin/features/analytics/features/{cohort,operations,prime-cost}/*.ts` | Quitar imports `RmsButton` no usados (NG8113) |
| `docs/DESIGN.md` | Añadir §11.1 estado de migración, escala de radios y capas |

**Aceptación:** build sin NG8113; `lint:check` verde con las reglas en `warn`.

---

## 4. Secuencia de ejecución

1. **Oleada 1 (paralela):** A, B, F, G.
2. **Oleada 2 (paralela, tras revisar B):** C, D, E.
3. **Verificación integrada (yo):**
   - `npx tsc -p tsconfig.app.json --noEmit`
   - `npm run lint:check`
   - `npx vitest run` (suite unitaria)
   - `npm run build` (presupuestos + ausencia de NG8113)
   - `grep` gates de §5
4. **Cierre:** informe de resultados, lista de pendientes para QA (e2e/axe/
   baselines visuales).

---

## 5. Puertas de calidad (grep gates)

```bash
# 1. Áreas migradas sin API legacy
grep -rnE "p-button|pInputText|text-surface-[0-9]|dark:|bg-primary-contrast" \
  src/app/areas/auth src/app/areas/admin/features/manage/features/combos \
  src/app/shared/features/settings

# 2. Sin z-index ad-hoc en features
grep -rn "z-\[" src/app --include=*.html

# 3. Sin valores crudos en templates
grep -rnE "(text|bg|border)-(red|green|blue|amber|emerald|slate|gray)-[0-9]+" \
  src/app --include=*.html

# 4. Sin import de registerables
grep -rn "registerables" src/app
```

Meta: (1), (2), (4) = 0 en las áreas migradas; (3) = 0 global.

---

## 6. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Migrar templates rompe specs JIT (`?raw`) | Cada lane ejecuta el spec de su área antes de entregar |
| `@defer` cambia el DOM inicial de e2e/axe | Solo bloques bajo el pliegue; QA regenera baselines |
| Lint nuevo bloquea el build | Reglas en `warn` durante la migración |
| Dos lanes tocan el mismo primitivo | Primitivos declarados solo lectura |
| Cambios de presupuesto ocultan regresiones | Bajar el límite, nunca subirlo sin justificar |
| Cambios locales del usuario | Lista explícita de archivos prohibidos (§7) |

---

## 7. Archivos prohibidos (cambios locales sin commitear)

Ninguna lane puede editar:

- `src/app/areas/admin/features/manage/features/products/product-recipe-page/product-recipe-page.css`
- `src/app/areas/admin/features/manage/features/products/products.html`
- `src/app/areas/worker/features/waiter/products/products.css`
- `src/app/core/services/notifications/notification-center.ts`
- `src/app/shared/components/product-card/product-card.html`
- `src/app/shared/components/product-options-modal/product-options-modal.html`

Los dos `<img>` de previsualización sin `width`/`height` viven en
`products.html` (bloqueado): quedan como tarea de seguimiento.

---

## 8. Pendientes (lista viva)

Única fuente de lo que queda. El orden y la paralelización se detallan en
`docs/plans/pending-parallel-plan.md`.

| ID | Tema | Estado | Referencia |
|---|---|---|---|
| 2 + 9 | Migrar las tres plantillas legacy (`products.html`, `product-card`, `product-options-modal`) y dar `width`/`height` a las 2 previews | Hecho | pending-parallel-plan, P3 |
| 7 | Recortar PrimeIcons a `woff2` (retirar las otras cuatro variantes) | Hecho | pending-parallel-plan, P2 |
| — | Chunk de charts en 202 kB: diferir el chart del dashboard (`@defer (on idle)`) o cambiar de motor | Hecho: dashboard difiere el chart con `@defer (on idle)`; el chunk sigue en 202 kB, sin cargarse en el primer paint | pending-parallel-plan, Q1 |
| 8 | `srcset`/AVIF de imágenes de producto | Bloqueado por el contrato de la API | pending-parallel-plan, ola 5 |
| D8 | Deduplicar el bloque de alto contraste de `src/styles.css` | Hecho: 9 `!important` muertos eliminados; el puente `--p-*` se conserva | pending-parallel-plan, Q5 |
| — | Regenerar baselines visuales y correr e2e/axe/LHCI | Hecho (ola 4): 125/125 e2e, 63/63 visuales, login 100/100/100/100 | pending-parallel-plan, ola 4 |
| — | Precarga: era default-on y descargaba 132 chunks en /login | Hecho: opt-in + cookie de sesión + 3 s; login pasa a 40 peticiones y 100 en best-practices | informe, sección 7 |
| 18 | Converger `app-form-validation` en `[error]` de las primitivas | Pendiente: areas y categories en una lane corta; workers necesita decidir areaId/salary | pending-parallel-plan, Q3 |
| 16 | Consolidar duplicados de `shared/components` | Auditoría hecha: fusionar `option-group-badge` en `app-rms-badge`, borrar `tree-node-card` (sin consumidores), conservar `removable-chip` | pending-parallel-plan, Q4 |
| 15 | 26 avisos `no-inline-styles` | Hecho: 0 avisos (geometría dinámica documentada con disable inline) | pending-parallel-plan, P6 |

Solo la ola 4 (QA) se ejecuta al final y sin solaparse con edición de UI.

### 8.1 Decisión: shell fluido (2026-11-23)

El shell de trabajo es **fluido**: header, sidebar y página comparten
`bg-rms-page`, sin borde divisor entre ellos. Exactamente **un contenedor con
borde** envuelve el contenido (el `<main>` del shell admin y la columna de
contenido del shell worker), con `border-rms-border-strong` y el radio de panel
de página. No se reintroducen `border-b`/`border-l` en el chrome ni un segundo
nivel de superficie.

La regla normativa vive en `docs/DESIGN.md`, sección 11.1; este apartado solo
registra la decisión y su punto de referencia.


# Plan de trabajo pendiente y paralelización

> **Fecha:** 2026-11-23
> **Base:** `docs/plans/ui-improvements-plan.md` (fases 0-7 ejecutadas) y
> `docs/reports/ui-performance-review-2026-11-23.md`
> **Objetivo:** terminar los 29 pendientes con el mínimo tiempo de pared,
> sabiendo qué se puede ejecutar a la vez y qué debe ir en serie.

---

## 1. Reglas de paralelización

Estas reglas son la causa de casi todas las restricciones del plan.

1. **Un archivo, un dueño.** Dos lanes nunca editan el mismo archivo. Las lanes
   se definen por lista cerrada de archivos, no por tema.
2. **Un solo build a la vez.** `ng build`, `ng serve`, `vitest` completo y
   Playwright comparten `.angular/cache`, puerto y baselines. Se serializan.
3. **Los tests unitarios dirigidos sí son paralelos** (`npx vitest run <ruta>`),
   porque no escriben en disco compartido.
4. **Las baselines visuales van al final.** Cualquier cambio de UI las invalida;
   regenerarlas antes de terminar el trabajo es trabajo perdido.
5. **El lint se promueve a `error` al final.** Si se hace antes, las lanes en
   vuelo fallan el gate por código que aún están migrando.
6. **Los presupuestos se ajustan después de medir**, nunca antes.
7. **Los docs se actualizan en una sola lane** para no pelearse por
   `DESIGN.md`, el plan y el changelog.

## 2. Mapa de conflictos (quién toca qué)

| Archivo / zona | Lo tocan | Consecuencia |
|---|---|---|
| `src/styles.css` | 7 (PrimeIcons, ola 1), 14 (alto contraste, ola 2) | secuencial, y 14 depende de P3 |
| `src/styles/global.css` | 15 (clases de defer) | prohibido para las demás lanes de la ola 1 |
| `header.html`, `sidebar.*`, `layout.html`, `worker-layout.*` | 22 (safe-area), 17 (nav-item) | ola 1 → ola 2, nunca a la vez |
| `dashboard.html`, `analytics/**/*.html` | 15 (inline styles), 6 (defer del chart) | ola 1 → ola 2, nunca a la vez |
| `workers.html` + `app-form-validation` | 18 (convergencia), 24 (id de areaId) | misma lane |
| `products.html`, `product-card.html`, `product-options-modal.html` | 2 (migración), 9 (dimensiones), 16 (consolidación) | ola 1 → ola 2 |
| `shared/ui/input|select|textarea` | 25 (`describedByIds`) | una lane |
| `shared/ui/chart/**`, `chart-frame.ts` | 11 (recoloreo), 20 (API + test visual) | misma lane |
| `public/manifest.webmanifest`, `public/icons/**` | 23 (maskable) | aislado |
| `eslint.config.js` | 19 (promover a error) | ola 3, sola |
| `angular.json` | 10 (presupuesto) | ola 3, sola |

## 3. Grafo de dependencias (camino crítico)

```
Ola 0  QA de regresión (e2e + axe) ── informa, no bloquea
  │
Ola 1  P1 shell/a11y ── P2 fuentes ── P3 legacy ── P4 charts ── P5 forms ── P6 inline ── P7 docs
  │            │           │           │            │
  │            ▼           │           ▼            │
Ola 2  Q2 nav-item ◄───────┘      Q1 defer chart ◄──┘
       Q3 errores (necesita P5)   Q4 consolidación (necesita P3)
       Q5 alto contraste (necesita P2 + P3)
  │
Ola 3  P19 lint a error ── 10 presupuestos ── 27-29 docs finales
  │
Ola 4  unit ── build ── e2e ── axe ── baselines ── LHCI   (estrictamente serie)
  │
Ola 5  bloqueados: 8 (srcset, API), 26 (PrimeNG), 12-13 (prod)
```

Camino crítico: **P3 legacy → Q4 consolidación → 19 lint → ola 4 de QA**.
La ola 4 no se puede solapar con nada.

---

## 4. Ola 0 — Línea base (serie, 1 lane, ~1-2 h)

> **Estado (2026-11-23): completada.** `npx playwright test smoke a11y` ->
> **125/125 passed** en 2.0 min contra el dev server y la API locales.
> Entorno: `@playwright/test@1.65.0` instalado con `--no-save` y
> `chromium_headless_shell-1254` descargado (eran la causa de los 125 fallos
> iniciales, no el código).

| Paso | Comando | Salida |
|---|---|---|
| Regresión previa | `npx playwright test tests/e2e/smoke` | ¿La migración ya rompió algo? |
| Accesibilidad previa | `npx playwright test --grep "a11y /"` | Lista roja antes de tocar más UI |
| Unit + build | `npm test`, `npm run build` | Confirmar 1633 tests y build limpio |

No se regeneran baselines aquí: solo se compara contra las actuales para saber
qué cambió ya.

## 5. Ola 1 — Siete lanes en paralelo (~1 día)

> **Estado (2026-11-23): completada.** 1637 tests, lint 0 errores / 0 warnings,
> build sin warnings en 803.16 kB, PrimeIcons en un unico woff2, sin `media/`.

Todas son disjuntas a nivel de archivo. Verificación por lane: `tsc --noEmit`,
`eslint` de su carpeta y `vitest run` de sus specs.

### P1 — Shell y seguridad móvil
- 21 `worker-area.ts`: acotar `waitForUserData` (50 intentos, luego login).
- 22 safe-area: `env(safe-area-inset-top)` en header, revisar `worker-layout`.
- 23 iconos maskable: generar variantes con `magick` (hay safe-zone) y corregir
  `purpose` en el manifest.

Archivos: `worker-area.ts`, `header.html`, `layout.html`, `worker-layout.*`,
`public/manifest.webmanifest`, `public/icons/**`.

### P2 — Fuentes de iconos
- 7 PrimeIcons: importar solo `woff2` (nuevo `src/styles/primeicons.css`),
  retirar las otras cuatro variantes del artefacto.

Archivos: `src/styles.css` y el nuevo `src/styles/primeicons.css`.

**No** se borra aquí el bloque legacy de alto contraste (item 14): ese bloque
sigue siendo el que da contraste a las tres plantillas legacy que P3 está
migrando. Se elimina en Q5, cuando ya no queda ninguna clase `text-surface-*`.

### P3 — Plantillas legacy
- 2 migrar `products.html`, `product-card.html`, `product-options-modal.html`.
- 9 añadir `width`/`height` a las 2 previews de `products.html`.
- 8 `srcset`/AVIF: **srcset responsive cerrado**. El API expone `imageTabletUrl`/`imageDesktopUrl` en `ProductResponse` y el frontend usa `srcset` 400/800/1200w en card, lista waiter, tabla admin y modal. **AVIF sigue bloqueado**: el pipeline de imágenes del backend solo genera WebP.

Archivos: los tres templates y sus `.ts` solo para `imports`.

### P4 — Charts
- 11 recolorear al cambiar de tema: recrear el chart en
  `contentvisibilityautostatechange` o en un `MutationObserver` de `.dark`, no
  solo reaplicar defaults.
- 20 documentar `app-rms-chart` en `DESIGN.md` y añadir un test de tema.

Archivos: `chart-theme.ts`, `rms-chart.ts`, `chart-frame.ts`, `DESIGN.md`.

### P5 — Primitivas de formulario
- 25 `describedByIds` en `RmsSelect` y `RmsTextarea` (mismo patrón que
  `RmsInput`) + specs.

Archivos: `shared/ui/select/**`, `shared/ui/textarea/**`.

### P6 — Estilos inline
- 15 convertir los 26 `no-inline-styles` a clases. Distribución real:
  `prime-cost.html` 7 (swatches de leyenda), `week-grid.html` 3 (geometría de
  celdas), `cohort.html` 3, `settings.html` 2 (anchos de `p-dialog`),
  `habeas-data.html` 2, `general-step.html` 2 (`p-chip`), `dashboard.html` 2
  (`--rms-defer-size`), `operations.html` 2, `menu-engineering.html` 2,
  `alerts.html` 1.

Archivos: `styles/global.css`, analytics templates, `dashboard.html`,
`settings.html`, `habeas-data.html`, `week-grid.html`, `general-step.html`.

### P7 — Docs
- 28 decisión de shell fluido en el plan, 29 `CHANGELOG.md`.
- No toca `DESIGN.md` (lo toca P4) ni el informe.

Archivos: `docs/plans/ui-improvements-plan.md`, `docs/CHANGELOG.md`.

## 6. Ola 2 — Cinco lanes (~1 día)

> **Estado (2026-11-23): completada y cerrada.** 1631+ tests, lint/design:check limpios, build warning-free 793.63 kB. Pendientes reales cerrados: srcset responsive en imágenes de producto (API + frontend), convergencia de validación en workers, y nota histórica de SockJS.

Dependen de la ola 1 por archivos, no por lógica.

| Lane | Items | Depende de | Archivos |
|---|---|---|---|
| **Q1** | 6 `@defer (on idle)` del chart del dashboard | P6 (mismo template) | `dashboard.html` |
| **Q2** | 17 extraer `nav-item` compartido | P1 (shell) | `header.html`, `sidebar.*`, `worker-layout.*`, nuevo primitivo |
| **Q3** | 18 + 24 converger errores en `[error]` del primitivo | P5 | `workers.html`, `form-validation.*`, primitivas |
| **Q4** | 16 consolidar componentes duplicados | P3 | `product-card`, `removable-chip`, `option-group-badge`, `search-input`, `tree-node-card`, `inline-create-popover` |
| **Q5** | 14 borrar el bloque legacy de alto contraste y sus `!important` | P2 y P3 | `src/styles.css` |

Q1, Q2, Q3 y Q5 pueden correr a la vez (archivos distintos). Q4 toca
`shared/components`, sin solape con Q1/Q3, pero **sí** con Q2 si se decide
mover `search-input` al sistema de navegación: en ese caso Q4 va después.
Q5 solo puede empezar cuando P3 haya dejado a cero las clases
`text-surface-*`/`dark:`; hasta entonces el bloque sigue siendo necesario.

## 7. Ola 3 — Serie (2-3 h)

| Orden | Item | Motivo para no paralelizar |
|---|---|---|
| 1 | 19 promover ESLint a `error` y añadir guardas de clases | debe ser el último cambio de código |
| 2 | 10 ajustar presupuesto inicial | depende de 6 y 7 (medición real) |
| 3 | 27 cerrar el plan con resultados | depende de todo lo anterior |

## 8. Ola 4 — Verificación final (estrictamente serie, 3-4 h)

> **Estado (2026-11-23): completada.** 1637 unitarios, 125/125 smoke+a11y,
> 63/63 visuales (10 baselines regeneradas), lint y design:check limpios,
> build 803.32 kB. Lighthouse /login: 100/100/100/100 y 40 peticiones JS
> (antes 132). /admin se mide contra el dev server: accessibility 100.

1. `npx tsc -p tsconfig.app.json --noEmit`
2. `npx vitest run` completo
3. `npm run lint:check` (0 errores, warnings aceptados)
4. `npm run build` (presupuesto y cero NG8113)
5. `npx playwright test tests/e2e/smoke`
6. `npx playwright test --grep "a11y /"`
7. Regenerar baselines visuales y revisar el diff
8. `npm run lighthouse` y `npm run lighthouse:admin`

Nada de esto se solapa con edición de UI.

## 9. Ola 5 — Bloqueados o grandes (no ahora)

| Item | Bloqueo | Se puede adelantar |
|---|---|---|
| 8 AVIF | el backend genera WebP; no hay variante AVIF | generar AVIF en `UploadImageService` y exponer URLs |
| 26 sustituir `p-password`, `p-datepicker`, `p-table`, `p-selectbutton` | requiere primitivas nuevas | no |
| 12/13 verificar precarga y SW en producción | requiere despliegue | no |
| 1-5 completo con datos reales | entorno de QA | parcialmente |

---

## 10. Resumen de paralelismo

| Se puede hacer en paralelo | No se puede |
|---|---|
| P1, P2, P3, P4, P5, P6, P7 (archivos disjuntos) | Dos lanes sobre `styles.css` |
| Q1, Q2, Q3, Q5 (archivos disjuntos) | Borrar el alto contraste antes de P3 |
| Q1, Q2, Q3, Q4 (con las salvedades de §6) | Dos lanes sobre shell o dashboard |
| `vitest` dirigido de cada lane | `ng build` / `ng serve` / Playwright concurrentes |
| `tsc --noEmit` y `eslint` por carpeta | Promover lint antes de terminar las lanes |
| Generación de iconos maskable | Regenerar baselines antes de la ola 4 |
| Documentación de P7 con P1-P6 | Ajustar presupuesto antes de medir |

## 11. Estimación

| Ola | Duración | Paralelismo |
|---|---|---|
| 0 | 1-2 h | serie |
| 1 | ~1 día | 7 lanes |
| 2 | ~1 día | 5 lanes |
| 3 | 2-3 h | serie |
| 4 | 3-4 h | serie |
| 5 | 2-4 días | fuera de este plan |

Total hasta merge limpio: **2 a 3 días** con las olas 1 y 2 en paralelo, frente a
**6 a 8 días** en serie.

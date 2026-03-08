# TODO: Migración a PrimeNG + Componentes Reutilizables

## Progreso: 100% ✅ PROYECTO COMPLETO

### Par 7: rms-cart-item + rms-toast-service ✅ COMPLETADO
- [x] 7.1 rms-cart-item - Item del carrito
- [x] 7.2 rms-toast-service - Servicio de notificaciones

---

## FASE 2: Layout y Shell ✅ COMPLETADO
- [x] 2.1 app.component.ts - logout button → rms-button
- [x] 2.2 shell-header.component.ts - revisar tokens
- [x] 2.3 shell-sidebar.component.ts - ya usa tokens correctamente
- [x] 2.4 app-shell-layout.component.ts - tokens

## FASE 3: Componentes Legales ✅ COMPLETADO
- [x] 3.1 legal-consent-modal → p-dialog + p-tabs + rms-button

## FASE 4: Product Card ✅ COMPLETADO
- [x] 4.1 product-card → p-card + p-tag + rms-button
- [x] 4.2 skeleton → p-skeleton

## FASE 5: Páginas ✅ COMPLETADO
- [x] 5.1 login.page.ts → rms-button, rms-input
- [x] 5.2 orders-home.page.ts → rms-page-header, rms-select, rms-cart-item
- [x] 5.3 orders-list.page.ts → rms-page-header, rms-select, rms-badge, rms-button, rms-card
- [x] 5.4 products-list.page.ts → rms-page-header, rms-search-box, rms-filter-chips
- [x] 5.5 product-create.page.ts → rms-page-header, rms-input, rms-select, rms-textarea
- [x] 5.6 kitchen-dashboard.page.ts → rms-page-header, rms-badge, rms-button, rms-card

---

## PROYECTO COMPLETADO ✅

---

## Notas
- Templates >15 líneas → archivo .html separado
- Usar tokens PrimeNG, NUNCA hardcoded colors
- Preferir signals sobre BehaviorSubject
- Usar @if/@for/@switch (control flow)

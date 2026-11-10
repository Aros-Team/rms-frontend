---
target: toda la web (auth + admin + worker)
total_score: 19
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 3
target_identity: "file:/home/jorge/Projects/aros/rms/frontend/src/app (whole web app: auth, admin, worker)"
timestamp: 2026-11-10T14-42-57Z
slug: src-app-whole-web-app-auth-admin-worker
---
⚠️ DEGRADED: single-context (sub-agent tool unavailable at this session depth — assessments A and B ran sequentially in one context)

Target: whole web app — `src/app` (auth, admin, worker areas), Angular 21 + PrimeNG 21 + Tailwind 4.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Skeletons in 19 templates, server-status pill, WS + polling fallback — but toasts have no `role`/`aria-live`, and the batch-save state on orders is invisible until you look at a badge |
| 2 | Match System / Real World | 2 | Domain Spanish is right ("Carta", "Mesas", "En Cola"), but money renders in **USD** on combos and in 5 different formats elsewhere |
| 3 | User Control and Freedom | 2 | Dialogs cancel/esc correctly; unsaved order-status batches are lost on navigation, and 401 logs the user out with no `returnUrl` |
| 4 | Consistency and Standards | 2 | Five money renderers, three pagination contracts, two parallel nav models, 155 raw palette classes beside the token system, "Empleados" vs "Trabajadores" |
| 5 | Error Prevention | 2 | Validation + disabled submit + logout confirm exist; but a legal modal and a terms checkbox gate login, and destructive status changes have no confirmation |
| 6 | Recognition Rather Than Recall | 2 | Icons always paired with labels (good); four manage screens and three analytics screens have no entry point at all, and there is no 404 |
| 7 | Flexibility and Efficiency | 2 | Server-side search with debounce and a period selector; zero keyboard shortcuts, zero bulk actions, filters reset on navigation |
| 8 | Aesthetic and Minimalist Design | 2 | Restrained, shadow-free, documented tokens; but 155 raw palette usages, six `border-l-4` slop accents, a 627-line dashboard template, and a CTA at 1.81:1 |
| 9 | Error Recovery | 1 | "Campo requerido" for every validation failure, generic toasts, and an auth failure rendered as "500 — Error de conexión" |
| 10 | Help and Documentation | 1 | No contextual help anywhere; prime-cost, pmix and menu-engineering jargon is never explained |
| **Total** | | **19/40** | **Poor — core flows work but four defects block or mislead users** |

## Design Specificity Verdict

**LLM assessment**: This is not category-interchangeable admin chrome — it knows it is a Colombian restaurant floor tool. "Carta", "Mesas", "En Cola", "Tomar siguiente", the kitchen two-column queue, the waiter bottom-tab flow, the polite `habeas data` modal: those choices come from the business, not from a dashboard template. Where specificity collapses is the money layer and the navigation model. A restaurant system that quotes USD to its own manager, and that hides the purchasing screen behind a URL nobody can click, has stopped being authored and started being assembled. The visual world (Archivo, gold #F9BB0B, border-only surfaces, no shadows) is coherent and deliberate — the DESIGN.md is real and the code mostly follows it — so the identity is worth preserving; the seams are integration seams, not taste.

**Deterministic scan** (`impeccable detect --json src/app`): 14 findings, all `warning`.
- `broken-image` × 8 — **all false positives**. Every one is an Angular `[src]` binding (`product-card.html:24,32`, `products.html:60`, `waiter/products/products.html`, `product-options-modal.html`, plus `tree-node-card.spec.ts`). The detector cannot see property bindings.
- `side-tab` × 6 — **real**: `menu-engineering.ts:294,297`, `chat.css:112`, `product-recipe-page.css:38`. Thick coloured left borders on cards are the AI-UI tell; they also fight the elsewise disciplined border system.
- Nothing else. The detector is clean on contrast, spacing, and typography — consistent with the fact that the visual system itself is the strongest part of this codebase.

**Visual overlays**: not available. No live-server injection was performed, because the critique is source-scoped and the authenticated surface cannot be reached without credentials.

## Overall Impression

The bones are good and the surface is honest: no shadows, one accent colour, real skeletons, real WebSockets, 688 tests, a written design contract. What is broken is the connective tissue — the guard that fabricates a server outage, the currency that switches to USD, the totals that ignore surcharges, and the four modules nobody can navigate to. The single biggest opportunity is not visual: it is to make the app tell the truth. Right now, on the two screens a manager uses every day (orders and dashboard), the numbers are wrong.

## What's Working

1. **Realtime done properly.** `core/services/websocket/websocket.ts` is a real STOMP client with per-topic ref-counted subscriptions and a cache-invalidation channel, and `kitchen.ts:64-102` degrades to 5-second polling when the socket drops. That is the correct pattern for a kitchen display, and most products at this stage do not have it.
2. **Loading states are designed, not improvised.** 19 templates use `p-skeleton` or a shared skeleton component (`orders-table.html:133-141`, `dashboard.html:58-90`). The dashboard keeps the metric labels visible while values skeleton in — that is a deliberate choice and it reads as fast.
3. **A written design contract that the code mostly honours.** `docs/DESIGN.md` bans shadows and absolute black, mandates `bg-primary-contrast`, and the templates obey it almost everywhere. That discipline is why the app looks like one product.

## Priority Issues

### [P0] An auth failure is rendered as "500 — Error de conexión"
- **What**: `AuthGuard.canActivate` redirects to `/server-error` on *any* failure of `refresh()` or `loadUserInfo()` — including the completely normal "no refresh token, user is not logged in" case (`src/app/core/guards/auth/auth.ts:28,34`). Verified in the browser: `GET /admin` and `GET /worker/kitchen` while logged out both land on `/server-error` showing "El servidor está presentando inconvenientes".
- **Why it matters**: A worker who bookmarks the kitchen display and comes back after the session expires is told the restaurant's server is down. They will phone the admin, the admin will restart the backend, and the real cause — expired token — is invisible. It also destroys the first-run path for deep links: nobody re-authenticates because nobody is offered a login form.
- **Fix**: In both guards, separate 401/403 from network/5xx. 401 → `router.parseUrl('/login')` with `?returnUrl=<current>`. 403 → a real "sin permiso" state. Only `status === 0` or `>= 500` reaches `/server-error`. Then log the user back into the screen they came for.
- **Suggested command**: `/impeccable harden`

### [P0] The money layer lies in two different ways
- **What**: (a) Combos are priced in **USD** — `currency:'USD'` appears 12 times (`combos/pricing-step/pricing-step.html:32,41,52,66,90,99,113`, `combos/combos.html:28`), in a business whose every other screen is COP. (b) Order totals ignore surcharges: `calculateTotalPrice` sums `detail.unitPrice` and nothing else (`shared/models/dto/orders/order-response.ts:53-58`), while the API also sends `extraCharge` per line, which the dashboard's revenue aggregation (`dashboard.ts:89,173,191`) never adds.
- **Why it matters**: A manager opening Combos sees a 25.000 COP combo as "$25.00". A manager reading "Composición de ventas" sees revenue that is structurally lower than the till whenever a customer picks an extra. Wrong money in a restaurant back-office is the fastest way to lose the operator's trust in the whole product.
- **Fix**: Delete `currency:'USD'` and route every template through the existing `money` pipe (13 sites already do). Add `extraCharge` into `calculateTotalPrice`, or better, stop computing totals in the client and ask the API for an order total — the response has no `total` field today, which is itself the gap. Also fix `orders-table.html:99`, where the pipe binds before `??`, so `order.total` renders unformatted whenever it exists.
- **Suggested command**: `/impeccable harden`

### [P1] Whole modules are unreachable — the app hides its own features
- **What**: Routes exist for `/admin/manage/suppliers`, `/purchases`, `/time-logs`, `/orders-create`, plus `/admin/create-product`, but no template links to any of them (verified: zero `routerLink` references). `manage.html` hardcodes seven tabs and is unaware of the rest, while the `Manage` component still declares a stale `sections` array (`manage.ts:10-15`) that the template never reads. In analytics, `alerts`, `cohort` and `operations` components are fully built and then `redirectTo`'d away (`app.routes.ts:133-145`), and `analytics-nav.ts` only lists two of them.
- **Why it matters**: Purchase orders, supplier management and time logs are the modules that justify an RMS instead of a POS. They are shipped, tested, and invisible. A user who needs them cannot discover them; a new employee will conclude the product is smaller than it is.
- **Fix**: One source of truth for the manage nav — either the stale `sections` array revived, or a `manageTabs` const with label/icon/link, consumed by the template; add all seven-plus tabs (with grouping if it exceeds five). Restore the three analytics screens to `analytics-nav.ts` or delete their code. Wire `create-product` and `orders-create` to the buttons that should launch them.
- **Suggested command**: `/impeccable distill`

### [P1] Unsaved order-status edits disappear without a warning
- **What**: `orders-table` buffers status changes in memory and surfaces them as "N cambio(s) sin guardar" plus a Save button (`orders-table.ts:280-288`). There is no `beforeunload` guard, no route-deactivation guard, and the 401 interceptor logs the user out from anywhere (`core/interceptors/error/error.ts`).
- **Why it matters**: Changing four orders and then clicking "Dashboard" silently discards four status changes. The kitchen never gets them. This is the exact workflow the screen exists for, and it fails with no signal — the worst class of failure.
- **Fix**: Either save on change (each row is one PUT, and the API already has per-status endpoints) or add a `CanDeactivate` guard plus `beforeunload` while `hasUnsavedChanges` is true.
- **Suggested command**: `/impeccable harden`

### [P1] The primary action is unreadable for low-vision users, and focus is invisible
- **What**: The primary CTA renders white text on `#fbb409` — measured **1.81:1** contrast on the enabled "Entrar al sistema" button (Lighthouse flags `color-contrast` as its only accessibility failure, score 96). Text inputs have `outline: 0px none` and no visible ring on focus.
- **Why it matters**: Every primary action in the app inherits this: login, "Guardar cambios", "Tomar siguiente", the wizard's next buttons. On a greasy, glare-lit tablet in a kitchen this is not a WCAG technicality, it is a user who cannot read the button. And a keyboard or screen-reader user cannot see where they are.
- **Fix**: Put dark text on gold (`text-surface-900` on `#F9BB0B` clears 9:1) or darken the primary to a gold that carries white. Set `--p-inputtext-focus-ring-*` and a visible `outline` on `:focus-visible` globally in `styles.css` rather than per component.
- **Suggested command**: `/impeccable audit`

## API Contract Coherence

Verified against the live spec (`http://localhost:8080/v3/api-docs`, 88 paths, Bearer auth, base `http://localhost:8080`).

| Frontend | Backend | Status | Detail |
|---|---|---|---|
| `orders-total.ts` — `calculateTotalPrice` | `OrderDetailResponse.extraCharge` | DRIFT | Surcharge silently excluded from every total |
| `OrderResponse.total?: number` | `OrderResponse` | MISSING | Field does not exist in the API; the `??` fallback always wins |
| `orders.ts` `queryOrders` → `{ items }` | `GET /v1/orders` → `PageResponse{items,total,page,size,total_pages}` | DRIFT | Items read, pagination metadata discarded; `size: 500` hardcoded, so results silently truncate past 500 orders |
| `products.ts` → `{ content, page }` | `GET /v1/products` → `PagedModelProductResponse` | OK | Second, incompatible envelope for the same concept |
| `PagedProductsApiResponse` vs `PageResponse` | both | DRIFT | Two pagination envelopes in one API (`content/page{number,totalElements}` vs `items/total/total_pages`) — the frontend models both by hand |
| `products.ts:62` `getProductsPage` AND `getProducts` (full array) | `GET /v1/products?page,size,search` | DRIFT | Two access paths to one endpoint; list screens load everything and filter client-side |
| `Money { amount: number }` (`common/money.ts`) | `MoneyDto { amount: string }` | DRIFT | The API sends a decimal **string**; the common model claims number. `analytics/money.ts` declares `amount: string` — two contradictory `Money` types coexist, and 31 `.amount` call sites split across both semantics |
| `auth.refresh()` | `POST /auth/refresh` | OK but unused | Called only from guards; the 401 interceptor logs out instead of refreshing, so a token expiring mid-form loses the form |
| `product-creation-form.ts` | — | DEAD | Injects `HttpClient` directly (the only component that does), unreachable route, duplicated DTOs |
| `special-selections`, `option-groups` two-call pattern | `/option-groups?productId` + `/products/{id}/options` | OK | Correctly implemented per the documented contract |

Error handling: the interceptor distinguishes nothing but 401 (`error.ts:31-36`) — 403, 409 and 422 fall through to whichever ad-hoc handler the component wrote. 14 `catchError` sites across 108 HTTP calls means most failures surface as the interceptor's rethrow, and the user sees either a raw `error()` string (kitchen banner) or a generic toast.

## Persona Red Flags

**Alex (power user / manager)**: No keyboard shortcuts anywhere — `Esc` closes dialogs but nothing else is bound. Changing five order statuses means five dropdown opens plus a Save click, with no bulk select. Deep-linking to `/admin/orders` after lunch returns "500 — Error de conexión" (`guards/auth/auth.ts:34`). The purchase and time-log screens he needs are not in the nav at all. He will keep using the POS and only open RMS for payroll.

**Sam (keyboard / screen reader / low vision)**: Tab onto "Entrar al sistema" and the label is white on gold at 1.81:1. Tab into the email field and there is no focus indicator at all. Submit a wrong password and the only feedback is a `p-toast` with `aria-live=null role=null` — a screen reader announces nothing, and there is no inline error region on the form. The email field has `autocomplete=null`, so assistive autofill cannot help.

**Casey (tablet on the floor)**: The waiter flow is genuinely thumb-friendly (bottom tabs, large product cards), but 16px `small` validation text and 44px `p-button` `size="small"` rows in the orders table are marginal under a thumb. In dark mode the auth area has zero `dark:` classes — login, reset-password, two-factor and setup-account all stay light while the rest of the app goes dark, so the two minutes a waiter spends resetting a password at 8pm are a flashbang.

## Minor Observations

- `index.html` hardcodes `<title>Dashboard | RMS</title>` and no route sets a title — every tab in the browser says "Dashboard".
- `path: '**' → /login` (`app.routes.ts:172`): a typo'd URL silently drops you at the login screen, indistinguishable from being logged out. There is no 404 page.
- `environment.ts` (production) still ships `customer: 'Restaurante de prueba'` — the header badge will read "Restaurante de prueba" in production.
- `baseColor` differs between environments (`#fbb409` dev, `#F9BB0B` prod) and neither matches what `styles.css` resolves; `--color-surface-50` computes empty, so `surface-*` lands on the zinc palette, not the slate family DESIGN.md specifies.
- `layout.html:16` uses `h-[strech]` — a typo for `stretch`; the class is invalid and silently dropped.
- `header.html:91-92`: a permanent `animate-ping` dot on the AI chat button — an infinite attention magnet in a tool used eight hours a day.
- `manage.ts:10-15` dead `sections` array; `orders-table.html:58` declares `globalFilterFields` with no global filter input.
- `login.html:19,37`: every validation failure says "Campo requerido", including a malformed email.
- 18 hardcoded `$ {{ … }}` renderings beside 5 real currency paths; `Intl.NumberFormat('es-Co')` and `'es-CO'` both appear.
- Lighthouse on `/login` (dev server, so indicative): Performance 61, Accessibility 96, Best Practices 81, TBT 8.080 ms, Speed Index 9.3 s. Production bundle is 3.9 MB with 689 KB gzip of JS — measure again against the prod build before acting.

## Questions to Consider

- If the orders table saved on change, would the "Guardar cambios" pattern be needed anywhere else in the app?
- Why does the API return two pagination envelopes and two `Money` shapes at all — and which one is the contract of record?
- If suppliers, purchases, time logs and three analytics screens were deleted tomorrow, what would the product lose that its users would notice?
- Is a legal consent modal the right first impression for a staff-only tool whose users log in eight times a day?

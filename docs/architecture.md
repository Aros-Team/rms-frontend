# Architecture

> What "good work" means in this project.

---

## 1. Overall Structure

```
src/app/
├── core/                    # Singleton services, guards, interceptors
├── shared/                  # Reusable components, models, DTOs
├── areas/                   # Layout wrappers (shell components)
│   ├── admin-area/
│   ├── login-area/
│   ├── worker-kitchen/
│   └── worker-waiter/
└── features/                # Feature modules (lazy-loaded)
    ├── auth/
    ├── admin/
    ├── kitchen/
    ├── waiter/
    └── orders/
```

---

## 2. Areas

Areas are layout wrappers. Each area:
- Contains a routing module with `loadChildren` to its features
- Has a shell component with `<router-outlet>`
- Handles role-based access via guards

| Area | Route Prefix | Role Guard |
|------|-------------|------------|
| `login-area` | `/login` | None |
| `admin-area` | `/admin` | ADMIN |
| `worker-kitchen` | `/worker/kitchen` | KITCHEN |
| `worker-waiter` | `/worker/waiter` | WAITER |

---

## 3. Features

Features are lazy-loaded modules. Each feature folder contains:

```
feature-name/
├── feature-name.ts        # Routing module + component
├── component-a/
│   ├── component-a.ts
│   ├── component-a.html
│   └── component-a.css
├── component-b/
│   ├── component-b.ts
│   ├── component-b.html
│   └── component-b.css
└── models/
    ├── dto-request.ts
    └── dto-response.ts
```

---

## 4. Core

Singletons registered at root level:

```
core/
├── services/          # API services (one file per domain)
├── guards/            # Route guards (auth, role)
├── interceptors/       # HTTP interceptors (jwt, error)
└── models/            # Shared domain models
```

---

## 5. Shared

Cross-cutting components used by multiple features:

```
shared/
├── components/        # Reusable UI components
├── models/            # Shared DTOs and domain models
└── pipes/             # Custom pipes
```

---

## 6. Routing Strategy

```
/login                    → login-area (no guard)
/admin/*                 → admin-area (ADMIN guard)
/worker/kitchen/*        → worker-kitchen-area (KITCHEN guard)
/worker/waiter/*         → worker-waiter-area (WAITER guard)
```

Backend returns `role: 'ADMIN' | 'KITCHEN' | 'WAITER'`. Angular redirects to the appropriate area after login.

---

## 7. Component Structure

Each component uses **separate files** (no inline templates or styles):

```
component-name/
├── component-name.ts      # Class + decorator
├── component-name.html    # External template
└── component-name.css     # Component-scoped styles
```

---

## 8. State Management

- Use Angular **signals** for local component state
- Use **services with signals** for shared state
- No external state management library unless explicitly required

---

## 9. Project Goals

Every decision must contribute to building:

> **"Robust, scalable frontend application that delivers an intuitive and accessible interface for restaurant operations management, enabling real-time data visualization and seamless user interactions."**

This means:
- **Robust**: Production-ready, error handling, edge cases covered
- **Scalable**: Modular architecture, lazy loading, maintainable code
- **Intuitive**: Clear UX, consistent patterns, PrimeNG components
- **Accessible**: WCAG compliance, keyboard navigation, screen reader support
- **Real-time**: WebSocket integration, live updates, reactive UI
- **Seamless**: Smooth transitions, optimistic UI, no friction workflows

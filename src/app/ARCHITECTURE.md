# Frontend Architecture

## Objective

Keep UI concerns separate from business logic and external integrations, mirroring the API hexagonal style.

## Layers

- `features/*`: pages/components and facades that coordinate user flows
- `core/*`: domain models, input/output ports, and use cases
- `infrastructure/*`: adapters implementing output ports (HTTP, storage, sockets)
- `shared/*`: UI primitives, utils, and cross-feature concerns

## Rules

- `features` can depend on `core` and `shared`
- `core` cannot depend on `infrastructure` or `features`
- `infrastructure` depends on `core` (implements ports)
- side effects live in `infrastructure`, not inside `core`

## Orders example

1. `OrdersHomePageComponent` calls `OrdersFacade`
2. `OrdersFacade` triggers `AddProductToOrderUseCase`
3. `AddProductToOrderUseCase` talks to `OrdersRepositoryPort`
4. `OrdersHttpRepository` implements the port and calls API `/api/v1/orders/:id/items`

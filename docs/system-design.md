# System Design

## High-Level Architecture

Broady is a monorepo with distinct runtime concerns:

- Web process for storefront and dashboards.
- API process for domain operations and data access.
- Notification worker for asynchronous event handling.

## Bounded Areas

- Auth and user identity.
- Product catalog and discovery.
- Brands and dashboard operations.
- Orders and split-order fulfillment.
- Notifications and worker dispatch.

## Data Model Direction

- PostgreSQL as transactional source of truth.
- Prisma schema as canonical data contract.
- Parent Order + SubOrder model for multi-brand checkout.

## Runtime Interactions

1. Web calls API using authenticated requests.
2. API writes transactional state via Prisma.
3. API emits notification jobs through adapter abstraction.
4. Worker processes jobs and records delivery outcomes.

## Reliability Controls

- Startup migration deploy on API boot.
- Graceful shutdown handling in runtime processes.
- Queue adapter fallback for local and constrained environments.

## Extensibility Notes

- Keep route handlers thin and push reusable logic to module services.
- Use shared contracts for cross-app type consistency.
- Preserve role checks at middleware and route levels.

## Related Docs

- `docs/Broady_Stack.md`
- `docs/Order_flow.md`
- `docs/notification_system.md`
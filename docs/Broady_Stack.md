# Broady Stack

## Monorepo Layout

- `apps/web`: Next.js storefront and role-based dashboards.
- `apps/api`: Express API with Prisma and domain modules.
- `packages/shared`: shared contracts and reusable types.

## Frontend

- Next.js App Router
- React
- Tailwind CSS
- Zustand
- TanStack Query
- next-pwa

## Backend

- Node.js
- Express
- Prisma ORM

## Data and Queue

- PostgreSQL for transactional data.
- Queue adapter model with Redis, Postgres, and memory options.

## Auth and Security

- JWT and role-based authorization.
- Middleware-based access checks.

## Developer Tooling

- npm workspaces
- ESLint
- TypeScript
- GitHub Actions CI

## Related Docs

- `docs/system-design.md`
- `docs/README.md`
# Broady

Broady is a monorepo for a multi-brand fashion marketplace platform. It combines a Next.js storefront with an Express/Prisma API and an asynchronous notification worker to support editorial commerce, role-based administration, and production-ready operations.

## Problem Statement

Most marketplace implementations become hard to maintain as they scale because business logic, infrastructure code, and product features are coupled together. Broady is structured to keep domains isolated, keep runtime boundaries explicit, and support growth from MVP to production.

## Architecture Overview

Broady follows a module-oriented monorepo architecture:

- `apps/web`: Next.js customer and admin-facing web application.
- `apps/api`: Express API with domain modules, Prisma data access, and auth/authorization middleware.
- `packages/shared`: shared contracts and cross-app types.
- `docs`: implementation notes and operational references.

At runtime, the system is split into three concerns:

- HTTP API process (`apps/api/src/notification-worker.ts`)
- Notification worker process (`apps/api/src/server.ts`) or embedded mode
- Web process (`apps/web`)

## Tech Stack

- Frontend: Next.js App Router, React, Tailwind CSS, Zustand, TanStack Query
- Backend: Node.js, Express, Prisma
- Data: PostgreSQL
- Queueing: Redis + BullMQ adapter (with fallback adapters)
- Auth: JWT + session validation + Google OAuth token verification

## Repository Structure

```text
.
|-- apps/
|   |-- api/
|   |   |-- prisma/
|   |   `-- src/
|   |       |-- config/
|   |       |-- middleware/
|   |       |-- modules/
|   |       |-- routes/
|   |       |-- app.ts
|   |       |-- server.ts
|   |       `-- notification-worker.ts
|   `-- web/
|       `-- src/
|           |-- app/
|           |-- components/
|           |-- lib/
|           |-- providers/
|           |-- stores/
|           `-- types/
|-- packages/
|   `-- shared/
|-- docs/
|-- docker-compose.yml
`-- package.json
```

## Quick Start

### 1. Prerequisites

- Node.js 20+
- npm 10+
- Docker (for local PostgreSQL and Redis)

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

- Copy root env template and adjust values:

```bash
cp .env.example .env
```

- For API-only environment overrides, also review:
  - `apps/api/.env.example`

### 4. Start Local Infrastructure

```bash
npm run db:up
```

### 5. Run Applications

```bash
npm run dev:all
```

Useful alternatives:

- `npm run dev` (web + api)
- `npm run dev:worker` (standalone worker watch mode)

## Database and Prisma

From `apps/api` workspace scripts:

- `npm run prisma:generate -w @broady/api`
- `npm run prisma:migrate -w @broady/api`
- `npm run prisma:seed -w @broady/api`

The API now runs `prisma migrate deploy` during startup before it opens the HTTP port. If you reset the database or add a new migration, the next API start will apply it automatically.

## API Surface (High Level)

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/google`
- `GET /api/brands`
- `GET /api/products`
- `POST /api/orders`
- `GET /api/users/notifications`
- `GET /api/admin/summary`

Notification administration:

- `GET /api/admin/notifications/worker`
- `GET /api/admin/notifications/dead-letters`
- `POST /api/admin/notifications/dead-letters/:jobId/requeue`

## Worker Modes

Broady supports both deployment patterns:

- Embedded worker in API process (default)
- Standalone worker process via `npm run start:worker -w @broady/api`

Controls:

- `NOTIFICATION_WORKER_EMBEDDED=true|false`
- `NOTIFICATION_QUEUE_ADAPTER=redis|postgres|memory`
- `NOTIFICATION_WORKER_HEALTH_PORT=0|<port>`

## Documentation

- `docs/README.md` for documentation map and curation policy.
- `docs/Github_push_strategy.md` for architecture and contribution standards.
- `docs/Order_flow.md` for split-order model and fulfillment semantics.
- `docs/notification_system.md` for event-driven notification architecture.

## Quality and Contribution

- Contribution process: `CONTRIBUTING.md`
- Repository governance files: `LICENSE`, `.gitignore`, `.env.example`
- Commit format: Conventional Commits (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`)

## GitHub Metadata Recommendations

Recommended repository description:

`Monorepo for Broady, a multi-brand fashion marketplace with Next.js storefront, Express/Prisma API, and async notification worker.`

Recommended topics:

- `marketplace`
- `nextjs`
- `express`
- `prisma`
- `postgresql`
- `redis`
- `bullmq`
- `monorepo`
- `typescript`

## License

This project is proprietary. See `LICENSE`.

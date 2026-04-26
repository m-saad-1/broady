# Copilot Instructions for Broady

## Build, lint, and test commands

Run from repository root unless noted.

- Install dependencies: `npm install`
- Start local infra (Postgres + Redis): `npm run db:up`
- Stop local infra: `npm run db:down`
- Run web + API dev: `npm run dev`
- Run web + API + standalone worker dev: `npm run dev:all`
- Run only web dev: `npm run dev:web`
- Run only API dev: `npm run dev:api`
- Run only worker dev: `npm run dev:worker`
- Lint all workspaces: `npm run lint`
- Build all workspaces: `npm run build`
- Lint one workspace:
  - Web: `npm run lint -w @broady/web`
  - API: `npm run lint -w @broady/api`
- Build one workspace:
  - Web: `npm run build -w @broady/web`
  - API: `npm run build -w @broady/api`
- Prisma workflows (API workspace):
  - `npm run prisma:generate -w @broady/api`
  - `npm run prisma:migrate -w @broady/api`
  - `npm run prisma:seed -w @broady/api`

There is currently no `test` script in workspace `package.json` files, so there is no project-defined full-suite or single-test command yet.

## High-level architecture (cross-file)

- Monorepo uses npm workspaces with three main packages:
  - `apps/web`: Next.js App Router storefront + admin/brand/account surfaces
  - `apps/api`: Express + Prisma domain API
  - `packages/shared`: cross-app contracts/enums/types used by both apps
- Runtime is intentionally split into web, API HTTP server, and notification worker concerns.
- Typical request/data flow:
  - Web UI calls API through `apps/web/src/lib/api.ts` and `apps/web/src/lib/auth-client.ts`
  - API validates payloads with Zod in route modules, performs writes with Prisma, and returns JSON
  - Domain changes emit notification events that are queued asynchronously
  - Worker resolves recipients/templates/channels and persists delivery outcomes
- Notification processing is event-driven:
  - Domain modules emit events (`notification.events.ts`)
  - Queue adapter handles enqueue/claim/retry/dead-letter (`notification.queue.ts`)
  - Worker executes delivery orchestration (`notification.worker.ts` + `notification.service.ts`)
  - Adapter is selected by env: `redis | postgres | memory`
- Order domain uses a split-order model:
  - Parent `Order` for checkout/payment
  - Brand-scoped `SubOrder` for fulfillment
  - Parent status is derived from sub-order states (do not bypass derivation logic)
- Auth is JWT + server-side session validation:
  - API accepts cookie token (`broady_token`) and Bearer token
  - JWT payload is validated against `Session` records in Prisma
  - Web stores token in localStorage for client requests and also uses cookie-based auth
- Shared-contract pattern:
  - Core roles/order/payment/product contracts are defined in `packages/shared/src/index.ts`
  - Web marketplace types in `apps/web/src/types/marketplace.ts` extend/reuse shared contracts instead of redefining canonical enums
- Startup behavior is important:
  - HTTP bootstrap runs `prisma migrate deploy` before listening
  - Current entrypoint implementation is non-obvious: `src/notification-worker.ts` boots the HTTP API, while `src/server.ts` boots the standalone notification worker
  - Notification worker can run embedded or standalone
  - Keep graceful shutdown paths intact when editing runtime entrypoints

## Repository conventions (strict)

- Keep API boundaries explicit: routes wire endpoints and middleware only, business logic lives in services.
- Use the module shape for non-trivial API domains:
  - `routes` for endpoint wiring
  - `controller` for request/response mapping
  - `service` for domain rules and orchestration
  - `repository` for complex data access (optional)
- Validate request input at route boundaries with Zod `safeParse` and return `400` with validation details on invalid payloads.
- Preserve API response shapes. Use envelopes (`{ data: ... }`) for resource endpoints; auth endpoints are exceptions (`{ token, user }`).
- Prefer backward-compatible, additive API changes. Do not break clients without an explicit plan.
- Use middleware-first authorization:
  - `requireAuth` for authenticated routes
  - `requireAdmin` for admin-only routes
  - Brand access often requires resolving `brandId` via `user.brandId` or `BrandMember` membership
- For domain events, do not send notifications directly from route handlers. Emit via `queueNotificationEvent(...)` and let notification services/rules handle recipients/channels.
- Product/catalog writes must clear API in-memory cache (`config/cache.ts`) to avoid stale reads.
- Prefer using `@broady/shared` contracts in web/API types instead of redefining shared enums/role/order/payment primitives.

## Naming, security, and docs

- Naming conventions:
  - Files and folders: kebab-case for new files
  - Variables/functions: camelCase
  - Types/interfaces/classes/enums: PascalCase
  - Constants: UPPER_SNAKE_CASE
- Never log secrets or tokens.
- Use environment variables for secret or configurable values and update `.env.example` when adding new required config.
- Update `README.md` when onboarding/run instructions change and update `docs/README.md` when adding or curating documentation.

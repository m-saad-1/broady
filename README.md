# Broady

Broady is a modular multi-brand fashion marketplace built as an npm-workspace monorepo. It combines a Next.js storefront and admin interface with an Express, Prisma, and PostgreSQL API, plus asynchronous worker flows for notifications and ingestion.

The repository is organized for production-style development: domain modules stay isolated, shared contracts live in one package, infrastructure concerns are explicit, and operational docs are kept close to the code.

## What This Repo Contains

- `apps/web`: Next.js App Router customer, account, brand, and admin surfaces.
- `apps/api`: Express API, Prisma schema/migrations, domain modules, auth, search, ingestion, orders, and notifications.
- `packages/shared`: cross-app contracts, enums, and DTOs used by both web and API.
- `docs`: architecture notes, runbooks, feature guides, issue-tracking notes, and repository standards.

Broady follows a private-core strategy. Production business logic, payment internals, split-order orchestration, vendor workflows, and sensitive architecture belong in the private codebase. Any public showcase should use mock APIs, dummy data, and demo-safe flows.

## Architecture Snapshot

The runtime is split into clear concerns:

- Web UI calls the API through client helpers in `apps/web/src/lib`.
- API routes validate inputs, call services, persist through Prisma, and return stable JSON responses.
- Domain events enqueue notification work instead of sending messages directly from route handlers.
- Worker logic resolves recipients, templates, channels, retries, and delivery outcomes.
- Orders use a parent `Order` plus brand-scoped `SubOrder` model so checkout stays unified while fulfillment is brand-specific.

API modules should keep this shape for non-trivial domains:

```text
src/modules/<feature>/
  <feature>.routes.ts
  <feature>.controller.ts
  <feature>.service.ts
  <feature>.repository.ts
  <feature>.validation.ts
  <feature>.types.ts
```

Routes wire endpoints and middleware. Controllers map requests and responses. Services own business rules. Repositories handle complex data access when needed.

## Tech Stack

| Layer | Stack |
| --- | --- |
| Web | Next.js App Router, React, TypeScript, Tailwind CSS |
| API | Node.js, Express, TypeScript, Zod |
| Data | PostgreSQL, Prisma |
| Search | Meilisearch with API fallback search |
| Queue | Redis/BullMQ with PostgreSQL or memory fallback for notifications |
| Auth | JWT, cookie token, Bearer token, Prisma-backed sessions, Google OAuth |
| Monorepo | npm workspaces |

## Quick Start

Prerequisites: Node.js 20+, npm 10+, PostgreSQL on `localhost:5432`, and Redis or `NOTIFICATION_QUEUE_ADAPTER=postgres`. Docker is not installed on the current development host, so run infrastructure as local services.

```bash
git clone https://github.com/m-saad-1/broady.git
cd broady
npm install
cp .env.example .env
npm run prisma:generate -w @broady/api
npm run prisma:migrate -w @broady/api
npm run dev:all
```

Open the web app at `http://localhost:3000` and verify the API/database with:

```bash
curl http://localhost:4000/health
```

If Redis is unavailable, set this in `.env` before starting:

```env
NOTIFICATION_QUEUE_ADAPTER=postgres
```

## Development Commands

Run commands from the repository root unless noted.

| Task | Command |
| --- | --- |
| Web + API | `npm run dev` |
| Web + API alias | `npm run dev:all` |
| Web only | `npm run dev:web` |
| API only | `npm run dev:api` |
| Lint all workspaces | `npm run lint` |
| Build all workspaces | `npm run build` |
| Lint web | `npm run lint -w @broady/web` |
| Lint API | `npm run lint -w @broady/api` |
| Build web | `npm run build -w @broady/web` |
| Build API | `npm run build -w @broady/api` |
| Generate Prisma client | `npm run prisma:generate -w @broady/api` |
| Run Prisma migrations | `npm run prisma:migrate -w @broady/api` |
| Seed API database | `npm run prisma:seed -w @broady/api` |

There is currently no project-defined full test suite. Use lint, build, targeted smoke checks, and manual workflow verification for validation evidence.

## Environment And Services

Keep real secrets out of Git. Copy templates, then fill local values in ignored `.env` files.

- Root template: `.env.example`
- API template: `apps/api/.env.example`
- Do not commit `.env`, API keys, SMTP credentials, payment secrets, Firebase private keys, or Meilisearch admin keys.
- Update `.env.example` whenever a required config value is added.

The API defaults to `PORT=4000`. If startup migration deploy hangs or local migration state is intentionally managed separately, set:

```env
PRISMA_MIGRATE_ON_BOOT=false
```

After API, database, error-handling, or configuration changes, verify:

```bash
curl http://localhost:4000/health
```

Expected database health:

```json
{
  "status": "healthy",
  "connected": true,
  "message": "Database connection is healthy and responsive"
}
```

## Product And Domain Rules

- Preserve stable API response shapes. Resource endpoints should use envelopes such as `{ "data": ... }`; auth endpoints may return `{ "token", "user" }`.
- Validate request input at route boundaries with Zod `safeParse`.
- Use middleware-first authorization with `requireAuth`, `requireAdmin`, and brand membership checks.
- Use `@broady/shared` for canonical roles, order/payment primitives, and shared marketplace contracts.
- Product and catalog writes must clear in-memory API cache to avoid stale reads.
- Notification side effects should be queued through notification events, not sent directly from route handlers.
- Parent order status must be derived from sub-order state; do not bypass the split-order derivation logic.

## Documentation Map

Start with `docs/README.md` for the current documentation index.

Important docs:

- `docs/Github_push_strategy.md`: repository standards, architecture boundaries, commit rules, and PR expectations.
- `docs/QUICK_START.md`: local setup reference.
- `docs/system-design.md`: runtime and data-flow architecture.
- `docs/Order_flow.md`: order and fulfillment semantics.
- `docs/notification_system.md`: event-driven notifications and worker behavior.
- `docs/Meilisearch.md`: product search setup and operational notes.
- `docs/issue-tracking/`: durable notes for fixed issues and major implementation decisions.

Before editing a domain, read the relevant domain docs and issue-tracking notes to avoid reintroducing solved bugs.

## GitHub And Contribution Rules

Use small, meaningful commits with Conventional Commits:

```text
feat(order): implement sub-order splitting
fix(auth): handle token expiration
refactor(notification): decouple event emitter
docs(readme): clarify local setup
```

Before pushing or opening a PR:

- Confirm the working tree contains only intentional changes.
- Keep sensitive internals and real secrets out of public/demo repositories.
- Run the relevant lint/build commands and record validation evidence.
- Note migration or environment changes in the PR.
- Keep API changes backward-compatible unless there is an explicit migration plan.
- Update README or docs when onboarding, runtime, or operational behavior changes.

A PR should include the problem statement, scope, architecture impact, validation evidence, and follow-up tasks.

## Troubleshooting

API cannot reach the database:

- Confirm PostgreSQL is running on `localhost:5432`.
- Confirm `DATABASE_URL` and `DATABASE_DIRECT_URL` point to the local Broady database.
- Run `npm run prisma:generate -w @broady/api`.
- Use `PRISMA_MIGRATE_ON_BOOT=false` only when local migration state is handled manually.

Web cannot reach API:

- Confirm the API is running and `curl http://localhost:4000/health` returns healthy database status.
- Confirm `NEXT_PUBLIC_API_URL` points to the API base URL, usually `http://localhost:4000/api`.
- If the web dev server moves from port `3000` to another port, ensure the API CORS allowlist includes it.

Notifications are not processing:

- Confirm `NOTIFICATION_QUEUE_ADAPTER` matches your available service.
- Use `postgres` when Redis is not available.
- Check API/worker logs for queue claim, retry, or dead-letter messages.

## License

This project is proprietary. See `LICENSE` if it is present in your checkout.

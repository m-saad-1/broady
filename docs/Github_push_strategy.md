# Broady Repository Strategy

This document defines the repository standards for shipping production-quality changes to Broady.

## 1. Scope

Broady is a monorepo with three primary units:

- `apps/api`: Express + Prisma backend
- `apps/web`: Next.js storefront and admin web
- `packages/shared`: shared contracts and cross-app primitives

The objective is consistency, maintainability, and operational clarity.

## 2. Architectural Principles

- Keep domain boundaries explicit by feature module.
- Keep route/controller layers thin and place business logic in services.
- Keep infrastructure concerns (queue, cache, external providers) isolated from domain logic.
- Keep shared contracts in `packages/shared`; avoid contract duplication.
- Prefer additive migrations and backward-compatible API changes.

## 3. Target Module Shape (API)

For modules with non-trivial logic, use this shape:

```text
src/modules/<domain>/
  <domain>.routes.ts
  <domain>.controller.ts
  <domain>.service.ts
  <domain>.repository.ts   # optional, for complex data access
  <domain>.schemas.ts      # or validation file
  <domain>.types.ts        # optional
```

Rules:

- `routes` contain endpoint wiring and middleware only.
- `controller` handles request/response mapping.
- `service` owns business rules and orchestration.
- `repository` owns data querying patterns when queries become complex.

## 4. Shared Package Rules

`packages/shared` is the source of truth for:

- API response envelopes and error shapes
- cross-app enums and DTOs
- narrow utility types used by both apps

Do not place framework-specific code in `packages/shared`.

## 5. Naming and File Conventions

- Files and folders: kebab-case when creating new files
- Variables/functions: camelCase
- Types/interfaces/classes/enums: PascalCase
- Constants: UPPER_SNAKE_CASE

## 6. API Standards

- Use REST semantics consistently.
- Use stable response envelope patterns.
- Use centralized error handling middleware.
- Validate all external input (query, params, body).

Recommended response shape:

```json
{
  "data": {},
  "message": "optional",
  "meta": {}
}
```

Recommended error shape:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message"
  }
}
```

## 7. Security and Reliability Standards

- Never log secrets or tokens.
- Use environment variables for all secret/configurable values.
- Keep worker lifecycle and shutdown paths explicit.
- Gate admin routes with both auth and role checks.

## 8. Git and Pull Request Standards

### Conventional Commits

Use Conventional Commits for every commit:

- `feat:` new capability
- `fix:` bug fix
- `refactor:` code restructuring without behavior change
- `docs:` documentation changes
- `chore:` maintenance
- `test:` test updates

### Pull Request Requirements

Each PR should include:

- Problem statement and scope
- Architecture impact
- Validation evidence (`npm run lint`, `npm run build`, manual checks)
- Migration/env changes if applicable

## 9. CI and Quality Signals

The repository should always have these visible signals:

- Passing lint and build in CI
- Updated `.env.example` when config changes
- Updated README for onboarding-impacting changes
- Clear changelog in PR descriptions

## 10. Definition of Done

A change is done when:

- Layer boundaries remain intact
- No business logic is hidden in routes for complex flows
- Lint/build pass
- Docs and environment templates are updated
- Commit history is clean and searchable
